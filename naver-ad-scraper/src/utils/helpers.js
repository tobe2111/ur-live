import { USER_AGENTS, EMAIL_REGEX, EXCLUDED_EMAIL_DOMAINS } from './constants.js';

/**
 * 랜덤 딜레이 (ms)
 */
export function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * sleep
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 랜덤 User-Agent 반환
 */
export function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * URL에서 도메인 추출
 */
export function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * 텍스트에서 이메일 추출 (중복 제거 + 필터링)
 */
export function extractEmails(text) {
  if (!text) return [];
  const found = text.match(EMAIL_REGEX) || [];
  const unique = [...new Set(found.map(e => e.toLowerCase()))];
  return unique.filter(email => {
    const domain = email.split('@')[1] || '';
    return !EXCLUDED_EMAIL_DOMAINS.some(ex => domain.includes(ex) || email.includes(ex));
  });
}

/**
 * URL 정규화
 */
export function normalizeUrl(url, baseUrl) {
  try {
    if (!url) return null;
    if (url.startsWith('//')) url = 'https:' + url;
    const resolved = new URL(url, baseUrl);
    // 동일 도메인만 허용
    if (baseUrl) {
      const base = new URL(baseUrl);
      if (resolved.hostname !== base.hostname) return null;
    }
    // 불필요한 파라미터 제거
    resolved.search = '';
    resolved.hash = '';
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * 네이버 리다이렉트 URL에서 실제 광고주 URL 추출
 */
export function resolveNaverAdUrl(href) {
  if (!href) return null;
  try {
    // 네이버 광고 클릭 추적 URL 처리
    // 예: https://lavad.naver.com/... → 실제 URL
    if (href.includes('lavad.naver.com') || href.includes('nclk.naver.com')) {
      const urlParam = new URL(href).searchParams.get('url');
      if (urlParam) return decodeURIComponent(urlParam);
    }
    return href;
  } catch {
    return href;
  }
}

/**
 * 지수 백오프로 retry
 */
export async function withRetry(fn, maxRetries = 3, baseDelay = 2000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

/**
 * 로그 포매터
 */
export function log(level, message, data = '') {
  const ts = new Date().toISOString();
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERR ]', debug: '[DBG ]' }[level] || '[LOG ]';
  const extra = data ? ` | ${typeof data === 'object' ? JSON.stringify(data) : data}` : '';
  console.log(`${ts} ${prefix} ${message}${extra}`);
}
