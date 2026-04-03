import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Orchestrator } from './queue/orchestrator.js';
import { AdDatabase } from './storage/database.js';
import { Exporter } from './cli/export.js';
import { log } from './utils/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(process.cwd(), 'data', 'ads.db');
const PORT = process.env.PORT || 3456;

// SSE 클라이언트 (진행상황 실시간 스트림)
const sseClients = new Set();

// 현재 실행 중인 세션
let activeOrchestrator = null;
let activeSessionId = null;

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch {}
  }
}

// ── 라우터 ──────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── GET / → UI ──────────────────────────────────────────────────
  if (method === 'GET' && path === '/') {
    const html = readFileSync(join(__dirname, 'ui', 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // ── GET /events → SSE ───────────────────────────────────────────
  if (method === 'GET' && path === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;  // keep open
  }

  // ── POST /api/scrape → 수집 시작 ─────────────────────────────────
  if (method === 'POST' && path === '/api/scrape') {
    const body = await readBody(req);
    const { keywords, sessionName, concurrency } = JSON.parse(body);

    if (!keywords || keywords.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '키워드를 입력하세요' }));
    }

    if (activeOrchestrator) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '이미 수집 중입니다' }));
    }

    // 비동기로 실행 (응답 먼저 반환)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: '수집 시작됨' }));

    const kwList = keywords.split(/[,\n]/).map(k => k.trim()).filter(Boolean);
    const name = sessionName || `수집_${new Date().toISOString().slice(0, 10)}`;

    activeOrchestrator = new Orchestrator({
      dbPath: DB_PATH,
      headless: true,
      concurrency: parseInt(concurrency) || 3,
      onProgress: ({ phase, pct, item, found }) => {
        broadcast('progress', { phase, pct, item, found });
      },
    });

    broadcast('start', { keywords: kwList, sessionName: name });

    activeOrchestrator.run(name, kwList)
      .then(({ sessionId, stats }) => {
        activeSessionId = sessionId;
        broadcast('done', { sessionId, stats });
      })
      .catch(err => {
        broadcast('error', { message: err.message });
      })
      .finally(() => {
        activeOrchestrator = null;
      });

    return;
  }

  // ── POST /api/stop → 수집 중단 ───────────────────────────────────
  if (method === 'POST' && path === '/api/stop') {
    if (activeOrchestrator) {
      activeOrchestrator.stop();
      broadcast('stopped', {});
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // ── GET /api/sessions → 세션 목록 ──────────────────────────────
  if (method === 'GET' && path === '/api/sessions') {
    const db = new AdDatabase(DB_PATH);
    const sessions = db.listSessions();
    db.close();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(sessions));
  }

  // ── GET /api/emails?sessionId=1 → 이메일 목록 ─────────────────
  if (method === 'GET' && path === '/api/emails') {
    const sessionId = parseInt(url.searchParams.get('sessionId') || '0');
    const db = new AdDatabase(DB_PATH);
    const emails = sessionId ? db.getEmailsBySession(sessionId) : db.getAllEmails();
    const stats = sessionId ? db.getStats(sessionId) : null;
    db.close();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ emails, stats }));
  }

  // ── GET /api/export?sessionId=1 → CSV 다운로드 ────────────────
  if (method === 'GET' && path === '/api/export') {
    const sessionId = parseInt(url.searchParams.get('sessionId') || '0') || null;
    const tmpPath = join(process.cwd(), 'data', `export_${Date.now()}.csv`);

    const exporter = new Exporter(DB_PATH);
    exporter.export(sessionId, tmpPath, 'csv');
    exporter.close();

    try {
      const csv = readFileSync(tmpPath);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="naver_ads_emails.csv"`,
      });
      return res.end(csv);
    } catch {
      res.writeHead(404);
      return res.end('데이터 없음');
    }
  }

  // ── GET /api/status ─────────────────────────────────────────────
  if (method === 'GET' && path === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ running: !!activeOrchestrator }));
  }

  res.writeHead(404);
  res.end('Not found');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = createServer(handleRequest);
server.listen(PORT, () => {
  log('info', `웹 UI 시작: http://localhost:${PORT}`);
  console.log(`\n브라우저에서 열기: http://localhost:${PORT}\n`);
});
