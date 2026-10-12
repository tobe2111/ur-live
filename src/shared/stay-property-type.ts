/**
 * 🏨 숙소 **유형 라벨** SSOT (2026-10-12 — 대표 *"모두 다 진행해줘"*).
 *
 * ## 왜 모았나 — 두 벌이 이미 갈려 있었다 (라이브 실측)
 * 같은 숙소의 유형이 **서버 메타와 화면에서 다른 말**을 하고 있었다:
 *
 *     화면(빵부스러기·배지)  `pages/stay-detail/StayInfoSections` 8종 — guesthouse → **스테이**
 *     서버 메타/JSON-LD     `worker/utils/detail-ssr-meta`    5종 — guesthouse → **게스트하우스**
 *                                                                motel·villa·camping → **숙소**
 *
 * 활성 숙소 49건의 분포(D1 실측 2026-10-12): `guesthouse 13 · pension 12 · glamping 12 ·
 * hotel 9 · resort 3`. ⇒ **13건**이 지금 어긋나 있다(서버는 "게스트하우스", 화면은 "스테이").
 * 에러가 안 나고 둘 다 그럴듯해서 재 본 사람만 안다.
 *
 * 🏅 **승자는 화면 쪽**이다 — 시드 SSOT(`admin-stays.routes` `STAY_TYPES`)가 guesthouse 의
 *    `label` 을 `'스테이'` 로 정하고 있고(`kakao: '게스트하우스'` 는 *검색 키워드*이지 표시 라벨이
 *    아니다), 사람과 렌더링 크롤러가 보는 것도 화면이다.
 *
 * ⚠️ 라벨을 고칠 때는 **`STAY_TYPES.label` 과 함께** 고친다(가드가 둘을 대조한다).
 * ⚠️ 모르는 유형은 **원문을 그대로 돌려준다**(`'숙소'` 로 뭉개지 않는다) — 어드민이 새 유형을
 *    넣는 순간 모든 화면이 "숙소" 가 되는 것보다, 영문이라도 그 값이 보이는 쪽이 고치기 쉽다.
 */
export const STAY_PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: '호텔', pension: '펜션', guesthouse: '스테이', resort: '리조트',
  glamping: '글램핑', motel: '모텔', villa: '풀빌라', camping: '캠핑',
}

export function propertyTypeLabel(t?: string | null): string {
  const key = String(t || '').trim().toLowerCase()
  return STAY_PROPERTY_TYPE_LABELS[key] || (t || '숙소')
}
