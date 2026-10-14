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

/**
 * 🏨 유형별 **소개 문구** SSOT (2026-10-14 — 대표 *"또 개선점 찾아보자. SEO 와 GEO 부분에서"*).
 *
 * ## 왜 여기로 모았나
 * 이 값들은 `admin-stays.routes` `STAY_TYPES[].desc` 에 있었고 그 파일은 **어드민 라우트**다.
 * 그래서 *같은 문구가 필요한 다른 경로*(정비 cron)가 그걸 가져다 쓸 수 없었다 — 아래 사고가
 * 거기서 나왔다.
 *
 * 🩸 **라이브 실측(2026-10-14): 이 치유가 한 번도 안 돌았다.**
 *    색인 대상 표본 79건 중 **74건(93%)**의 meta description 에 줄표가 있었고, 숙소 49건은
 *    `춘천의 호텔 — 접근성 좋은 호텔 — 깔끔한 룸 컨디션과 24시간 프런트.` 꼴 그대로였다 —
 *    **2026-08-31 대표가 "AI 티" 로 직접 지적한 그 문장**이다(한 문장에 '호텔' 둘, 줄표 둘).
 *    고치는 코드(`heal-stay-descriptions.ts`)는 그때 쓰여 2026-09-14 에 강화되고 시험까지 붙었는데,
 *    **호출처가 어드민 재시드 POST 하나뿐**이라 아무도 누르지 않아 영영 안 돌았다
 *    (`/api/group-buy/stays/2732` 실측: `description` 빈 문자열 · `description_full` 옛 문장).
 *    ⇒ **치유 코드를 쓰는 것과 그 코드가 도는 경로에 두는 것은 다른 일이다.**
 *
 * ⚠️ 문구를 고칠 때는 **`STAY_TYPES[].desc` 가 이 표를 읽고 있는지** 확인할 것(가드가 대조한다).
 * ⚠️ 줄표(`—`)를 넣지 말 것 — 이 문구는 색인 대상 49건의 meta description 이 된다
 *    (anti-slop: 줄표는 가장 많이 지적되는 AI 티이고, `check-anti-slop-copy` 는 이 파일을 본다).
 */
export const STAY_PROPERTY_TYPE_DESCS: Record<string, string> = {
  pension: '테라스에서 바비큐를 할 수 있는 독채형 펜션입니다. 옆 동과 떨어져 있어 조용히 쉬기 좋아요.',
  hotel: '역과 시내에서 가까워 이동이 편합니다. 룸 컨디션이 깔끔하고 프런트는 24시간 운영해요.',
  guesthouse: '조용한 골목 안에 있는 작은 스테이입니다. 동네를 천천히 걸어 보기 좋은 자리예요.',
  resort: '온수풀과 사우나를 갖춰 아이와 함께 가기 좋습니다. 부대시설만으로 하루가 채워져요.',
  glamping: '장비를 챙길 필요가 없는 글램핑입니다. 개별 화로가 있고 텐트에 냉난방이 들어와요.',
}

/** 모르는 유형은 호텔 문구로 — 치유가 **대상을 건너뛰면** 옛 문장이 그대로 남는다(그게 더 나쁘다). */
export function propertyTypeDesc(t?: string | null): string {
  const key = String(t || '').trim().toLowerCase()
  return STAY_PROPERTY_TYPE_DESCS[key] || STAY_PROPERTY_TYPE_DESCS.hotel!
}

/** 치유 호출부가 받는 모양(`{type, desc}[]`) — 두 곳이 같은 표에서 만든다. */
export const STAY_TYPE_DESC_LIST: ReadonlyArray<{ type: string; desc: string }> =
  Object.entries(STAY_PROPERTY_TYPE_DESCS).map(([type, desc]) => ({ type, desc }))
