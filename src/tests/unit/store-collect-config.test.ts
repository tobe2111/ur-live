/**
 * 🎛️ **회차 조건을 화면에서 정한다** — 계약 (2026-08-02 대표 "모두 가장 이상적으로", ③).
 *
 * ## 여기서 지켜야 하는 것: **화면이 상한을 못 뚫는다**
 * 슬라이스를 UI 로 무제한 올릴 수 있게 만들면 그건 *CPU 한도로 죽는 문을 화면에 다는 것*이다.
 * 이 레포엔 전례가 둘 있다 — NEIS 6→3 · NPS 100→40, **둘 다 올린 날 죽어서 되돌렸다**.
 * 그래서 값은 서버에서 clamp 하고, 저장할 때와 읽을 때 **양쪽에서** 자른다
 * (한쪽만 자르면 옛 배포가 쓴 값이나 손으로 넣은 값이 그대로 통과한다).
 *
 * ## 그리고 **설정 오타로 수집이 0 이 되면 안 된다**
 * 모르는 권역만 골랐거나 매칭이 0이면 전국으로 되돌린다 — 침묵하는 0 보다 넓게 도는 편이 낫다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 슬라이더가 실제로 저장을 부르는지(브라우저 이벤트). 배선은 문자열로만 확인한다.
 * - 조정한 값이 **좋은 값인지** — 그건 라이브 `elapsed_ms`/`stopped_by` 로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clampStoreConfig, STORE_CONFIG_DEFAULT } from '@/features/marketing/api/store-trades'
import { regionsForGroups } from '@/features/marketing/api/store-kakao-collect'
import { S2_REGIONS, REGION_GROUPS } from '@/features/marketing/api/company-keyword-grid'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const TRADES = SRC('src/features/marketing/api/store-trades.ts')
const LANE = SRC('src/features/marketing/api/store-kakao-collect.ts')
const PANEL = SRC('src/pages/admin/store-prospects/CollectConfigPanel.tsx')
const ROUTES = SRC('src/features/marketing/api/store-prospects.routes.ts')
const ADS = SRC('src/worker-ads/public-data.routes.ts')
const PAGE = SRC('src/pages/admin/AdminStoreProspectsPage.tsx')
const GROUPS = Object.keys(REGION_GROUPS)

describe('clamp — 화면이 상한을 못 뚫는다', () => {
  it('🔒 터무니없는 값도 **코드가 허용한 범위**로 잘린다', () => {
    const c = clampStoreConfig({ voucher_share: 9, max_pages: 99, budget: 100000 }, GROUPS)
    expect(c.voucher_share).toBeLessThanOrEqual(0.9)
    expect(c.max_pages).toBeLessThanOrEqual(3)
    expect(c.budget).toBeLessThanOrEqual(60)
  })

  it('🔒 아래쪽도 자른다 — 0 이면 그 블록이 조용히 멈춘다', () => {
    const c = clampStoreConfig({ voucher_share: -5, max_pages: 0, budget: 0 }, GROUPS)
    expect(c.voucher_share).toBeGreaterThanOrEqual(0.1)
    expect(c.max_pages).toBeGreaterThanOrEqual(1)
    expect(c.budget).toBeGreaterThanOrEqual(5)
  })

  it('쓰레기 입력은 기본값 — 문자열·null·배열·NaN 어느 것도 통과하지 않는다', () => {
    for (const bad of [null, undefined, 'x', [], 42, { voucher_share: 'abc', max_pages: null, budget: NaN }]) {
      const c = clampStoreConfig(bad, GROUPS)
      expect(c.voucher_share).toBe(STORE_CONFIG_DEFAULT.voucher_share)
      expect(c.max_pages).toBe(STORE_CONFIG_DEFAULT.max_pages)
      expect(c.budget).toBe(STORE_CONFIG_DEFAULT.budget)
    }
  })

  it('🔒 모르는 권역은 버린다 — 오타가 그대로 저장되면 화면과 실제가 갈라진다', () => {
    expect(clampStoreConfig({ regions: ['서울', '없는권역', 7, null] }, GROUPS).regions).toEqual(['서울'])
  })

  it('🔒 저장과 조회 **양쪽에서** clamp 한다 — 한쪽만이면 옛 값·손입력이 통과한다', () => {
    expect(TRADES).toMatch(/export async function getStoreConfig[\s\S]{0,400}?clampStoreConfig\(parsed, groups\)/)
    expect(TRADES).toMatch(/export async function setStoreConfig[\s\S]{0,200}?clampStoreConfig\(raw, groups\)/)
  })
})

describe('지역 권역 — 설정 오타로 수집이 0 이 되지 않는다', () => {
  it('빈 선택 = 전국', () => {
    expect(regionsForGroups([]).length).toBe(S2_REGIONS.length)
  })

  it('고른 권역만 — 서울은 25개 구', () => {
    const seoul = regionsForGroups(['서울'])
    expect(seoul.length).toBe(REGION_GROUPS['서울'].length)
    expect(seoul).toContain('강남')
    expect(seoul).not.toContain('수원')
  })

  it('🔒 매칭이 0이면 **전국으로 되돌린다** — 침묵하는 0 보다 넓게 도는 편이 낫다', () => {
    expect(regionsForGroups(['있을리없는권역']).length).toBe(S2_REGIONS.length)
  })

  it('🔒 순서가 `S2_REGIONS` 를 따른다 — 선택 순서로 만들면 같은 설정에서도 커서가 흔들린다', () => {
    const a = regionsForGroups(['서울', '경기'])
    const b = regionsForGroups(['경기', '서울'])
    expect(a).toEqual(b)
    expect(a).toEqual(S2_REGIONS.filter(r => a.includes(r)))
  })

  it('권역 묶음이 지역 상수를 **참조**한다 — 복제하면 지역 추가 때 한쪽만 는다', () => {
    const all = new Set(Object.values(REGION_GROUPS).flat())
    const missing = S2_REGIONS.filter(r => !all.has(r))
    expect(missing, `어느 권역에도 안 속한 지역: ${missing.slice(0, 5).join(', ')}`).toHaveLength(0)
  })
})

describe('레인이 설정을 실제로 쓴다', () => {
  it('🔒 비중·페이지·지역이 전부 배선돼 있다 — 하나라도 빠지면 그 슬라이더는 장식이다', () => {
    expect(LANE).toMatch(/blockSlots\(budget\.left, cfg\.max_pages, cfg\.voucher_share\)/)
    expect(LANE).toMatch(/page <= cfg\.max_pages/)
    expect(LANE).toMatch(/buildVoucherKeywords\(voucherTrades, activeRegions\)/)
    expect(LANE).toMatch(/buildUnmannedKeywords\(unmannedTrades, activeRegions\)/)
  })

  it('🔒 예산 유보분도 **설정 페이지 수**로 계산한다 — 상수로 두면 페이지를 낮췄을 때 뒤 블록이 굶는다', () => {
    expect(LANE).toMatch(/slots\.unmanned \* cfg\.max_pages/)
  })
})

describe('효과를 같은 화면에 띄운다', () => {
  it('🔒 직전 회차의 시간·중단사유를 보여준다 — 결과를 안 보여주면 추측으로 조정하게 된다', () => {
    expect(PANEL).toMatch(/elapsed_ms/)
    expect(PANEL).toMatch(/stopped_by/)
    expect(PANEL, 'deadline 은 사람 말로 경고해야 한다').toMatch(/시간 초과 — 슬라이스를 줄이세요/)
  })

  it('🔒 저장 후 **서버가 자른 값**을 반영한다 — 보낸 값을 그대로 그리면 화면과 실제가 갈라진다', () => {
    expect(PANEL).toMatch(/setCfg\(r\.data\.config\)/)
  })
})

/**
 * 🖲️ **지금 돌려 볼 수 있어야 조건을 조정할 수 있다.**
 *
 * 이 레인은 dispatch `prospect` 도메인(예산 1 / 레인 5)이라 **약 5회차에 한 번**만 돈다.
 * 조건을 바꾼 뒤 효과를 보려면 최대 5시간을 기다려야 했다 — 학원·병원엔 있는 버튼이
 * 정작 우선업종(음식점·카페·미용·숙박)을 채우는 **유일한 레인**에만 없었다.
 *
 * ⚠️ 여기서 진짜 위험한 건 404 가 아니라 **404 가 성공처럼 보이는 것**이다:
 * 위임 `kick()` 이 `catch { /* fail-soft *\/ }` 라 대상 경로가 틀려도 `{success:true, started:true}` 를
 * 돌려준다. 화면엔 "수집 시작" 토스트가 뜨고 아무 일도 안 일어난다 — 이 레포가 반복해 만난
 * "침묵이 성공처럼 보인다" 클래스. 그래서 **양쪽 문자열을 대조**한다.
 */
describe('수동 실행 — 조건을 바꾼 뒤 지금 확인할 수 있다', () => {
  const targets = [...ROUTES.matchAll(/\['(\/collect-[a-z-]+)', '([a-z-]+)'\]/g)].map(m => ({ path: m[1], target: m[2] }))

  it('🔒 카카오 매장 레인에 수동 트리거가 있다', () => {
    expect(targets.map(t => t.path), '위임 목록에 없다').toContain('/collect-store-kakao')
  })

  it('🔒 위임 대상이 ur-ads 에 **실재한다** — 없으면 fail-soft 가 삼켜 "시작됨"만 뜨고 아무 일도 안 난다', () => {
    expect(targets.length, '위임 목록을 못 읽었다(정규식이 낡음)').toBeGreaterThan(1)
    for (const { target } of targets) {
      expect(ADS, `ur-ads 에 /__ads/${target} 가 없다`).toContain(`'/__ads/${target}'`)
    }
  })

  it('🔒 버튼이 배선돼 있다 — 라우트만 있고 누를 데가 없으면 없는 기능이다', () => {
    expect(PAGE).toMatch(/runCollectSub\('store-kakao'\)/)
    expect(PAGE, "kind 가 URL 로 그대로 이어져야 한다").toMatch(/collect-\$\{kind\}/)
  })

  it('🔒 실행 중 라벨이 **그 버튼에만** 뜬다 — 공유 상태를 안 나누면 셋이 동시에 "수집 중"이 된다', () => {
    expect(PAGE).toMatch(/busySub === 'store-kakao' \?/)
  })
})
