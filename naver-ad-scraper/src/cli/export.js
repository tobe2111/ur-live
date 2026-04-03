import { stringify } from 'csv-stringify/sync';
import { writeFileSync } from 'fs';
import { AdDatabase } from '../storage/database.js';
import { log } from '../utils/helpers.js';

/**
 * 수집 결과 내보내기
 *
 * 두 가지 시트/파일:
 *  1. 이메일 목록 (이메일 있는 것만, 한 행 = 이메일 1개)
 *  2. 전체 광고주 (이메일 없어도 전화/카카오 있으면 포함)
 */
export class Exporter {
  constructor(dbPath) {
    this.db = new AdDatabase(dbPath);
  }

  /**
   * @param {number|null} sessionId
   * @param {string} outputPath
   * @param {'csv'|'json'|'all'} format
   *   'all' → 이메일CSV + 전체연락처CSV 두 파일 생성
   */
  export(sessionId, outputPath, format = 'csv') {
    if (format === 'all') {
      this._exportEmailsCsv(sessionId, outputPath.replace('.csv', '_이메일.csv'));
      this._exportAllContactsCsv(sessionId, outputPath.replace('.csv', '_전체연락처.csv'));
    } else if (format === 'json') {
      this._exportJson(sessionId, outputPath);
    } else {
      this._exportEmailsCsv(sessionId, outputPath);
    }
  }

  /** 이메일 있는 행만 CSV */
  _exportEmailsCsv(sessionId, path) {
    const rows = sessionId
      ? this.db.getEmailsBySession(sessionId)
      : this.db.getAllEmails();

    if (rows.length === 0) {
      log('warn', '이메일 데이터 없음');
      return;
    }

    const data = rows.map(r => {
      let phones = r.phone || '';
      try { const arr = JSON.parse(r.phones || '[]'); if (arr.length) phones = arr.join(' / '); } catch {}

      return {
        '이메일':          r.email,
        '회사명':          r.company_name || '',
        '대표자':          r.representative || '',
        '전화번호':        phones,
        '카카오채널':      r.kakao_channel || '',
        '네이버톡톡':      r.naver_talk || '',
        '인스타그램':      r.instagram || '',
        '사업자번호':      r.biz_reg_no || '',
        '주소':            r.address || '',
        '도메인':          r.domain || '',
        '광고 키워드':     r.keyword || '',
        '광고 제목':       r.ad_title || '',
        '광고주 URL':      r.advertiser_url || '',
        '수집일시':        r.crawled_at || '',
      };
    });

    // BOM 포함 UTF-8 → 엑셀에서 한글 깨짐 없음
    const csv = '\uFEFF' + stringify(data, { header: true });
    writeFileSync(path, csv, 'utf8');
    log('info', `이메일 CSV: ${path} (${rows.length}개)`);
  }

  /** 이메일 없어도 연락처 있는 모든 광고주 CSV */
  _exportAllContactsCsv(sessionId, path) {
    const rows = sessionId
      ? this.db.getAllContactsBySession(sessionId)
      : [];

    if (rows.length === 0) {
      log('warn', '전체 연락처 데이터 없음');
      return;
    }

    const data = rows.map(r => {
      let emails = '';
      try { emails = JSON.parse(r.emails || '[]').join(' / '); } catch {}
      let phones = '';
      try { phones = JSON.parse(r.phones || '[]').join(' / '); } catch {}

      return {
        '이메일':          emails,
        '회사명':          r.company_name || '',
        '대표자':          r.representative || '',
        '전화번호':        phones,
        '카카오채널':      r.kakao_channel || '',
        '네이버톡톡':      r.naver_talk || '',
        '인스타그램':      r.instagram || '',
        '사업자번호':      r.biz_reg_no || '',
        '주소':            r.address || '',
        '도메인':          r.domain || '',
        '광고 키워드':     r.keyword || '',
        '광고 제목':       r.ad_title || '',
        '광고주 URL':      r.advertiser_url || '',
        '수집 상태':       r.status || '',
        '수집일시':        r.crawled_at || '',
      };
    });

    const csv = '\uFEFF' + stringify(data, { header: true });
    writeFileSync(path, csv, 'utf8');
    log('info', `전체 연락처 CSV: ${path} (${rows.length}개)`);
  }

  _exportJson(sessionId, path) {
    const rows = sessionId
      ? this.db.getAllContactsBySession(sessionId)
      : this.db.getAllEmails();
    writeFileSync(path, JSON.stringify(rows, null, 2), 'utf8');
    log('info', `JSON 내보내기: ${path} (${rows.length}개)`);
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

  close() { this.db.close(); }
}
