import PQueue from 'p-queue';
import { BrowserPool, PageSession } from '../scraper/browser.js';
import { NaverAdScraper } from '../scraper/naverAdScraper.js';
import { EmailCrawler } from '../crawler/emailCrawler.js';
import { AdDatabase } from '../storage/database.js';
import { DEFAULT_DELAY, CONCURRENT_CRAWLERS } from '../utils/constants.js';
import { sleep, randomDelay, log } from '../utils/helpers.js';
import { join } from 'path';

/**
 * 전체 수집 파이프라인 오케스트레이터
 *
 * 파이프라인:
 *  키워드 → [네이버 광고 스크래핑] → 광고주 URL 큐 → [이메일 크롤링] → DB 저장
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
  }

  /**
   * 수집 시작
   * @param {string} sessionName - 세션 이름
   * @param {string[]} keywords - 검색 키워드 배열
   */
  async run(sessionName, keywords) {
    this.sessionId = this.db.createSession(sessionName, keywords);
    log('info', `세션 시작: "${sessionName}" (ID: ${this.sessionId})`);
    log('info', `키워드 ${keywords.length}개: ${keywords.join(', ')}`);

    this.browserPool = new BrowserPool({
      maxBrowsers: 1,  // 네이버는 1개 브라우저로 순차 처리 (봇 감지 최소화)
      headless: this.options.headless,
      proxyList: this.options.proxyList,
    });

    this.crawlQueue = new PQueue({ concurrency: this.options.concurrency });

    try {
      await this.browserPool.launch();

      // Phase 1: 키워드별 네이버 광고 스크래핑
      await this._scrapeAllKeywords(keywords);

      // Phase 2: 이메일 크롤링
      await this._crawlAllAdvertisers();

      // 완료
      const stats = this.db.getStats(this.sessionId);
      this.db.finishSession(this.sessionId, 'done');
      log('info', `세션 완료! 광고주: ${stats.totalAdvertisers}개, 이메일 보유: ${stats.withEmail}개, 총 이메일: ${stats.uniqueEmails}개`);
      return { sessionId: this.sessionId, stats };
    } catch (err) {
      this.db.finishSession(this.sessionId, 'error');
      log('error', '세션 오류', err.message);
      throw err;
    } finally {
      await this.browserPool.close();
    }
  }

  async _scrapeAllKeywords(keywords) {
    const context = await this.browserPool.newContext(0);
    const session = new PageSession(context);
    const scraper = new NaverAdScraper(session);

    for (let i = 0; i < keywords.length; i++) {
      if (this._stopped) break;
      const keyword = keywords[i];
      log('info', `[${i + 1}/${keywords.length}] 키워드 스크래핑: "${keyword}"`);

      try {
        const ads = await scraper.scrapeKeyword(keyword);
        for (const ad of ads) {
          ad.keyword = keyword;
          const advertiserId = this.db.upsertAdvertiser(this.sessionId, keyword, ad);
          // 이메일 크롤링 큐에 추가
          if (advertiserId) {
            this.db.enqueue(this.sessionId, 'crawl', {
              advertiserId,
              url: ad.advertiserUrl,
              keyword,
            });
          }
        }
        this._reportProgress('scrape', i + 1, keywords.length, keyword, ads.length);
      } catch (err) {
        log('error', `키워드 스크래핑 실패: "${keyword}"`, err.message);
      }

      // 키워드 간 딜레이 (봇 감지 방지)
      if (i < keywords.length - 1) {
        await sleep(randomDelay(...DEFAULT_DELAY.betweenKeywords));
      }
    }

    await session.close();
  }

  async _crawlAllAdvertisers() {
    const totalPending = this.db.countQueue(this.sessionId, 'crawl', 'pending');
    log('info', `이메일 크롤링 시작: 총 ${totalPending}개 광고주`);

    let processed = 0;
    const processBatch = async () => {
      const batch = this.db.dequeue(this.sessionId, 'crawl', this.options.concurrency * 2);
      return batch;
    };

    let batch;
    while ((batch = await processBatch()).length > 0 && !this._stopped) {
      await Promise.all(
        batch.map(item =>
          this.crawlQueue.add(async () => {
            const context = await this.browserPool.newContext(0);
            const session = new PageSession(context);
            const crawler = new EmailCrawler(session);

            try {
              const result = await crawler.crawl(item.payload.url);
              this.db.saveCrawlResult(
                item.payload.advertiserId,
                this.sessionId,
                item.payload.keyword,
                result
              );
              this.db.markQueueDone(item.id);
              processed++;
              this._reportProgress('crawl', processed, totalPending, item.payload.url, result.emails.length);

              // 딜레이
              await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
            } catch (err) {
              this.db.markQueueError(item.id, err.message);
            } finally {
              await session.close();
            }
          })
        )
      );

      await this.crawlQueue.onIdle();
    }

    log('info', `이메일 크롤링 완료: ${processed}개 처리`);
  }

  _reportProgress(phase, current, total, item, found) {
    const pct = Math.round((current / total) * 100);
    const msg = phase === 'scrape'
      ? `[광고수집 ${pct}%] "${item}": 광고주 ${found}개`
      : `[이메일수집 ${pct}%] ${item}: 이메일 ${found}개`;

    log('info', msg);
    if (this.options.onProgress) {
      this.options.onProgress({ phase, current, total, pct, item, found });
    }
  }

  stop() {
    this._stopped = true;
    if (this.crawlQueue) this.crawlQueue.clear();
    log('info', '수집 중단 요청됨');
  }
}
