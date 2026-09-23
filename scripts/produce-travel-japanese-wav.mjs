#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const DATASET_PATH = join(ROOT, 'src/data/tokyo/travel-japanese-phrases.json');
const OUTPUT_DIR = join(ROOT, 'production/audio/travel-japanese/wav');
const REPORT_DIR = join(ROOT, 'production/audio/travel-japanese/reports');
const ENGINE_URL = 'http://127.0.0.1:50121';
const STYLE_ID = 10001;
const EXPECTED_SPEAKER_UUID = '2171909e-d2d1-4bbb-aa45-442c12732665';
const PARAMETERS = Object.freeze({
  speedScale: 0.8,
  pitchScale: 0,
  intonationScale: 1,
  volumeScale: 1,
  pauseLengthScale: 1,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.1,
});

function parseArgs(argv) {
  const options = { dryRun: false, fullBatch: false, resume: false, overwrite: false, id: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--full-batch') options.fullBatch = true;
    else if (argument === '--resume') options.resume = true;
    else if (argument === '--overwrite') options.overwrite = true;
    else if (argument === '--id') options.id = argv[++index];
    else if (argument === '--help') {
      console.log('Usage: node scripts/produce-travel-japanese-wav.mjs --dry-run --full-batch');
      console.log('       node scripts/produce-travel-japanese-wav.mjs --full-batch [--resume] [--overwrite]');
      console.log('       node scripts/produce-travel-japanese-wav.mjs --id tj-097');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.id && !options.fullBatch) throw new Error('Full batch requires explicit --full-batch, or provide --id.');
  if (options.id && !/^tj-(?:00[1-9]|0[1-9][0-9]|10[0-8])$/.test(options.id)) throw new Error(`Invalid phrase ID: ${options.id}`);
  if (options.dryRun && options.overwrite) throw new Error('--overwrite cannot be used with --dry-run.');
  return options;
}

async function readDataset() {
  const phrases = JSON.parse(await readFile(DATASET_PATH, 'utf8'));
  const expectedIds = Array.from({ length: 108 }, (_, index) => `tj-${String(index + 1).padStart(3, '0')}`);
  const ids = phrases.map((phrase) => phrase.id);
  const uniqueIds = [...new Set(ids)];
  const missingIds = expectedIds.filter((id) => !uniqueIds.includes(id));
  const extraIds = uniqueIds.filter((id) => !expectedIds.includes(id));
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const invalidPhrases = phrases.filter((phrase) => typeof phrase.japanese !== 'string' || phrase.japanese.trim() === '');
  const japaneseTexts = phrases.map((phrase) => phrase.japanese);
  const duplicateJapanese = [...new Set(japaneseTexts.filter((text, index) => japaneseTexts.indexOf(text) !== index))];
  if (phrases.length !== 108 || uniqueIds.length !== 108 || missingIds.length || extraIds.length || duplicateIds.length || invalidPhrases.length || duplicateJapanese.length) {
    throw new Error(JSON.stringify({ phraseCount: phrases.length, uniqueIdCount: uniqueIds.length, missingIds, extraIds, duplicateIds: [...new Set(duplicateIds)], invalidPhraseIds: invalidPhrases.map((phrase) => phrase.id), duplicateJapanese }));
  }
  return phrases;
}

async function nemoPreflight() {
  const versionResponse = await fetch(`${ENGINE_URL}/version`);
  if (!versionResponse.ok) throw new Error(`Nemo /version failed: HTTP ${versionResponse.status}`);
  const version = await versionResponse.json();
  const speakersResponse = await fetch(`${ENGINE_URL}/speakers`);
  if (!speakersResponse.ok) throw new Error(`Nemo /speakers failed: HTTP ${speakersResponse.status}`);
  const speakers = await speakersResponse.json();
  const match = speakers.find((speaker) => speaker.name === '男声1' && speaker.speaker_uuid === EXPECTED_SPEAKER_UUID && speaker.styles?.some((style) => style.name === 'ノーマル' && style.id === STYLE_ID));
  if (!match) throw new Error('Approved Nemo voice/style/UUID was not found at 50121.');
  return { version, speaker: match };
}

function outputPath(id) {
  return join(OUTPUT_DIR, `${id}.wav`);
}

function buildPlan(phrases) {
  return phrases.map((phrase) => ({ id: phrase.id, japanese: phrase.japanese, outputPath: outputPath(phrase.id), styleId: STYLE_ID, parameters: PARAMETERS }));
}

function readWav(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return { valid: false, reason: 'missing RIFF/WAVE header' };
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + chunkSize;
    if (chunkEnd > buffer.length) return { valid: false, reason: `truncated ${chunkId} chunk` };
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    }
    if (chunkId === 'data') dataSize = chunkSize;
    offset = chunkEnd + (chunkSize % 2);
  }
  const durationSeconds = sampleRate && channels && bitsPerSample ? dataSize / (sampleRate * channels * (bitsPerSample / 8)) : 0;
  if (!sampleRate || !channels || !bitsPerSample || !dataSize || durationSeconds <= 0) return { valid: false, reason: 'missing or empty audio metadata' };
  return { valid: true, sampleRate, channels, bitsPerSample, dataSize, durationSeconds };
}

async function validateOutput(filePath) {
  try {
    const buffer = await readFile(filePath);
    const info = readWav(buffer);
    return { filePath, fileSize: buffer.length, ...info };
  } catch (error) {
    return { filePath, fileSize: 0, valid: false, reason: error.message };
  }
}

async function synthesize(plan) {
  const queryUrl = new URL('/audio_query', ENGINE_URL);
  queryUrl.searchParams.set('text', plan.japanese);
  queryUrl.searchParams.set('speaker', String(STYLE_ID));
  const queryResponse = await fetch(queryUrl, { method: 'POST' });
  if (!queryResponse.ok) throw new Error(`audio_query HTTP ${queryResponse.status}`);
  const query = await queryResponse.json();
  Object.assign(query, PARAMETERS);
  const synthesisResponse = await fetch(`${ENGINE_URL}/synthesis?speaker=${STYLE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!synthesisResponse.ok) throw new Error(`synthesis HTTP ${synthesisResponse.status}`);
  const audio = Buffer.from(await synthesisResponse.arrayBuffer());
  const validation = readWav(audio);
  if (!validation.valid) throw new Error(`synthesis returned invalid WAV: ${validation.reason}`);
  await writeFile(plan.outputPath, audio, { flag: 'wx' });
  return validation;
}

function qaChecklist(phrases) {
  const rows = phrases.map((phrase) => `| ${phrase.id} | ${phrase.japanese} | ${phrase.traditionalChinese} | ${phrase.categories.join(', ')} | production/audio/travel-japanese/wav/${phrase.id}.wav | PENDING |  | NO |`);
  return ['# Travel Japanese 108-Phrase Human QA Checklist', '', '所有 automated structural checks 通過後，人工聽檢狀態仍必須由 `PENDING` 開始。不得由 script 自動改為 `PASS`。', '', '| Phrase ID | Japanese | Traditional Chinese | Category | WAV path | Human QA status | Defect note | Regeneration required |', '|---|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const phrases = await readDataset();
  const nemo = await nemoPreflight();
  const selected = options.id ? phrases.filter((phrase) => phrase.id === options.id) : phrases;
  const plan = buildPlan(selected);
  const expectedFiles = new Set(phrases.map((phrase) => `${phrase.id}.wav`));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });
  if (!options.dryRun) await writeFile(join(REPORT_DIR, 'failure.log'), '');
  const report = { generatedAt: new Date().toISOString(), mode: options.dryRun ? 'dry-run' : options.id ? 'single' : 'full-batch', phraseCount: phrases.length, selectedCount: selected.length, firstId: phrases[0].id, lastId: phrases.at(-1).id, styleId: STYLE_ID, speakerUuid: nemo.speaker.speaker_uuid, nemoVersion: nemo.version, parameters: PARAMETERS, plan, success: [], failures: [], skipped: [] };
  if (options.dryRun) {
    await writeFile(join(REPORT_DIR, 'dry-run-report.json'), JSON.stringify(report, null, 2));
    await writeFile(join(REPORT_DIR, 'human-qa-checklist.md'), qaChecklist(phrases));
    console.log(JSON.stringify({ ...report, synthesisCalled: false }, null, 2));
    return;
  }
  for (const item of plan) {
    try {
      const existing = await stat(item.outputPath).catch(() => null);
      if (existing && !options.overwrite) {
        if (options.resume) {
          const validation = await validateOutput(item.outputPath);
          if (validation.valid) { report.skipped.push({ id: item.id, reason: 'valid output exists' }); continue; }
        }
        throw new Error('output exists; use --resume for valid output or --overwrite explicitly');
      }
      if (existing && options.overwrite) await writeFile(item.outputPath, Buffer.alloc(0));
      const validation = await synthesize(item);
      report.success.push({ id: item.id, ...validation });
    } catch (error) {
      report.failures.push({ id: item.id, error: error.message });
      await writeFile(join(REPORT_DIR, 'failure.log'), `${item.id}\t${error.message}\n`, { flag: 'a' });
    }
  }
  const files = (await readdir(OUTPUT_DIR)).filter((name) => name.endsWith('.wav'));
  const structural = [];
  for (const file of files) structural.push({ file, ...(await validateOutput(join(OUTPUT_DIR, file))) });
  const actualFiles = new Set(files);
  const missingIds = [...expectedFiles].filter((file) => !actualFiles.has(file)).map((file) => basename(file, '.wav'));
  const extraFiles = files.filter((file) => !expectedFiles.has(file));
  const validFiles = structural.filter((item) => item.valid);
  const sampleRates = [...new Set(validFiles.map((item) => item.sampleRate))];
  report.structuralValidation = { totalWavFiles: files.length, expectedWavFiles: 108, missingIds, extraFiles, invalidWavCount: structural.filter((item) => !item.valid).length, zeroByteCount: structural.filter((item) => item.fileSize === 0).length, sampleRates, minDurationSeconds: Math.min(...validFiles.map((item) => item.durationSeconds)), maxDurationSeconds: Math.max(...validFiles.map((item) => item.durationSeconds)), minFileSize: Math.min(...validFiles.map((item) => item.fileSize)), maxFileSize: Math.max(...validFiles.map((item) => item.fileSize)), files: structural };
  report.structuralValidation.pass = report.success.length + report.skipped.length === 108 && report.structuralValidation.totalWavFiles === 108 && !missingIds.length && !extraFiles.length && !report.structuralValidation.invalidWavCount && sampleRates.length === 1;
  await writeFile(join(REPORT_DIR, 'batch-summary.json'), JSON.stringify(report, null, 2));
  await writeFile(join(REPORT_DIR, 'human-qa-checklist.md'), qaChecklist(phrases));
  console.log(JSON.stringify({ ...report, plan: undefined, structuralValidation: { ...report.structuralValidation, files: undefined } }, null, 2));
  if (!report.structuralValidation.pass) process.exitCode = 1;
}

main().catch((error) => { console.error(`Production STOP: ${error.message}`); process.exitCode = 1; });
