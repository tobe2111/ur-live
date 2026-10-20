/**
 * 🏷️ 공개 소개글의 **해시태그 후보 추출** — 순수 로직(외부 의존 0 · 부수효과 0).
 *
 *   `influencer-auto-collect.ts` 에서 분리(2026-07-29). 그 파일이 600줄 래칫에 다시 닿았는데,
 *   이 조각은 DB 도 fetch 도 안 쓰는 **순수 문자열 처리**라 애초에 수집 오케스트레이터에 있을 이유가 없다
 *   (`influencer-keyword-rotation.ts`·`influencer-parse.ts` 와 같은 처방 — 순수 조각을 밖으로).
 *
 *   ⚠️ 래칫을 리베이스라인으로 우회하지 않는다. 이 레포가 god 파일을 사후 분해하느라 반복해 쓴 시간이
 *   그 규칙이 생긴 이유다.
 */

/** 해시태그 토큰 — 문자/숫자/밑줄 2~20자. */
const HASHTAG_RE = /#([\p{L}\p{N}_]{2,20})/gu

/**
 * 🛡️ 2026-07-23 전수조사(F-29/30): 범용/참여유도/캠페인 태그는 검색 키워드로 무의미한데 승격되면
 *   하루 100회뿐인 YT 검색 슬롯(신규 키워드 탐색 보장)을 **확정 소모** — 후보 진입 자체를 차단한다.
 */
const HASHTAG_STOP = new Set(['shorts', 'shortsvideo', '쇼츠', '구독', '구독자', '좋아요', '일상', '브이로그', 'vlog', '맞팔', '맞팔환영', '소통', '팔로우', '팔로워', 'follow', 'followme', 'fyp', 'viral', '추천', '추천영상', '광고', '협찬', '내돈내산', '이벤트', '유튜브', 'youtube', '유튜버', '인스타', '인스타그램', 'instagram', '데일리', 'daily', '선팔', '좋테', '구취', '알고리즘', 'subscribe', 'like'])

/** 소개글 → 해시태그 후보(순수 숫자·스톱리스트 제외). 순서 보존, 중복 제거는 호출부 몫. */
export function mineHashtags(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  HASHTAG_RE.lastIndex = 0
  while ((m = HASHTAG_RE.exec(String(text || ''))) !== null) {
    const t = m[1]
    if (/^\d+$/.test(t)) continue                    // 순수 숫자 제외
    if (HASHTAG_STOP.has(t.toLowerCase())) continue  // 범용/참여유도 태그 제외
    out.push(t)
  }
  return out
}
