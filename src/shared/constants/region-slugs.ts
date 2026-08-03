/**
 * 🗺️ 2026-08-03 (대표 — "도시별로 보이게 + 구글에 페이지가 쭉 나오게"): **행정 지역 SSOT**.
 *
 * ⚠️ `korea-regions.ts`(KOREA_REGIONS) 와 **다른 물건이고, 서로 대체하지 않는다.**
 *   - `korea-regions.ts` = **상권 묶음**(176개 역세권/동 그룹, 손큐레이션). 홈의 지역 *필터* 전용.
 *   - 이 파일           = **행정 시군구**(주소에서 파생). `/region/*` 색인 페이지의 단위.
 *
 * 왜 나눴나 (2026-08-03 라이브 실측 — 활성 동네딜 329건 전수):
 *   상권 묶음은 서울·경기 중심으로 손큐레이션돼 있어 **지방 커버가 불균등**하다. 상품 보유
 *   상위 지역인 **서울 서대문구(18건)·부산 연제구(17건)가 KOREA_REGIONS 에 아예 없다.**
 *   색인 페이지를 그 위에 세우면 2·3위 지역이 통째로 빠진다 → 행정 시군구를 별도 축으로 둔다.
 *   (반대로 '홍대/합정' 같은 상권은 행정구역에 없다 — 그래서 상권 축도 지운 게 아니라 남긴다.)
 *
 * URL 표기: **한글 경로** — `/region/서울/중구`.
 *   시군구 229개를 로마자로 옮기는 표는 유지비용·오타 위험이 크고, 한글은 주소 텍스트와 정확히
 *   일치해 매칭 드리프트가 구조적으로 0 이다(한국어 질의에 키워드-in-URL 이득도 있다).
 *   나중에 로마자로 바꾸고 싶으면 `regionPath()`/`parseRegionPath()` 두 함수만 고치면 된다 —
 *   호출부는 전부 이 두 함수를 지나간다(그러라고 만든 간접층이다).
 */

export interface RegionRef {
  /** 정규화된 시/도 — '서울' · '강원' (접미사 없는 짧은 형태) */
  sido: string
  /** 시군구 — '중구' · '파주시' · '양양군'. 없으면 시/도 단위 */
  sigungu?: string
}

/**
 * `GET /api/regions` 응답 형태 — **여기에 둔다(워커 라우트 파일이 아니라).**
 * 라우트 파일은 `@/worker/*` 를 import 하므로 클라이언트 번들에서 못 읽는다.
 * 타입이 그쪽에 있으면 화면 컴포넌트가 워커 모듈을 끌어오게 되고, 그 순간 번들이 깨진다.
 */
export interface SigunguStat {
  sigungu: string
  count: number
  /** sitemap 제출 + `index` 대상 여부 — thin content 게이트(`REGION_INDEX_MIN_DEALS`) */
  indexable: boolean
}
export interface SidoStat {
  sido: string
  count: number
  indexable: boolean
  sigungu: SigunguStat[]
}

/**
 * 실주소 1번째 토큰 → 정규화 시/도.
 * 실측 기반: D1 의 `restaurant_address` 는 '서울'(짧은형)·'강원특별자치도'(전체형)가 섞여 있다.
 * `전남광주통합특별시` 는 라이브에 실재하는 표기이며(24건), 하위가 화순군·나주시·보성군·장흥군
 * 이라 전남 권역으로 정규화한다.
 */
const SIDO_ALIASES: Record<string, string> = {
  '서울특별시': '서울', '서울시': '서울',
  '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
  '세종특별자치시': '세종', '세종시': '세종',
  '경기도': '경기',
  '강원특별자치도': '강원', '강원도': '강원',
  '충청북도': '충북', '충청남도': '충남',
  '전라북도': '전북', '전북특별자치도': '전북',
  '전라남도': '전남',
  '전남광주통합특별시': '전남',
  '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주', '제주도': '제주', '제주시특별자치도': '제주',
}

/** 정규화된 시/도 목록(표시 순서 = 전국 통용 순). URL·인덱스·sitemap 이 공유. */
export const SIDO_LIST: readonly string[] = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const

const SIDO_SET = new Set(SIDO_LIST)

/** 주소 토큰(또는 이미 짧은 형태)을 정규화. 모르는 값이면 null. */
export function normalizeSido(token: string | null | undefined): string | null {
  const t = (token || '').trim()
  if (!t) return null
  if (SIDO_SET.has(t)) return t
  const alias = SIDO_ALIASES[t]
  if (alias) return alias
  // 접미사만 다른 미등록 표기 폴백 — '◯◯특별자치도' 류가 새로 생겨도 조용히 죽지 않게.
  const stripped = t.replace(/(특별자치도|특별자치시|광역시|특별시|자치도|자치시)$/, '')
  if (SIDO_SET.has(stripped)) return stripped
  return null
}

/**
 * 시군구 토큰 판정 — '중구'·'파주시'·'양양군'. '덕진구'(전주시 하위)도 형태는 같으나 파서가 2번째만 본다.
 *
 * ⚠️ 접두부는 **한 글자도 허용**해야 한다(`{1,10}`). `{2,10}` 으로 쓰면 '중구'·'동구'·'남구'·'북구'
 *   처럼 한 글자 + 접미사인 지역이 전부 탈락한다 — 라이브 2위 지역인 **서울 중구(25건)** 가 바로 그
 *   경우라 도시 페이지에서 통째로 사라졌다(2026-08-03 유닛테스트가 잡은 실제 버그).
 */
function isSigunguToken(token: string): boolean {
  return /^[가-힣]{1,10}(시|군|구)$/.test(token)
}

/**
 * `restaurant_address` → { sido, sigungu }.
 * 파싱 단위는 **2번째 토큰까지**다(예: '전북특별자치도 전주시 덕진구' → 전북/전주시).
 * 자치구를 가진 특례시는 시 단위가 색인 단위로 적절하다(덕진구까지 쪼개면 thin content 가 된다).
 */
export function parseRegionFromAddress(address: string | null | undefined): RegionRef | null {
  const parts = (address || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const sido = normalizeSido(parts[0])
  if (!sido) return null
  const second = parts[1]
  if (second && isSigunguToken(second)) return { sido, sigungu: second }
  return { sido }
}

/** RegionRef → URL 경로. 인코딩은 브라우저/라우터에 맡긴다(여기선 원문 유지). */
export function regionPath(ref: RegionRef): string {
  if (!ref.sido) return '/region'
  return ref.sigungu ? `/region/${ref.sido}/${ref.sigungu}` : `/region/${ref.sido}`
}

/**
 * URL 파라미터 → RegionRef. 라우터가 이미 디코드해 주지만, 직접 들어온 인코딩 문자열도 받는다.
 * 모르는 시/도면 null → 호출부가 404 처리(존재하지 않는 지역을 200 으로 내주면 soft-404 가 된다).
 */
export function parseRegionPath(sidoParam?: string, sigunguParam?: string): RegionRef | null {
  const decode = (v?: string) => {
    if (!v) return ''
    try { return decodeURIComponent(v).trim() } catch { return v.trim() }
  }
  const sido = normalizeSido(decode(sidoParam))
  if (!sido) return null
  const sg = decode(sigunguParam)
  if (sg && !isSigunguToken(sg)) return null
  return sg ? { sido, sigungu: sg } : { sido }
}

/** 표시용 라벨 — '서울 중구' · '서울'. */
export function regionLabel(ref: RegionRef): string {
  return ref.sigungu ? `${ref.sido} ${ref.sigungu}` : ref.sido
}

/**
 * 주소가 이 지역에 속하는지(피드 클라이언트 필터용).
 * 주소 파싱 결과를 **정규화된 값끼리** 비교한다 — 문자열 `includes` 로 하면 '중구' 가
 * 서울/대구/부산 중구를 전부 삼킨다(실제로 세 곳 다 상품이 있다).
 */
export function addressInRegion(address: string | null | undefined, ref: RegionRef): boolean {
  const parsed = parseRegionFromAddress(address)
  if (!parsed) return false
  if (parsed.sido !== ref.sido) return false
  if (!ref.sigungu) return true
  return parsed.sigungu === ref.sigungu
}

/**
 * 🔎 색인 게이트 — 상품이 이만큼 있어야 sitemap 제출 + `index` 로 내보낸다.
 * 낮추면 상품 0~1개짜리 빈 페이지가 대량 색인돼 **사이트 전체 품질 평가가 떨어진다**(thin content).
 * 페이지 자체는 미달이어도 열린다 — 링크가 죽지 않게. `noindex` 만 붙는다.
 */
export const REGION_INDEX_MIN_DEALS = 3
