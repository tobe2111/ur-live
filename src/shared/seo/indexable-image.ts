/**
 * 🔒 색인해도 되는 사진인가 — sitemap `<image:image>` 의 단일 판정.
 *
 * ## 왜 있나 (2026-10-11 실측 — 가정 아님)
 * 라이브 `sitemap.xml` 이 **사업자등록증 PNG 를 구글 이미지에 색인 요청하고 있었다**:
 *
 *   <loc>https://urdeal.kr/pass/2916</loc>
 *   <image:loc>https://urdeal.kr/api/media/uploads/biz-cert/2026-09/C7QDtf…png</image:loc>
 *
 * 그 상품(S-BROKER 실결제 테스트용)의 커버로 사업자등록증이 들어가 있었고, sitemap 은
 * `products.image_url` 을 **그대로** 실어 보냈다. 사업자등록증에는 대표자 성명·사업장 주소·
 * 사업자번호가 적혀 있다.
 *
 * ⚠️ 이 노출이 특히 나쁜 이유: 2026-06-11 에 R2 버킷을 공개로 돌리면서 biz-cert 의 방어를
 * **"16자 랜덤키(~95bit)라 추측 불가"** 하나로 두었다(CLAUDE.md audit log). sitemap 은 그
 * 추측 불가능한 URL 을 **검색엔진에 직접 건네준다** — 유일한 방어를 정면으로 무효화한다.
 * 그리고 색인은 배포로 못 되돌린다(회수 시점의 통제권이 검색엔진에 있다).
 *
 * ## 판정
 * **거부 목록**(allowlist 아님)이다. allowlist 로 하면 새 업로드 접두사가 생길 때마다
 * 멀쩡한 상품 사진이 **조용히** 색인에서 빠진다 — 이 레포가 반복해 당한 "실패가 아니라 부재".
 * 거부 목록은 반대 방향으로 틀리지만(새 비공개 접두사를 놓친다) 그쪽은
 * `indexable-image.test.ts` 가 **분류되지 않은 `uploads/<접두사>/` 가 나타나면 빨간불**로 잡는다.
 */

/** 서류 업로드 — 카탈로그 사진이 아니다. 어느 것도 검색엔진에 넘기지 않는다. */
export const PRIVATE_UPLOAD_PREFIXES = [
  'biz-cert',   // 사업자등록증
  'biz',        // 사업자 서류 일반
  'id-card',    // 신분증
  'settlement', // 정산 서류
  'tax',        // 세금계산서·원천징수
  'contract',   // 계약서
  'document',   // 기타 제출 서류
  'verification', // 본인·매장 인증 자료
] as const

/** 카탈로그 사진이 사는 곳 — 테스트가 "분류됨" 으로 인정하는 접두사. */
export const CATALOG_UPLOAD_PREFIXES = [
  'demo', 'seller', 'user', 'admin', 'district', 'product', 'blog', 'mall',
  'voucher', // 2026-10-31 R2 로 옮긴 교환권 사진(cron/voucher-image-rehost)
  'sized',   // 2026-11-01 크기별로 미리 저장한 상품 사진(shared/sized-image)
] as const

/**
 * 이 URL 을 sitemap `<image:loc>` 로 내보내도 되는가.
 *
 * 빈 값/비문자열은 **false**(내보낼 것이 없다). 비공개 업로드 경로면 false.
 * 그 밖에는 true — 외부 CDN·cdn-cgi 변환본·OG 카드 전부 통과한다.
 */
export function isIndexableImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  const u = url.trim()
  if (!u) return false

  // 경로만 본다(쿼리·프래그먼트의 비슷한 문자열에 걸리지 않게).
  // cdn-cgi 변환본은 원본 URL 을 **경로 안에** 품으므로(`/cdn-cgi/image/opts/https://host/uploads/biz-cert/…`)
  // 경로 전체를 검사해야 한다 — 호스트만 보면 통째로 샌다.
  let path = u
  const hash = path.indexOf('#'); if (hash >= 0) path = path.slice(0, hash)
  const q = path.indexOf('?'); if (q >= 0) path = path.slice(0, q)

  const lower = path.toLowerCase()
  for (const p of PRIVATE_UPLOAD_PREFIXES) {
    if (lower.includes(`/uploads/${p}/`)) return false
  }
  return true
}
