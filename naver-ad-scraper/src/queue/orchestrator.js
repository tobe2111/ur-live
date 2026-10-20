import PQueue from 'p-queue';
import { BrowserPool, PageSession } from '../scraper/browser.js';
import { NaverAdScraper } from '../scraper/naverAdScraper.js';
import { EmailCrawler } from '../crawler/emailCrawler.js';
import { AdDatabase } from '../storage/database.js';
import { DEFAULT_DELAY, CONCURRENT_CRAWLERS } from '../utils/constants.js';
import { sleep, randomDelay, log } from '../utils/helpers.js';
import { join } from 'path';

/**
 * 전체 수집 파이프라인 오케스트레이터 (최종판)
 *
 * 개선사항:
 *  - 도메인 레벨 중복 제거: 동일 도메인은 세션 내 한 번만 크롤링
 *  - 키워드 스크래핑 중에도 이메일 크롤링 병행 (파이프라인)
 *  - 진행 상황 실시간 리포팅
 */
export class Orchestrator {
  constructor(options = {}) {
    this.options = {
      dbPath: options.dbPath || join(process.cwd(), 'data', 'ads.db'),
      headless: options.headless !== false,
      concurrency: options.concurrency || CONCURRENT_CRAWLERS,
      proxyList: options.proxyList || [],
      onProgress: options.onProgress || null,
    };
    this.db = new AdDatabase(this.options.dbPath);
    this.browserPool = null;
    this.crawlQueue = null;
    this.sessionId = null;
    this._stopped = false;

    // 세션 내 크롤링된 도메인 추적 (중복 방지)
    this._crawledDomains = new Set();
  }

  async run(sessionName, keywords) {
    this._crawledDomains.clear();
    this.sessionId = this.db.createSession(sessionName, keywords);
    log('info', `세션 시작: "${sessionName}" (ID: ${this.sessionId})`);
    log('info', `키워드 ${keywords.length}개: ${keywords.join(', ')}`);

    this.browserPool = new BrowserPool({
      maxBrowsers: 1,
      headless: this.options.headless,
      proxyList: this.options.proxyList,
    });

    this.crawlQueue = new PQueue({ concurrency: this.options.concurrency });

    try {
      await this.browserPool.launch();

      // 스크래핑과 크롤링을 파이프라인으로 동시 진행
      // (스크래핑 완료를 기다리지 않고 발견 즉시 크롤링 시작)
      await this._runPipeline(keywords);

      const stats = this.db.getStats(this.sessionId);
      this.db.finishSession(this.sessionId, 'done');
      log('info', `완료! 광고주: ${stats.totalAdvertisers}개 | 이메일 보유: ${stats.withEmail}개 | 고유 이메일: ${stats.uniqueEmails}개`);
      return { sessionId: this.sessionId, stats };
    } catch (err) {
      this.db.finishSession(this.sessionId, 'error');
      log('error', '세션 오류', err.message);
      throw err;
    } finally {
      await this.browserPool.close();
    }
  }

  async _runPipeline(keywords) {
    const context = await this.browserPool.newContext(0);
    const scraperSession = new PageSession(context);
    const scraper = new NaverAdScraper(scraperSession);

    let scraped = 0;
    let crawled = 0;
    let totalQueued = 0;

    // 키워드 순차 스크래핑 (네이버 봇 감지 최소화)
    for (let i = 0; i < keywords.length; i++) {
      if (this._stopped) break;
      const keyword = keywords[i];
      log('info', `[${i + 1}/${keywords.length}] "${keyword}" 광고 수집 중...`);

      try {
        const ads = await scraper.scrapeKeyword(keyword);
        scraped += ads.length;

        for (const ad of ads) {
          const domain = ad.domain;

          // ★ 도메인 중복 제거: 같은 도메인은 이미 크롤링했으면 스킵
          if (domain && this._crawledDomains.has(domain)) {
            log('debug', `도메인 중복 스킵: ${domain}`);
            // DB에 광고주는 기록 (키워드 연결용)
            this.db.upsertAdvertiser(this.sessionId, keyword, ad);
            continue;
          }
          if (domain) this._crawledDomains.add(domain);

          const advertiserId = this.db.upsertAdvertiser(this.sessionId, keyword, ad);
          if (advertiserId) {
            this.db.enqueue(this.sessionId, 'crawl', { advertiserId, url: ad.advertiserUrl, keyword, domain });
            totalQueued++;

            // 발견 즉시 크롤링 큐에 투입 (파이프라인)
            this.crawlQueue.add(async () => {
              if (this._stopped) return;
              const ctx = await this.browserPool.newContext(0);
              const sess = new PageSession(ctx);
              const crawler = new EmailCrawler(sess);
              try {
                const result = await crawler.crawl(ad.advertiserUrl);
                this.db.saveCrawlResult(advertiserId, this.sessionId, keyword, result);
                this.db.markQueueDoneByAdvertiser(advertiserId);
                crawled++;
                this._report('crawl', crawled, totalQueued, ad.advertiserUrl, result.emails.length);
                await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
              } catch (err) {
                log('warn', `크롤링 실패: ${ad.advertiserUrl}`, err.message);
              } finally {
                await sess.close();
              }
            });
          }
        }

        this._report('scrape', i + 1, keywords.length, keyword, ads.length);
      } catch (err) {
        log('error', `스크래핑 실패: "${keyword}"`, err.message);
      }

      if (i < keywords.length - 1) {
        await sleep(randomDelay(...DEFAULT_DELAY.betweenKeywords));
      }
    }

    await scraperSession.close();

    // 모든 크롤링 완료 대기
    log('info', `스크래핑 완료 (광고주 ${scraped}개). 이메일 크롤링 완료 대기 중...`);
    await this.crawlQueue.onIdle();
    log('info', `이메일 크롤링 완료: ${crawled}개 처리`);
  }

  _report(phase, current, total, item, found) {
    const pct = Math.round((current / total) * 100);
    if (phase === 'scrape') {
      log('info', `[광고수집 ${pct}%] "${item}": ${found}개`);
    } else {
      const domain = item.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      log('info', `[크롤링 ${pct}%] ${domain}: 이메일 ${found}개`);
    }
    this.options.onProgress?.({ phase, current, total, pct, item, found });
  }

  stop() {
    this._stopped = true;
    this.crawlQueue?.clear();
    log('info', '수집 중단 요청됨');
  }
}
