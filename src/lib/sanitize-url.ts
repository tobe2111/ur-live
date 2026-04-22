/**
 * URL sanitization — prevent javascript:/data: URL XSS
 *
 * 사용 사례: seller 가 SNS 링크로 `javascript:alert(1)` 입력 → <a href={url}> 에
 * 그대로 렌더 시 클릭하면 XSS 실행. 화이트리스트 프로토콜만 허용.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 상대 경로는 안전
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return parsed.toString();
    }
    // javascript:, data:, vbscript: 등 → 차단
    return '';
  } catch {
    // 파싱 실패 → https:// 붙여 재시도
    try {
      const withHttps = new URL(`https://${trimmed}`);
      return withHttps.toString();
    } catch {
      return '';
    }
  }
}
