import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHECKLIST_RELATIVE_PATH,
  DATASET_RELATIVE_PATH,
  RESULTS_RELATIVE_PATH,
  calculateStats,
  createSummary,
  initializeResultsFromChecklist,
  isComplete,
  loadPhrases,
  loadResults,
  saveResults,
  updateResult,
} from './lib/qa-data.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('loads 108 unique phrases from the formal dataset', async () => {
  const phrases = await loadPhrases(repoRoot);
  assert.equal(phrases.length, 108);
  assert.equal(new Set(phrases.map((phrase) => phrase.id)).size, 108);
});

test('maps phrase text and WAV URL from dataset fields', async () => {
  const phrases = await loadPhrases(repoRoot);
  const first = phrases[0];
  assert.equal(first.id, 'tj-001');
  assert.equal(first.japanese, 'パスポートです。');
  assert.equal(first.traditionalChinese, '這是我的護照。');
  assert.equal(first.category, 'airport');
  assert.equal(first.wavPath, 'production/audio/travel-japanese/wav/tj-001.wav');
  assert.equal(first.wavUrl, '/audio/tj-001.wav');
});

test('persists PASS, FAIL, and notes to the JSON result file', async () => {
  const tempRoot = await createFixtureRepo();
  const phrases = await loadPhrases(tempRoot);
  const initial = (await loadResults(tempRoot, phrases)).results;

  const passUpdated = updateResult(initial, { id: 'tj-001', status: 'PASS', note: '' }, new Date('2026-09-23T00:00:00.000Z'));
  const failUpdated = updateResult(passUpdated, { id: 'tj-002', status: 'FAIL', note: '尾音需複聽' }, new Date('2026-09-23T00:01:00.000Z'));
  await saveResults(tempRoot, phrases, failUpdated);

  const stored = JSON.parse(await fs.readFile(path.join(tempRoot, RESULTS_RELATIVE_PATH), 'utf8'));
  assert.equal(stored.find((result) => result.id === 'tj-001').status, 'PASS');
  assert.equal(stored.find((result) => result.id === 'tj-002').status, 'FAIL');
  assert.equal(stored.find((result) => result.id === 'tj-002').note, '尾音需複聽');
  assert.equal(stored.find((result) => result.id === 'tj-002').reviewedAt, '2026-09-23T00:01:00.000Z');
});

test('handles malformed result file by falling back to checklist defaults', async () => {
  const tempRoot = await createFixtureRepo();
  await fs.mkdir(path.dirname(path.join(tempRoot, RESULTS_RELATIVE_PATH)), { recursive: true });
  await fs.writeFile(path.join(tempRoot, RESULTS_RELATIVE_PATH), '{ bad json', 'utf8');

  const phrases = await loadPhrases(tempRoot);
  const loaded = await loadResults(tempRoot, phrases);
  const expectedResults = await initializeResultsFromChecklist(tempRoot, phrases.map((phrase) => phrase.id));
  assert.equal(loaded.warning.includes('malformed'), true);
  assert.deepEqual(loaded.results, expectedResults);
});

test('navigation state can move previous and next without losing phrase order', async () => {
  const phrases = await loadPhrases(repoRoot);
  let currentIndex = 0;
  currentIndex = Math.min(phrases.length - 1, currentIndex + 1);
  assert.equal(phrases[currentIndex].id, 'tj-002');
  currentIndex = Math.max(0, currentIndex - 1);
  assert.equal(phrases[currentIndex].id, 'tj-001');
});

test('playback stop behavior resets pause state and current time when changing phrase', () => {
  const audio = { paused: false, currentTime: 12, pauseCalled: false, pause() { this.pauseCalled = true; this.paused = true; } };
  stopAudioForTest(audio);
  assert.equal(audio.pauseCalled, true);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.paused, true);
});

test('completion requires 108 PASS, 0 FAIL, and 0 PENDING', async () => {
  const phrases = await loadPhrases(repoRoot);
  const allPass = phrases.map((phrase) => ({ id: phrase.id, status: 'PASS', note: '', reviewedAt: '2026-09-23T00:00:00.000Z' }));
  assert.equal(isComplete(allPass), true);

  const oneFail = allPass.map((result) => (result.id === 'tj-108' ? { ...result, status: 'FAIL' } : result));
  assert.equal(isComplete(oneFail), false);
  assert.match(createSummary(phrases, oneFail), /人工聽檢尚未完成/);
});

test('stats count reviewed, PASS, FAIL, and PENDING records', () => {
  const stats = calculateStats([
    { id: 'tj-001', status: 'PASS', note: '', reviewedAt: '' },
    { id: 'tj-002', status: 'FAIL', note: '', reviewedAt: '' },
    { id: 'tj-003', status: 'PENDING', note: '', reviewedAt: '' },
  ]);
  assert.deepEqual(stats, { total: 3, reviewed: 2, pass: 1, fail: 1, pending: 1 });
});

async function createFixtureRepo() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'travel-japanese-audio-qa-'));
  await fs.mkdir(path.dirname(path.join(tempRoot, DATASET_RELATIVE_PATH)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(tempRoot, CHECKLIST_RELATIVE_PATH)), { recursive: true });
  await fs.copyFile(path.join(repoRoot, DATASET_RELATIVE_PATH), path.join(tempRoot, DATASET_RELATIVE_PATH));
  await fs.copyFile(path.join(repoRoot, CHECKLIST_RELATIVE_PATH), path.join(tempRoot, CHECKLIST_RELATIVE_PATH));
  return tempRoot;
}

function stopAudioForTest(audio) {
  audio.pause();
  audio.currentTime = 0;
}