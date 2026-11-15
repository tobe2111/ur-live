/**
 * 🧬 주입 — 외국 유튜버 수집 (2026-11-15 대표 결정: 나라별 일반 인플루언서 · 하루 10번 · 영/중/일/동남아)
 *    가드: src/tests/unit/influencer-yt-foreign-2026-11-15.test.ts
 */
const T = 'src/tests/unit/influencer-yt-foreign-2026-11-15.test.ts'
const F = 'src/features/marketing/api/influencer-yt-foreign.ts'
const C = 'src/features/marketing/api/influencer-auto-collect.ts'
export default [
  { name: '외국유튜브 — 한국 상한에서 외국 몫을 안 뺀다', file: C,
    find: 'const ytBudgetTotal = Math.max(0, ytTotalCap - foreignYtReserve(settings[YT_FOREIGN_KEY], ytDay, env))',
    replace: 'const ytBudgetTotal = ytTotalCap', test: T,
    why: '한국 수집이 오전에 90번을 다 써서 외국 몫이 매일 0 이 된다(에러 없이).' },
  { name: '외국유튜브 — 진행값을 안 쓴다', file: C,
    find: ' [YT_FOREIGN_KEY, foreign.state],', replace: '', test: T,
    why: '하루 몫·누적 순번이 저장되지 않아 매 회차 같은 키워드를, 상한 없이 부른다.' },
  { name: '외국유튜브 — 하루 몫 검사를 뺀다', file: F,
    find: '|| st.usedToday >= foreignBudget(env) ', replace: '', test: T,
    why: '외국 검색이 하루 10번을 넘어 한국 수집 몫을 잠식한다.' },
  { name: '외국유튜브 — 지역·언어를 안 넘긴다', file: F,
    find: ', regionCode: pick.region, relevanceLanguage: pick.lang,', replace: ',', test: T,
    why: '외국 키워드를 한국 지역·한국어로 물어 외국 채널이 거의 안 나온다.' },
]
