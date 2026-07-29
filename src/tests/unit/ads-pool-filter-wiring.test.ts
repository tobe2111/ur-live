/**
 * 🔌 인플루언서 풀 **필터 배선** 불변식 — 서버 필터와 화면 컨트롤은 **쌍**이다.
 *
 * ## 왜 (이 세션이 실제로 두 번 만난 클래스)
 * 이 레포에서 반복된 실패는 "고장"이 아니라 **"고쳤는데 아무도 볼 수 없다"** 이다:
 *   · `category_source` 는 오래전부터 저장되고 CSV 에도 나갔지만 **쿼리 파라미터가 없어**
 *     화면에서 "이 카테고리가 믿을 만한가"를 한 번도 고를 수 없었다(실측 84%가 상속값).
 *   · 같은 세션에 `never_fired`(한 번도 안 돈 레인)를 서버에만 만들고 화면에 안 걸 뻔했다.
 *
 * 서버에 필터를 더하는 건 쉽고, 그걸 화면에 잇는 걸 잊는 것도 쉽다. 잊으면 **에러가 안 난다** —
 * 그냥 그 기능이 없는 것처럼 조용히 지나간다. 그래서 기계가 지킨다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 화면에 컨트롤이 있어도 값이 틀리면(예: `content` 대신 `contents`)
 *    0건이 나올 뿐 여기선 통과한다. 값 일치는 아래 별도 검사로 일부만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ROUTES = 'src/features/marketing/api/admin-ads-influencers.routes.ts'
const PAGE = 'src/pages/admin/AdminInfluencerPoolPage.tsx'
const FILTERS = 'src/pages/admin/influencer-pool/PoolFilters.tsx'

/** `/influencer-pool` 목록 핸들러 본문만 잘라낸다 — 같은 파일의 export·send-queue 핸들러 파라미터와 섞이면 오탐. */
function listHandlerBody(src: string): string {
  const start = src.indexOf("app.get('/influencer-pool'")
  expect(start).toBeGreaterThan(-1)
  const next = src.indexOf('\napp.', start + 10)
  return src.slice(start, next > -1 ? next : src.length)
}

// 목록 필터가 아닌 것(페이지네이션·정렬은 별도 컨트롤). 여기 넣는 건 "화면 컨트롤이 필요 없다"는 선언이다.
const NOT_A_FILTER = new Set(['limit', 'offset'])

describe('풀 목록 — 서버 필터 ↔ 화면 배선', () => {
  const routes = readFileSync(ROUTES, 'utf8')
  const page = readFileSync(PAGE, 'utf8')
  const body = listHandlerBody(routes)
  const params = [...new Set([...body.matchAll(/c\.req\.query\('([a-zA-Z_]+)'\)/g)].map(m => m[1]))]

  it('핸들러에서 파라미터를 실제로 찾아낸다 — 0건이면 검사가 헛도는 것이다', () => {
    // ⚠️ "측정 대상 0건 = 통과" 는 이 레포가 실제로 겪은 죽은 가드의 형태다(gzip 예산 0 사건).
    expect(params.length).toBeGreaterThan(8)
  })

  for (const p of params.filter(x => !NOT_A_FILTER.has(x))) {
    it(`\`${p}\` 를 화면이 보낸다 — 안 보내면 그 필터는 존재하지 않는 것과 같다`, () => {
      expect(page).toContain(`params.set('${p}'`)
    })
  }
})

describe('풀 목록 — 필터 값이 서버가 아는 값인가', () => {
  const routes = readFileSync(ROUTES, 'utf8')
  const filters = readFileSync(FILTERS, 'utf8')
  const body = listHandlerBody(routes)

  it('분류 신뢰도(catSource) 의 선택지가 서버 분기와 같은 문자열이다', () => {
    for (const v of ['content', 'keyword']) {
      expect(body).toContain(`catSource === '${v}'`)
      expect(filters).toContain(`value="${v}"`)
    }
  })
  it('측정 여부(measured) 의 선택지가 서버 분기와 같은 문자열이다', () => {
    for (const v of ['0', '1']) expect(body).toContain(`measured === '${v}'`)
  })
})

describe('풀 목록 — 화면이 판정에 쓰는 컬럼을 서버가 실제로 내려준다', () => {
  const routes = readFileSync(ROUTES, 'utf8')
  const page = readFileSync(PAGE, 'utf8')
  const body = listHandlerBody(routes)

  /**
   * 목록 행 SELECT 의 **투영 목록만** 잘라낸다.
   *
   * ⚠️ 처음엔 `SELECT[\s\S]*col[\s\S]*FROM ad_influencer_leads` 로 썼다가 **회귀 주입에 초록불**이 떴다:
   *    핸들러 상단 주석에 "SELECT" 라는 **한국어 설명 단어**가 있고 아래에 `COUNT(*) ... FROM
   *    ad_influencer_leads` 가 있어서, 컬럼을 지워도 [주석 SELECT → 필터코드의 컬럼명 → 카운트 FROM]
   *    으로 항상 매치됐다. 느슨한 정규식은 **가드가 아니라 초록불 기계**가 된다.
   */
  const projection = (() => {
    const i = body.indexOf('SELECT id, platform')
    expect(i).toBeGreaterThan(-1)           // 투영을 못 찾으면 아래 검사가 통째로 무의미하다
    const j = body.indexOf('FROM ad_influencer_leads', i)
    expect(j).toBeGreaterThan(i)
    return body.slice(i, j)
  })()

  // 화면 배지가 읽는 값이 투영에 없으면 **전부 undefined** 라, 모든 행이 "미측정·미확인"으로 보인다.
  // 조용히 틀린 화면이 되는 방향이라(에러 없음) 여기서 고정한다.
  for (const col of ['category_source', 'perf_checked_at']) {
    it(`행 SELECT 투영에 ${col} 이 있다`, () => {
      expect(projection.split(/[\s,]+/)).toContain(col)
      expect(page).toContain(`l.${col}`)
    })
  }
})
