import { stringify } from 'csv-stringify/sync';
import { writeFileSync } from 'fs';
import { AdDatabase } from '../storage/database.js';
import { log } from '../utils/helpers.js';

/**
 * 수집 결과 CSV/JSON 내보내기
 */
export class Exporter {
  constructor(dbPath) {
    this.db = new AdDatabase(dbPath);
  }

  /**
   * 세션 이메일 결과를 CSV로 내보내기
   * @param {number|null} sessionId - null이면 전체
   * @param {string} outputPath - 출력 파일 경로
   * @param {string} format - 'csv' | 'json'
   */
  export(sessionId, outputPath, format = 'csv') {
    const rows = sessionId
      ? this.db.getEmailsBySession(sessionId)
      : this.db.getAllEmails();

    if (rows.length === 0) {
      log('warn', '내보낼 데이터가 없습니다.');
      return;
    }

    if (format === 'csv') {
      this._exportCsv(rows, outputPath);
    } else {
      this._exportJson(rows, outputPath);
    }

    log('info', `내보내기 완료: ${outputPath} (${rows.length}개)`);
  }

  _exportCsv(rows, outputPath) {
    const data = rows.map(r => ({
      '이메일': r.email,
      '도메인': r.domain,
      '회사명': r.company_name || '',
      '전화번호': r.phone || '',
      '키워드': r.keyword,
      '광고주 URL': r.advertiser_url,
      '수집일시': r.crawled_at,
      '세션': r.session_name || '',
    }));

    const csv = stringify(data, { header: true, bom: true });  // BOM: 엑셀 한글 깨짐 방지
    writeFileSync(outputPath, csv, 'utf8');
  }

  _exportJson(rows, outputPath) {
    writeFileSync(outputPath, JSON.stringify(rows, null, 2), 'utf8');
  }

  printStats(sessionId) {
    const stats = this.db.getStats(sessionId);
    console.log('\n────────────────────────────────');
    console.log(' 수집 통계');
    console.log('────────────────────────────────');
    console.log(` 총 광고주:      ${stats.totalAdvertisers}개`);
    console.log(` 이메일 보유:    ${stats.withEmail}개`);
    console.log(` 고유 이메일:    ${stats.uniqueEmails}개`);
    console.log('────────────────────────────────\n');
  }

  close() {
    this.db.close();
  }
}
