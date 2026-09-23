import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DATASET_RELATIVE_PATH = 'src/data/tokyo/travel-japanese-phrases.json';
export const WAV_DIR_RELATIVE_PATH = 'production/audio/travel-japanese/wav';
export const CHECKLIST_RELATIVE_PATH = 'production/audio/travel-japanese/reports/human-qa-checklist.md';
export const RESULTS_RELATIVE_PATH = 'production/audio/travel-japanese/reports/human-qa-results.json';
export const SUMMARY_RELATIVE_PATH = 'production/audio/travel-japanese/reports/human-qa-summary.md';

export const STATUSES = new Set(['PASS', 'FAIL', 'PENDING']);

export async function loadPhrases(repoRoot) {
  const datasetPath = path.join(repoRoot, DATASET_RELATIVE_PATH);
  const raw = await fs.readFile(datasetPath, 'utf8');
  const phrases = JSON.parse(raw);

  if (!Array.isArray(phrases)) {
    throw new Error('travel-japanese-phrases.json must contain an array.');
  }

  const seenIds = new Set();
  return phrases.map((phrase) => {
    if (!phrase.id || seenIds.has(phrase.id)) {
      throw new Error(`Duplicate or missing phrase id: ${phrase.id ?? '(missing)'}`);
    }

    seenIds.add(phrase.id);
    const categories = Array.isArray(phrase.categories) ? phrase.categories : [];
    const wavPath = path.posix.join(WAV_DIR_RELATIVE_PATH, `${phrase.id}.wav`);

    return {
      id: phrase.id,
      japanese: phrase.japanese ?? '',
      traditionalChinese: phrase.traditionalChinese ?? '',
      zhTW: phrase.traditionalChinese ?? '',
      category: categories.join(', '),
      categories,
      wavFileName: `${phrase.id}.wav`,
      wavPath,
      wavUrl: `/audio/${phrase.id}.wav`,
    };
  });
}

export async function loadResults(repoRoot, phrases) {
  const phraseIds = phrases.map((phrase) => phrase.id);
  const fallbackResults = await initializeResultsFromChecklist(repoRoot, phraseIds);
  const resultsPath = path.join(repoRoot, RESULTS_RELATIVE_PATH);

  try {
    const raw = await fs.readFile(resultsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('human-qa-results.json must contain an array.');
    }

    return {
      results: mergeResults(phraseIds, fallbackResults, parsed),
      source: RESULTS_RELATIVE_PATH,
      warning: '',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        results: fallbackResults,
        source: CHECKLIST_RELATIVE_PATH,
        warning: '',
      };
    }

    return {
      results: fallbackResults,
      source: CHECKLIST_RELATIVE_PATH,
      warning: 'human-qa-results.json malformed; using checklist PENDING defaults until the next save.',
    };
  }
}

export async function initializeResultsFromChecklist(repoRoot, phraseIds) {
  const checklistPath = path.join(repoRoot, CHECKLIST_RELATIVE_PATH);
  const defaults = phraseIds.map((id) => ({ id, status: 'PENDING', note: '', reviewedAt: '' }));

  try {
    const raw = await fs.readFile(checklistPath, 'utf8');
    const byId = new Map(defaults.map((result) => [result.id, result]));

    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('| tj-')) {
        continue;
      }

      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      const id = cells[0];
      if (!byId.has(id)) {
        continue;
      }

      byId.set(id, {
        id,
        status: normalizeStatus(cells[5]),
        note: cells[6] ?? '',
        reviewedAt: '',
      });
    }

    return phraseIds.map((id) => byId.get(id));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaults;
    }

    throw error;
  }
}

export function mergeResults(phraseIds, defaults, incomingResults) {
  const allowedIds = new Set(phraseIds);
  const byId = new Map(defaults.map((result) => [result.id, result]));

  for (const result of incomingResults) {
    if (!result || !allowedIds.has(result.id)) {
      continue;
    }

    byId.set(result.id, normalizeResult(result));
  }

  return phraseIds.map((id) => byId.get(id) ?? { id, status: 'PENDING', note: '', reviewedAt: '' });
}

export function normalizeResult(result) {
  return {
    id: String(result.id),
    status: normalizeStatus(result.status),
    note: typeof result.note === 'string' ? result.note : '',
    reviewedAt: typeof result.reviewedAt === 'string' ? result.reviewedAt : '',
  };
}

export function normalizeStatus(status) {
  return STATUSES.has(status) ? status : 'PENDING';
}

export async function saveResults(repoRoot, phrases, results) {
  const phraseIds = phrases.map((phrase) => phrase.id);
  const defaults = phraseIds.map((id) => ({ id, status: 'PENDING', note: '', reviewedAt: '' }));
  const normalized = mergeResults(phraseIds, defaults, results);
  const resultsPath = path.join(repoRoot, RESULTS_RELATIVE_PATH);

  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export function updateResult(results, update, now = new Date()) {
  return results.map((result) => {
    if (result.id !== update.id) {
      return result;
    }

    const status = normalizeStatus(update.status);
    return {
      id: result.id,
      status,
      note: typeof update.note === 'string' ? update.note : result.note,
      reviewedAt: status === 'PENDING' ? '' : now.toISOString(),
    };
  });
}

export function calculateStats(results) {
  return results.reduce(
    (stats, result) => {
      stats.total += 1;
      stats[result.status.toLowerCase()] += 1;
      if (result.status !== 'PENDING') {
        stats.reviewed += 1;
      }
      return stats;
    },
    { total: 0, reviewed: 0, pass: 0, fail: 0, pending: 0 },
  );
}

export function isComplete(results) {
  const stats = calculateStats(results);
  return stats.total === 108 && stats.pass === 108 && stats.fail === 0 && stats.pending === 0;
}

export function createSummary(phrases, results, reviewDate = new Date()) {
  const stats = calculateStats(results);
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
  const failures = results.filter((result) => result.status === 'FAIL');
  const lines = [
    '# Travel Japanese Audio Human QA Summary',
    '',
    `- Review date: ${reviewDate.toISOString()}`,
    `- Total: ${stats.total}`,
    `- PASS: ${stats.pass}`,
    `- FAIL: ${stats.fail}`,
    `- PENDING: ${stats.pending}`,
    `- Completion: ${isComplete(results) ? '108 句人工聽檢完成' : '人工聽檢尚未完成'}`,
    '',
    '## FAIL phrase IDs + notes',
    '',
  ];

  if (failures.length === 0) {
    lines.push('- None');
  } else {
    for (const failure of failures) {
      const phrase = phraseById.get(failure.id);
      const note = failure.note.trim() || '(no note)';
      lines.push(`- ${failure.id} | ${phrase?.japanese ?? ''} | ${note}`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function writeSummary(repoRoot, phrases, results, reviewDate = new Date()) {
  const summaryPath = path.join(repoRoot, SUMMARY_RELATIVE_PATH);
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, createSummary(phrases, results, reviewDate), 'utf8');
  return SUMMARY_RELATIVE_PATH;
}