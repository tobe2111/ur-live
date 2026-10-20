#!/usr/bin/env node
/**
 * 네이버 검색광고 이메일 수집기 CLI
 *
 * 사용법:
 *   node src/cli/index.js scrape --keywords "키워드1,키워드2" --session "세션명"
 *   node src/cli/index.js export --session-id 1 --output results.csv
 *   node src/cli/index.js list
 *   node src/cli/index.js stats --session-id 1
 */
import { program } from 'commander';
import { join } from 'path';
import { Orchestrator } from '../queue/orchestrator.js';
import { Exporter } from './export.js';
import { AdDatabase } from '../storage/database.js';
import { log } from '../utils/helpers.js';

const DEFAULT_DB = join(process.cwd(), 'data', 'ads.db');

program
  .name('naver-scraper')
  .description('네이버 검색광고(파워링크) 광고주 이메일 수집기')
  .version('1.0.0');

// ── scrape 명령 ──────────────────────────────────────────────────
program
  .command('scrape')
  .description('키워드로 네이버 광고주 이메일 수집 시작')
  .requiredOption('-k, --keywords <keywords>', '쉼표 구분 키워드 (예: "골프,테니스,헬스")')
  .option('-s, --session <name>', '세션 이름', `수집_${new Date().toISOString().slice(0, 10)}`)
  .option('-d, --db <path>', 'DB 파일 경로', DEFAULT_DB)
  .option('-c, --concurrency <n>', '동시 크롤링 수', '3')
  .option('--headed', '브라우저 창 표시 (디버그용)')
  .option('--proxy <proxies>', '프록시 목록 (쉼표 구분, 예: http://1.2.3.4:8080)')
  .action(async (opts) => {
    const keywords = opts.keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) {
      console.error('키워드를 입력하세요.');
      process.exit(1);
    }

    const proxyList = opts.proxy ? opts.proxy.split(',').map(p => p.trim()) : [];

    console.log(`\n네이버 광고주 이메일 수집 시작`);
    console.log(`세션: ${opts.session}`);
    console.log(`키워드: ${keywords.join(', ')}`);
    console.log(`동시 크롤링: ${opts.concurrency}개\n`);

    const orchestrator = new Orchestrator({
      dbPath: opts.db,
      headless: !opts.headed,
      concurrency: parseInt(opts.concurrency),
      proxyList,
    });

    // Ctrl+C 핸들링
    process.on('SIGINT', () => {
      console.log('\n수집 중단 중...');
      orchestrator.stop();
    });

    try {
      const { sessionId, stats } = await orchestrator.run(opts.session, keywords);
      console.log(`\n✓ 완료! 세션 ID: ${sessionId}`);
      console.log(`  광고주: ${stats.totalAdvertisers}개 | 이메일 보유: ${stats.withEmail}개 | 고유 이메일: ${stats.uniqueEmails}개`);
      console.log(`\n결과 내보내기:\n  node src/cli/index.js export --session-id ${sessionId} --output results.csv\n`);
    } catch (err) {
      console.error('오류:', err.message);
      process.exit(1);
    }
  });

// ── export 명령 ──────────────────────────────────────────────────
program
  .command('export')
  .description('수집 결과 CSV/JSON 내보내기')
  .option('-i, --session-id <id>', '세션 ID (미지정 시 전체)')
  .option('-o, --output <path>', '출력 파일 경로', 'results.csv')
  .option('-f, --format <format>', 'csv 또는 json', 'csv')
  .option('-d, --db <path>', 'DB 파일 경로', DEFAULT_DB)
  .action((opts) => {
    const exporter = new Exporter(opts.db);
    const sessionId = opts.sessionId ? parseInt(opts.sessionId) : null;
    exporter.export(sessionId, opts.output, opts.format);
    if (sessionId) exporter.printStats(sessionId);
    exporter.close();
  });

// ── list 명령 ────────────────────────────────────────────────────
program
  .command('list')
  .description('수집 세션 목록 보기')
  .option('-d, --db <path>', 'DB 파일 경로', DEFAULT_DB)
  .action((opts) => {
    const db = new AdDatabase(opts.db);
    const sessions = db.listSessions();
    db.close();

    if (sessions.length === 0) {
      console.log('수집 기록이 없습니다.');
      return;
    }

    console.log('\n ID │ 세션명              │ 상태    │ 생성일');
    console.log('────┼─────────────────────┼─────────┼────────────────────');
    for (const s of sessions) {
      const name = s.name.padEnd(20);
      const status = s.status.padEnd(7);
      console.log(` ${String(s.id).padStart(2)} │ ${name} │ ${status} │ ${s.created_at}`);
    }
    console.log();
  });

// ── stats 명령 ───────────────────────────────────────────────────
program
  .command('stats')
  .description('세션 통계 보기')
  .requiredOption('-i, --session-id <id>', '세션 ID')
  .option('-d, --db <path>', 'DB 파일 경로', DEFAULT_DB)
  .action((opts) => {
    const exporter = new Exporter(opts.db);
    exporter.printStats(parseInt(opts.session_id || opts.sessionId));
    exporter.close();
  });

program.parse();
