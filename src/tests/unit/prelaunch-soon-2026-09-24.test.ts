/**
 * 🌱 **오픈 예정 모아보기(`/soon`)** — 2026-09-24 대표 문서 ⑤ *"단독공개 / 공개예정 페이지가
 * 있었으면 좋겠음"*.
 *
 * ## 엔진은 이미 있었다
 * 2026-07-05 대표 지시로 들어온 `prelaunch` 모델 — 어드민 `mode='prelaunch'` → 상세가
 * "오픈 예정 · 사전 응모 받는 중" 배지를 그리고, 가짜 후기 시더가 그 상품을 제외한다.
 * **2026-09-24 D1 실측: 활성 8건**(2498~2505)이 일반 피드에 흩어져 있었다.
 * 없던 것은 **모아 보는 화면**이고, 그래서 화면과 그 화면만을 위한 경로를 새로 만들었다.
 *
 * ## 🔒 이 시험이 지키는 가장 중요한 것 — 잠긴 피드를 안 건드린다
 * 소비자 피드(`group-buy-public.routes.ts`)는 **로딩 최적화 잠금** 대상이다. 그 응답은 `prelaunch`
 * 플래그를 **내려준다**(fcfs 상품 한정 — 실측 8건 전부 해당). 없는 것은 플래그가 아니라
 * **'오픈 예정만 달라'고 물을 방법**이다 — 그 라우트의 필터는 `status`·`category`·`sort` 화이트리스트뿐이고,
 * 거기에 값을 하나 더하면 **캐시키가 갈린다**(SSR 0-RTT·엣지캐시 계약 — 대표 승인 사항).
 * ⇒ 별도 경로로 뺐고, 이 시험이 그 경계를 고정한다.
 *
 * ## 이 시험이 **못 하는 것**
 * 라이브에 오픈 예정 상품이 실제로 몇 건인지 모른다(D1 실측은 사람이 했다).
 * 그리고 빈 목록일 때 화면이 "예뻐 보이는지"도 판정하지 못한다 — 막다른 골목이 아닌지만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const ROUTE = 'src/features/group-buy/api/prelaunch.routes.ts'
const FEED = 'src/features/group-buy/api/group-buy-public.routes.ts'
const WORKER = 'src/worker/index.ts'
const PAGE = 'src/pages/SoonPage.tsx'
const APP = 'src/App.tsx'
const FOOTER = 'src/components/main/SiteFooter.tsx'

describe('잠긴 피드 라우트를 건드리지 않는다', () => {
  it('피드는 prelaunch 를 표시만 할 뿐 그것으로 **거르지는** 못한다 — 그래서 별도 경로다', () => {
    /* 🩸 이 자리에서 **두 번** 틀렸고 두 번 다 D1 실측이 고쳤다. 기록해 둔다:
         1판 "피드가 prelaunch 를 아예 안 내려준다" → 틀림. 2026-07-05 부터 내려준다.
         2판 "내려주긴 하는데 실측 8건은 fcfs 가 아니라 안 실린다" → **이것도 틀림.**
              D1 실측(2026-09-24): 활성 prelaunch 8건(2498~2505) **전부 fcfs_enabled='1'** 이라
              라이브 피드 응답에 플래그가 실제로 실려 있다.
       ⇒ 별도 경로의 진짜 이유는 **읽기가 아니라 고르기**다. 피드의 필터는 화이트리스트
         (`status`·`category`·`sort`)뿐이라 "오픈 예정만" 을 물을 수 없고, 값을 더하면 캐시키가 갈린다.
       이 시험은 그 두 사실을 고정한다 — (a) 표시는 fcfs 게이트 안쪽이고 (b) 필터는 화이트리스트다.
       둘 중 하나가 바뀌면 이 별도 경로의 존재 이유를 다시 따져야 한다. */
    const feed = readCode(FEED)
    expect(feed).toContain('if (!enabledSet.has(pid)) return p')
    expect(feed).toContain("rec.prelaunch === '1' ? { prelaunch: true }")
    // 정렬 화이트리스트는 있는데 prelaunch 를 고르는 값은 없다 — 있으면 별도 경로가 필요 없었다.
    expect(feed).toContain('const ALLOWED_GB_SORT')
    expect(feed).not.toMatch(/ALLOWED_GB_SORT[\s\S]{0,400}prelaunch\s*:/)
    expect(feed).not.toMatch(/req\.query\(['"]prelaunch['"]\)/)
  })

  it('오픈 예정 목록은 자기 파일에서 나온다', () => {
    const r = readCode(ROUTE)
    expect(r).toMatch(/app\.get\('\/prelaunch'/)
    expect(r).toContain("key = 'prelaunch'")
  })

  it('워커에 마운트돼 있다 — 파일만 있고 안 걸리면 404 다', () => {
    const w = readCode(WORKER)
    expect(w).toContain('prelaunchRoutes')
    expect(w).toMatch(/app\.route\('\/api\/group-buy',\s*prelaunchRoutes\)/)
  })
})

describe('목록 쿼리가 소비자 노출 규칙을 지킨다', () => {
  const r = readCode(ROUTE)
  it('비활성 상품을 내보내지 않는다', () => {
    expect(r).toContain('p.is_active = 1')
  })
  it('승인 안 된 매장 상품을 내보내지 않는다 (2026-09-16 대표 지시 승계)', () => {
    expect(r).toContain("approvedSellerProductSql('p')")
  })
  it('데모는 뒤로 (2026-07-04 대표 "데모 이용권 노출은 항상 후순위")', () => {
    expect(r).toMatch(/ORDER BY is_demo/)
  })
  it('limit 을 숫자로 안전하게 읽는다', () => {
    // 비숫자 쿼리로 D1 bind(NaN) 크래시가 나던 클래스 — 레포 룰은 intParam 경유다.
    expect(r).toContain('intParam(')
  })
  it('카드 배지가 뜨도록 fcfs 를 실어 준다 — 안 실으면 오픈 예정인데 평범한 딜로 보인다', () => {
    /* `/soon` 은 홈과 같은 `GroupBuyFeedCard` 를 쓰고 그 배지는 `p.fcfs` 를 본다.
       실측(2026-09-24 D1): 활성 prelaunch 8건 **전부** `fcfs_enabled='1'` 이라 이 enrich 가
       사실상 전건에 걸린다 — 빠지면 목록 전체가 배지 없이 뜬다(에러가 안 나 아무도 신고 안 한다). */
    expect(r).toMatch(/fcfs:\s*\{/)
    expect(r).toContain("rec.fcfs_enabled !== '1'")
    expect(r).toContain('appliedDisplay')
    // 못 읽어도 목록은 떠야 한다 — 배지는 부가 정보다(메타 조회를 try 로 감싼다).
    expect(r).toMatch(/try \{[\s\S]{0,1200}fcfs_applications[\s\S]{0,300}\}\s*catch/)
  })
})

describe('화면', () => {
  const page = readCode(PAGE)
  it('/soon 라우트가 등록돼 있다', () => {
    expect(readCode(APP)).toMatch(/path="\/soon"/)
  })
  it('찾아갈 길이 있다 — 푸터 링크', () => {
    expect(readCode(FOOTER)).toContain('href="/soon"')
  })
  it('빈 목록이 막다른 골목이 아니다', () => {
    // 2026-07-20 대표 지적("빈 화면이 막다른 골목") 승계 — 나갈 문을 준다.
    expect(page).toMatch(/items\.length === 0/)
    expect(page).toMatch(/지금 살 수 있는 딜 보기/)
  })
  it('오픈 날짜를 지어내지 않는다', () => {
    // 우리는 오픈일을 모른다. "곧 오픈"·"N일 후" 는 지킬 수 없는 약속이다.
    expect(page).not.toMatch(/곧 오픈|며칠 (뒤|후)|\d+일 (뒤|후) 오픈/)
  })
  it('보내지도 않는 오픈 알림을 약속하지 않는다', () => {
    /* 🩸 초판이 "지금 응모해 두면 **오픈할 때 알려드려요**" 라고 적고 있었다. 오픈 시점에 알림을
       보내는 코드는 어디에도 없다 — `prelaunch` 는 `product_supply_meta` 의 표시 플래그일 뿐이다.
       통지가 있는 것은 사전 응모(`useFcfs`: "당첨 시 안내드려요")뿐이고 그건 다른 축이다.
       화면 문구는 코드가 실제로 하는 일을 넘지 않는다. */
    expect(page).not.toMatch(/오픈하?(면|할 때)[^<]{0,12}(알려|안내)/)
    expect(page).not.toMatch(/먼저 알려드릴/)
  })
})
