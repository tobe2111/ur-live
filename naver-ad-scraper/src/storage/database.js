import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { log } from '../utils/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMA = `
-- 수집 세션 (키워드 묶음)
CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  keywords    TEXT NOT NULL,  -- JSON array
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  finished_at TEXT,
  status      TEXT NOT NULL DEFAULT 'running'  -- running | done | error
);

-- 수집된 광고주 정보
CREATE TABLE IF NOT EXISTS advertisers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER REFERENCES sessions(id),
  keyword         TEXT NOT NULL,
  title           TEXT,
  advertiser_url  TEXT NOT NULL,
  display_url     TEXT,
  description     TEXT,
  ad_type         TEXT DEFAULT 'powerlink',
  domain          TEXT,
  found_at        TEXT,
  scraped_at      TEXT NOT NULL,
  UNIQUE(session_id, advertiser_url)
);

-- 이메일 수집 결과
CREATE TABLE IF NOT EXISTS crawl_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id   INTEGER REFERENCES advertisers(id),
  domain          TEXT NOT NULL,
  instagram       TEXT,
  biz_reg_no      TEXT,
  company_name    TEXT,
  emails          TEXT,   -- JSON array
  phones          TEXT,   -- JSON array (복수 전화번호)
  kakao_channel   TEXT,
  naver_talk      TEXT,
  crawled_at      TEXT NOT NULL,
  status          TEXT NOT NULL,  -- found | not_found | error | robots_blocked
  error           TEXT,
  UNIQUE(advertiser_id)
);

-- 이메일 개별 레코드 (빠른 검색/중복제거용)
CREATE TABLE IF NOT EXISTS emails (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER REFERENCES sessions(id),
  email         TEXT NOT NULL,
  domain        TEXT,
  company_name  TEXT,
  phone         TEXT,
  instagram     TEXT,
  biz_reg_no    TEXT,
  keyword       TEXT,
  advertiser_url TEXT,
  crawled_at    TEXT NOT NULL,
  UNIQUE(session_id, email)
);

-- 처리 큐
CREATE TABLE IF NOT EXISTS queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER REFERENCES sessions(id),
  type        TEXT NOT NULL,   -- 'scrape' | 'crawl'
  payload     TEXT NOT NULL,   -- JSON
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | error
  attempts    INTEGER DEFAULT 0,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_emails_session ON emails(session_id);
CREATE INDEX IF NOT EXISTS idx_emails_email ON emails(email);
CREATE INDEX IF NOT EXISTS idx_advertisers_domain ON advertisers(domain);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status, session_id);
`;

export class AdDatabase {
  constructor(dbPath) {
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._init();
    log('info', `데이터베이스 연결: ${dbPath}`);
  }

  _init() {
    this.db.exec(SCHEMA);
  }

  // ── 세션 ──────────────────────────────────────────────────────
  createSession(name, keywords) {
    const stmt = this.db.prepare(
      `INSERT INTO sessions (name, keywords) VALUES (?, ?)`
    );
    const result = stmt.run(name, JSON.stringify(keywords));
    return result.lastInsertRowid;
  }

  finishSession(sessionId, status = 'done') {
    this.db.prepare(
      `UPDATE sessions SET status = ?, finished_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(status, sessionId);
  }

  getSession(sessionId) {
    return this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
  }

  listSessions() {
    return this.db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`).all();
  }

  // ── 광고주 ────────────────────────────────────────────────────
  upsertAdvertiser(sessionId, keyword, adResult) {
    const domain = this._extractDomain(adResult.advertiserUrl);
    const stmt = this.db.prepare(`
      INSERT INTO advertisers (session_id, keyword, title, advertiser_url, display_url, description, ad_type, domain, found_at, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, advertiser_url) DO UPDATE SET scraped_at = excluded.scraped_at
    `);
    try {
      const r = stmt.run(
        sessionId, keyword,
        adResult.title, adResult.advertiserUrl, adResult.displayUrl,
        adResult.description, adResult.adType, domain,
        adResult.foundAt, adResult.scrapedAt
      );
      return r.lastInsertRowid || this._getAdvertiserId(sessionId, adResult.advertiserUrl);
    } catch {
      return this._getAdvertiserId(sessionId, adResult.advertiserUrl);
    }
  }

  _getAdvertiserId(sessionId, url) {
    const row = this.db.prepare(
      `SELECT id FROM advertisers WHERE session_id = ? AND advertiser_url = ?`
    ).get(sessionId, url);
    return row?.id;
  }

  // ── 크롤링 결과 ───────────────────────────────────────────────
  saveCrawlResult(advertiserId, sessionId, keyword, crawlResult) {
    const phone = (crawlResult.phones || [])[0] || crawlResult.phone || '';

    this.db.prepare(`
      INSERT INTO crawl_results (advertiser_id, domain, company_name, emails, phones, kakao_channel, naver_talk, instagram, biz_reg_no, crawled_at, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(advertiser_id) DO UPDATE SET
        emails = excluded.emails, phones = excluded.phones,
        status = excluded.status, crawled_at = excluded.crawled_at, error = excluded.error
    `).run(
      advertiserId,
      crawlResult.domain,
      crawlResult.companyName,
      JSON.stringify(crawlResult.emails),
      JSON.stringify(crawlResult.phones || []),
      crawlResult.kakaoChannel,
      crawlResult.naverTalk,
      crawlResult.instagram || '',
      crawlResult.bizRegNo || '',
      crawlResult.crawledAt,
      crawlResult.status,
      crawlResult.error
    );

    // 이메일 개별 저장
    const insertEmail = this.db.prepare(`
      INSERT OR IGNORE INTO emails (session_id, email, domain, company_name, phone, instagram, biz_reg_no, keyword, advertiser_url, crawled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((emails) => {
      for (const email of emails) {
        insertEmail.run(
          sessionId, email,
          crawlResult.domain, crawlResult.companyName, phone,
          crawlResult.instagram || '', crawlResult.bizRegNo || '',
          keyword, crawlResult.url, crawlResult.crawledAt
        );
      }
    });
    insertMany(crawlResult.emails);
  }

  // ── 큐 ───────────────────────────────────────────────────────
  enqueue(sessionId, type, payload) {
    return this.db.prepare(`
      INSERT INTO queue (session_id, type, payload) VALUES (?, ?, ?)
    `).run(sessionId, type, JSON.stringify(payload)).lastInsertRowid;
  }

  dequeue(sessionId, type, limit = 10) {
    const rows = this.db.prepare(`
      SELECT * FROM queue WHERE session_id = ? AND type = ? AND status = 'pending'
      ORDER BY id LIMIT ?
    `).all(sessionId, type, limit);

    if (rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    this.db.prepare(`
      UPDATE queue SET status = 'processing', updated_at = datetime('now', 'localtime')
      WHERE id IN (${ids.map(() => '?').join(',')})
    `).run(...ids);

    return rows.map(r => ({ ...r, payload: JSON.parse(r.payload) }));
  }

  markQueueDone(id) {
    this.db.prepare(
      `UPDATE queue SET status = 'done', updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(id);
  }

  // 파이프라인 모드에서 advertiser_id 기준으로 큐 완료 처리
  markQueueDoneByAdvertiser(advertiserId) {
    this.db.prepare(
      `UPDATE queue SET status = 'done', updated_at = datetime('now', 'localtime')
       WHERE json_extract(payload, '$.advertiserId') = ?`
    ).run(advertiserId);
  }

  markQueueError(id, error) {
    this.db.prepare(
      `UPDATE queue SET status = 'error', error = ?, attempts = attempts + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(error, id);
  }

  countQueue(sessionId, type, status = 'pending') {
    return this.db.prepare(
      `SELECT COUNT(*) as cnt FROM queue WHERE session_id = ? AND type = ? AND status = ?`
    ).get(sessionId, type, status)?.cnt || 0;
  }

  // ── 조회 ─────────────────────────────────────────────────────
  getEmailsBySession(sessionId) {
    return this.db.prepare(`
      SELECT
        e.id, e.email, e.domain, e.company_name, e.phone, e.instagram,
        e.biz_reg_no, e.keyword, e.advertiser_url, e.crawled_at,
        a.title as ad_title, a.description as ad_description, a.ad_type,
        cr.phones, cr.kakao_channel, cr.naver_talk,
        cr.status as crawl_status
      FROM emails e
      LEFT JOIN advertisers a ON a.session_id = e.session_id AND a.advertiser_url = e.advertiser_url
      LEFT JOIN crawl_results cr ON cr.advertiser_id = a.id
      WHERE e.session_id = ?
      ORDER BY e.id
    `).all(sessionId);
  }

  getAllEmails() {
    return this.db.prepare(`
      SELECT
        e.*, s.name as session_name,
        cr.phones, cr.kakao_channel, cr.naver_talk, cr.representative, cr.address
      FROM emails e
      JOIN sessions s ON s.id = e.session_id
      LEFT JOIN advertisers a ON a.session_id = e.session_id AND a.advertiser_url = e.advertiser_url
      LEFT JOIN crawl_results cr ON cr.advertiser_id = a.id
      ORDER BY e.id
    `).all();
  }

  // 이메일 없이 전화/카카오만 있는 광고주도 포함한 전체 수집 결과
  getAllContactsBySession(sessionId) {
    return this.db.prepare(`
      SELECT
        cr.domain, cr.company_name, cr.emails, cr.phones,
        cr.kakao_channel, cr.naver_talk, cr.instagram, cr.biz_reg_no,
        cr.status, cr.crawled_at,
        a.keyword, a.title as ad_title, a.advertiser_url,
        a.description as ad_description
      FROM crawl_results cr
      JOIN advertisers a ON a.id = cr.advertiser_id
      WHERE a.session_id = ?
      ORDER BY cr.id
    `).all(sessionId);
  }

  getStats(sessionId) {
    const total = this.db.prepare(`SELECT COUNT(*) as cnt FROM advertisers WHERE session_id = ?`).get(sessionId)?.cnt;
    const withEmail = this.db.prepare(`SELECT COUNT(*) as cnt FROM crawl_results WHERE advertiser_id IN (SELECT id FROM advertisers WHERE session_id = ?) AND status = 'found'`).get(sessionId)?.cnt;
    const emails = this.db.prepare(`SELECT COUNT(*) as cnt FROM emails WHERE session_id = ?`).get(sessionId)?.cnt;
    return { totalAdvertisers: total, withEmail, uniqueEmails: emails };
  }

  _extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  close() {
    this.db.close();
  }
}
