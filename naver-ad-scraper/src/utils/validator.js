import { promises as dnsPromises } from 'dns';

// MX 레코드 캐시 (도메인별, 세션 내 재사용)
const mxCache = new Map();

/**
 * 이메일 도메인의 MX 레코드 확인
 * → 실제로 이메일을 받을 수 있는 도메인인지 검증
 * LLM 없이 DNS lookup만으로 유효성 확인
 */
export async function isValidEmailDomain(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain);

  try {
    const records = await dnsPromises.resolveMx(domain);
    const valid = records.length > 0;
    mxCache.set(domain, valid);
    return valid;
  } catch {
    // NXDOMAIN, ENOTFOUND → 유효하지 않은 도메인
    mxCache.set(domain, false);
    return false;
  }
}

/**
 * 이메일 배열을 MX 검증하여 유효한 것만 반환
 * 타임아웃 3초 (느린 DNS 서버 대응)
 */
export async function filterValidEmails(emails) {
  const results = await Promise.all(
    emails.map(async email => {
      try {
        const valid = await Promise.race([
          isValidEmailDomain(email),
          new Promise(resolve => setTimeout(() => resolve(true), 3000)), // 타임아웃 시 통과
        ]);
        return valid ? email : null;
      } catch {
        return email; // DNS 오류 시 통과 (보수적)
      }
    })
  );
  return results.filter(Boolean);
}

/**
 * 한국 사업자등록번호 체크섬 검증
 * (수집된 사업자번호가 유효한 형식인지 확인)
 */
export function isValidBizRegNo(no) {
  const digits = no.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * weights[i];
  sum += Math.floor((parseInt(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === parseInt(digits[9]);
}
