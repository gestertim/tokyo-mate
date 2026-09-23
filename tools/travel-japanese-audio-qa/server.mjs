import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESULTS_RELATIVE_PATH,
  SUMMARY_RELATIVE_PATH,
  WAV_DIR_RELATIVE_PATH,
  calculateStats,
  isComplete,
  loadPhrases,
  loadResults,
  saveResults,
  updateResult,
  writeSummary,
} from './lib/qa-data.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolRoot, '../..');
const publicRoot = path.join(toolRoot, 'public');
const host = '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '4174', 10);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wav', 'audio/wav'],
]);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function resolveInside(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

async function serveFile(response, root, requestPath) {
  const target = resolveInside(root, requestPath === '/' ? '/index.html' : requestPath);
  if (!target) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await fs.readFile(target);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(path.extname(target)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}

async function getState() {
  const phrases = await loadPhrases(repoRoot);
  const { results, source, warning } = await loadResults(repoRoot, phrases);
  return { phrases, results, source, warning, stats: calculateStats(results), complete: isComplete(results) };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);

    if (request.method === 'GET' && url.pathname === '/api/state') {
      sendJson(response, 200, await getState());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/results') {
      const payload = JSON.parse(await readRequestBody(request));
      const { phrases, results } = await getState();
      if (!phrases.some((phrase) => phrase.id === payload.id)) {
        sendJson(response, 404, { error: 'Unknown phrase id.' });
        return;
      }

      const updated = updateResult(results, payload);
      const saved = await saveResults(repoRoot, phrases, updated);
      sendJson(response, 200, {
        results: saved,
        stats: calculateStats(saved),
        complete: isComplete(saved),
        resultPath: RESULTS_RELATIVE_PATH,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/export') {
      const { phrases, results } = await getState();
      await saveResults(repoRoot, phrases, results);
      const summaryPath = await writeSummary(repoRoot, phrases, results);
      sendJson(response, 200, {
        resultPath: RESULTS_RELATIVE_PATH,
        summaryPath,
        stats: calculateStats(results),
        complete: isComplete(results),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/audio/')) {
      await serveFile(response, path.join(repoRoot, WAV_DIR_RELATIVE_PATH), url.pathname.replace('/audio', ''));
      return;
    }

    if (request.method === 'GET') {
      await serveFile(response, publicRoot, url.pathname);
      return;
    }

    response.writeHead(405, { Allow: 'GET, POST' });
    response.end('Method not allowed');
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Travel Japanese Audio QA Tool: http://${host}:${port}`);
  console.log('VOICEVOX / Nemo engine is not required; this server only plays existing WAV files.');
  console.log(`Results: ${RESULTS_RELATIVE_PATH}`);
  console.log(`Summary export: ${SUMMARY_RELATIVE_PATH}`);
});