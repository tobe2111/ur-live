/**
 * 🪤 **이름이 두 벌이라 200 을 받고도 0건이던 것** — 2026-08-03 라이브 실측.
 *
 * 인허가 레인이 죽은 원인은 **두 겹**이었고, 하나만 고치면 증상이 안 바뀐다:
 *   ① 경로에 오퍼레이션(`/info`)이 빠져 400(code 12)   → `license-url-variant.test.ts` 가 지킨다
 *   ② 이관된 포털이 **완전히 다른 필드명**을 쓴다      → 이 파일이 지킨다
 *
 * ②를 놓치면 이렇게 된다: 경로를 고쳐 **HTTP 200 에 실제 행까지 오는데**, 매핑이 전부 빈 문자열로 읽혀
 * `mgt_no` 가 비고 → 복합키가 성립하지 않아 → 행이 통째로 버려진다. 화면엔 "정상"인데 저장은 0.
 * **200 은 성공이 아니다.**
 *
 * 아래 픽스처는 **라이브 응답에서 그대로 가져온 것**이다(값만 축약). 손으로 지어낸 이름이 아니다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 여기 없는 업종이 또 다른 이름을 쓰는 경우. 실측한 다섯(음식점·휴게·미용·숙박·약국)만 근거다.
 * - 좌표계. `CRD_INFO_X/Y` 는 위경도가 아니라 투영좌표다 — 그대로 옮길 뿐 변환하지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { toProspect } from '@/features/marketing/api/localdata-collect'

/** 🔴 라이브 `…/1741000/general_restaurants/info` 응답 1행(값 축약, 키는 원문 그대로). */
const LIVE_UPPER = {
  BPLC_NM: '캡틴클럽하우스',
  MNG_NO: '6520000-101-2026-00267',
  OPN_ATMY_GRP_CD: '6520000',
  ROAD_NM_ADDR: '제주특별자치도 서귀포시 월드컵로 33, 2동 S석호 (법환동)',
  LOTNO_ADDR: '제주특별자치도 서귀포시 법환동 914',
  TELNO: '064-123-4567',
  SALS_STTS_CD: '01',
  SALS_STTS_NM: '영업/정상',
  LCPMT_YMD: '2026-07-31',
  LAST_MDFCN_PNT: '2026-07-31 18:22:16',
  BZSTAT_SE_NM: '경양식',
  CRD_INFO_X: '154166.130335479',
  CRD_INFO_Y: '-27615.1899714559',
}

/** 폐쇄된 localdata.go.kr 형태(소문자) — 백필 캐시·다른 기관이 아직 이 이름으로 줄 수 있다. */
const LEGACY_LOWER = {
  bplcnm: '옛집국수', mgtno: 'OLD-1', opnsfteamcode: '3000000',
  rdnwhladdr: '서울특별시 종로구 종로 1', sitewhladdr: '서울특별시 종로구 1-1',
  sitetel: '02-000-0000', trdstategbn: '01', trdstatenm: '영업/정상',
  apvpermymd: '20200101', lastmodts: '2026-01-01 00:00:00', uptaenm: '한식',
}

describe('인허가 필드 별칭 — 대문자(현행 포털)', () => {
  const p = toProspect(LIVE_UPPER, 'general_restaurants', '일반음식점')

  it('🔒 복합키가 채워진다 — 비면 행이 통째로 버려진다(0건의 정체)', () => {
    expect(p.mgt_no, 'MNG_NO 를 못 읽으면 200 을 받고도 저장이 0 이다').toBe('6520000-101-2026-00267')
    expect(p.opn_sf_team_code).toBe('6520000')
    expect(p.opn_svc_id).toBe('general_restaurants') // 응답에 없는 필드 → endpoint 폴백
  })

  it('🔒 상호와 전화 — 이 풀의 **도달 채널은 전화**다(이메일이 아니라)', () => {
    expect(p.biz_name).toBe('캡틴클럽하우스')
    expect(p.phone, 'TELNO 를 못 읽으면 매장 풀이 연락 불가 명단이 된다').toBe('064-123-4567')
  })

  it('🔒 영업상태 — `01` 이 아니면 폐업으로 집계된다(활성 판정의 입력)', () => {
    expect(p.trd_state).toBe('01')
    expect(p.trd_state_nm).toBe('영업/정상')
  })

  it('주소·지역·업태·일자·좌표를 옮긴다', () => {
    expect(p.addr_road).toContain('월드컵로')
    expect(p.addr_lot).toContain('법환동')
    expect(p.region).toBe('서귀포')
    expect(p.uptae).toBe('경양식')
    expect(p.apv_perm_ymd).toBe('20260731')     // 비숫자 제거 후 8자리
    expect(p.last_mod_ts).toBe('2026-07-31 18:22:16')
    expect(p.lon).toBeCloseTo(154166.13, 1)
    expect(p.lat).toBeCloseTo(-27615.19, 1)
  })

  it('이·미용은 위생업태 키가 다르다(SNTTN_BZSTAT_NM) — 업종마다 갈린다', () => {
    expect(toProspect({ ...LIVE_UPPER, BZSTAT_SE_NM: '', SNTTN_BZSTAT_NM: '일반이용업' }, 'barber_shops', '이용업').uptae).toBe('일반이용업')
  })
})

describe('인허가 필드 별칭 — 소문자(구 localdata)', () => {
  it('🔒 옛 이름도 계속 읽힌다 — 별칭은 **더하기만** 한다(빼면 백필이 조용히 죽는다)', () => {
    const p = toProspect(LEGACY_LOWER, 'general_restaurants', '일반음식점')
    expect(p.mgt_no).toBe('OLD-1')
    expect(p.biz_name).toBe('옛집국수')
    expect(p.phone).toBe('02-000-0000')
    expect(p.trd_state).toBe('01')
    expect(p.addr_road).toContain('종로')
  })

  it('두 형태가 섞여 와도 값이 있는 쪽을 취한다(빈 문자열에 가려지지 않게)', () => {
    const p = toProspect({ ...LEGACY_LOWER, bplcnm: '', BPLC_NM: '새이름' }, 'x', 'y')
    expect(p.biz_name).toBe('새이름')
  })
})
