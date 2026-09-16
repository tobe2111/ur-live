/**
 * 🇰🇷 한국 주소·상호 정규화 + 대조 — 서류(사업자등록증·영업신고증)와 등록 매장을 맞춰 보기 위한 SSOT.
 *
 * 2026-09-16 (결재 `2026-09-16-ocr-license-automation.md` — 대표가 Workers AI 바인딩을 켜며 착수).
 *
 * ## 왜 이 파일이 따로 있나
 * OCR 호출(`worker/utils/ocr-license.ts`)은 AI 바인딩이 있어야 돌지만, **판정은 순수 함수**라
 * 바인딩 없이도 전부 시험할 수 있다. 섞어 두면 "AI 가 없어서 못 쟀다" 는 말로 판정 로직이
 * 영영 검증을 피해 간다 — 이 레포가 반복해 당한 *"검사가 실패할 수 없음"* 클래스다.
 *
 * ## 🩸 결재 문서의 전제가 실측에서 뒤집혔다 (2026-09-16)
 * 문서는 *"영업신고증을 대조할 공개 원장이 269,708건"* 이라고 적었다. 라이브를 재 보니
 * 그 숫자의 대부분이 **인허가 원장이 아니다**:
 *
 * | `opn_svc_id` | 건수 | 정체 |
 * |---|---|---|
 * | `neis_academy` | 139,477 | 학원 — 유어딜 업종 아님 |
 * | `kakao_place` | 96,832 | **카카오 플레이스 스크랩** — 공공 원장 아님(`mgt_no` 가 장소 ID, 인허가일 없음) |
 * | `hira_hospital` | 26,809 | 병원 |
 * | `general_restaurants`+`rest_cafes` | **6,590** | ← 진짜 인허가 원장(localdata) |
 *
 * 그 6,590건은 품질이 완벽하다(`mgt_no` = `3000000-101-2026-00229` 형태 · 인허가일 100% ·
 * 영업상태 100%). 다만 **하루 300건씩 신규 인허가만** 들어와 전국 음식점 대비 1% 미만이다.
 * ⇒ **원장에 걸리면 강한 양성, 안 걸리면 아무 신호도 아니다.** 반려 근거로 쓰면 안 된다.
 *
 * ## 그래서 주력은 원장이 아니라 이것이다
 * **서류 주소 ↔ 사장님이 카카오맵에서 고른 매장 주소.** 매장 주소는 우리가 이미 갖고 있고
 * 커버리지가 100%다. 결재 문서가 지목한 구멍(*"자기 진짜 등록증 + 남의 가게 이름"*)은
 * 서류의 소재지가 등록한 가게와 다른 순간 드러난다.
 *
 * ## ⚠️ 이 파일이 **하지 않는** 것
 * - **판정하지 않는다.** 점수와 근거만 돌려준다. 승인·반려 버튼은 사람이 누른다(결재 §안전 레일).
 * - 주소를 좌표로 바꾸지 않는다(지오코딩 없음 — 외부 호출 0).
 * - 오타를 교정하지 않는다. 한 글자 차이를 "같다" 고 우기면 방어가 통째로 무의미해진다.
 */

/** 시·도 표기 흔들림 흡수 — `서울특별시`·`서울시`·`서울` 이 전부 같은 것으로 읽혀야 한다. */
const SIDO_CANON: Array<[RegExp, string]> = [
  [/^서울(특별시|시)?/, '서울'],
  [/^부산(광역시|시)?/, '부산'],
  [/^대구(광역시|시)?/, '대구'],
  [/^인천(광역시|시)?/, '인천'],
  [/^광주(광역시|시)?/, '광주'],
  [/^대전(광역시|시)?/, '대전'],
  [/^울산(광역시|시)?/, '울산'],
  [/^세종(특별자치시|시)?/, '세종'],
  [/^경기(도)?/, '경기'],
  [/^강원(특별자치도|도)?/, '강원'],
  [/^충청북도|^충북/, '충북'],
  [/^충청남도|^충남/, '충남'],
  [/^전라북도|^전북(특별자치도)?/, '전북'],
  [/^전라남도|^전남/, '전남'],
  [/^경상북도|^경북/, '경북'],
  [/^경상남도|^경남/, '경남'],
  [/^제주(특별자치도|도)?/, '제주'],
]

/**
 * 층·호·동 같은 **건물 안 위치**를 떼어낸다.
 *
 * ⚠️ 왜 떼는가: 서류에는 `… 15, 2층` 인데 카카오맵 주소는 `… 15` 인 경우가 흔하다.
 * 같은 건물이므로 이것 때문에 "다르다" 가 뜨면 정상 사장님이 걸린다.
 * ⚠️ 왜 위험하지 않은가: 건물 번호(`15`)는 **안 지운다** — 그게 신원의 핵심이다.
 */
function stripUnitSuffix(s: string): string {
  return s
    // `, 1층` · ` 2층` · `B1층` · `지하1층`
    .replace(/[,\s](지하\s?)?[Bb]?\d+\s?층/g, ' ')
    // `101호` · `,101호`
    .replace(/[,\s]\d+\s?호(?![\d가-힣])/g, ' ')
    // 끝에 남은 `(원서동)` 류 법정동 괄호 — 도로명주소가 관례적으로 붙인다
    .replace(/\([^)]*\)\s*$/g, ' ')
}

/** 비교 전 공통 세탁: 전각→반각, 공백 압축, 괄호 정리. */
function baseClean(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[·ㆍ・]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface AddressTokens {
  /** `서울` 같은 정규화된 시·도. 못 읽으면 null */
  sido: string | null
  /** `강남구` · `강화군` · `성남시` — 기초자치단체 */
  sigungu: string | null
  /** `논현로94길` — 도로명 */
  road: string | null
  /** `15` · `358-11` — 건물번호(본번-부번). 신원의 핵심 */
  building: string | null
  /** 정규화 후 전체 문자열(사람이 눈으로 볼 용도) */
  normalized: string
}

/**
 * 한국 도로명주소를 대조 가능한 조각으로 쪼갠다.
 *
 * ⚠️ 지번주소(`역삼동 123-4`)도 들어올 수 있다 — 그때는 `road` 가 비고 `building` 만 잡힌다.
 * 그 경우 `compareAddress` 가 자동으로 낮은 등급(`near` 이하)으로 떨어진다.
 */
export function addressTokens(raw: string | null | undefined): AddressTokens {
  const empty: AddressTokens = { sido: null, sigungu: null, road: null, building: null, normalized: '' }
  if (!raw || typeof raw !== 'string') return empty

  let s = stripUnitSuffix(baseClean(raw))
  s = baseClean(s)
  if (!s) return empty

  let sido: string | null = null
  for (const [re, canon] of SIDO_CANON) {
    if (re.test(s)) {
      sido = canon
      s = s.replace(re, '').trim()
      break
    }
  }

  const parts = s.split(' ').filter(Boolean)
  // 시군구: `…구` `…군` `…시` 로 끝나는 첫 조각. (`성남시 분당구` 처럼 둘이 오면 뒤엣것이 더 좁다)
  let sigungu: string | null = null
  let idx = 0
  while (idx < parts.length && /(구|군|시)$/.test(parts[idx])) {
    sigungu = parts[idx]
    idx += 1
    // 구/군 을 만나면 거기서 멈춘다 — 그보다 좁은 단위는 도로명이다
    if (/(구|군)$/.test(sigungu)) break
  }

  const rest = parts.slice(idx)
  // 도로명: `…로` `…길` `…대로` 로 끝나는 조각(번호가 붙어 있을 수 있다 — `논현로94길`)
  const road = rest.find((p) => /(로|길)(\d+[가-힣]*)?$/.test(p)) || null
  // 건물번호: 도로명 **다음**에 오는 숫자(-숫자). 앞에서 찾으면 `94길` 의 94 를 집는다.
  const roadAt = road ? rest.indexOf(road) : -1
  const after = roadAt >= 0 ? rest.slice(roadAt + 1) : rest
  const buildingRaw = after.find((p) => /^\d+(-\d+)?[,]?$/.test(p)) || null
  const building = buildingRaw ? buildingRaw.replace(/,$/, '') : null

  return { sido, sigungu, road, building, normalized: [sido, ...parts].filter(Boolean).join(' ') }
}

export type AddressVerdict = 'same' | 'near' | 'differ' | 'unknown'

export interface AddressComparison {
  verdict: AddressVerdict
  /** 사람에게 보여 줄 한 줄 — 어드민 화면이 그대로 쓴다 */
  reason: string
  a: AddressTokens
  b: AddressTokens
}

/**
 * 두 주소가 같은 곳인가.
 *
 * - `same`   — 시군구 + 도로명 + 건물번호가 전부 일치. 같은 건물로 본다.
 * - `near`   — 시군구는 같은데 도로명/번지가 다르거나 못 읽음. **같은 동네의 다른 가게일 수 있다.**
 * - `differ` — 시군구가 다르다. 사람이 반드시 봐야 한다.
 * - `unknown`— 한쪽을 못 읽었다. **`differ` 로 취급하지 않는다**(OCR 실패를 사장님 탓으로 돌리면 안 된다).
 */
export function compareAddress(aRaw: string | null | undefined, bRaw: string | null | undefined): AddressComparison {
  const a = addressTokens(aRaw)
  const b = addressTokens(bRaw)

  if (!a.normalized || !b.normalized) {
    return { verdict: 'unknown', reason: '한쪽 주소를 읽지 못했습니다', a, b }
  }
  if (!a.sigungu || !b.sigungu) {
    return { verdict: 'unknown', reason: '시·군·구를 읽지 못했습니다', a, b }
  }
  if (a.sigungu !== b.sigungu) {
    return { verdict: 'differ', reason: `다른 지역입니다 (${a.sigungu} ↔ ${b.sigungu})`, a, b }
  }
  if (a.road && b.road && a.road === b.road && a.building && b.building && a.building === b.building) {
    return { verdict: 'same', reason: `같은 건물입니다 (${a.sigungu} ${a.road} ${a.building})`, a, b }
  }
  if (a.road && b.road && a.road !== b.road) {
    return { verdict: 'near', reason: `같은 ${a.sigungu} 인데 도로명이 다릅니다 (${a.road} ↔ ${b.road})`, a, b }
  }
  if (a.building && b.building && a.building !== b.building) {
    return { verdict: 'near', reason: `같은 도로인데 건물번호가 다릅니다 (${a.building} ↔ ${b.building})`, a, b }
  }
  return { verdict: 'near', reason: `${a.sigungu} 까지만 확인됩니다`, a, b }
}

/**
 * 상호 정규화 — 지점명·법인격·따옴표를 걷어낸다.
 *
 * ⚠️ 지점명(`역삼점`)은 **안 지운다.** `스타벅스 역삼점` 과 `스타벅스 강남점` 은 다른 가게다.
 * 지우는 것은 법인 형태(`주식회사`·`(주)`)와 장식뿐이다.
 */
export function normalizeBizName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  return baseClean(raw)
    .replace(/\((주|유|합|재|사)\)/g, ' ')
    .replace(/(주식회사|유한회사|합자회사|사단법인|재단법인|유한책임회사)/g, ' ')
    .replace(/["'`”“’‘]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type NameVerdict = 'same' | 'contains' | 'differ' | 'unknown'

export interface NameComparison {
  verdict: NameVerdict
  reason: string
  a: string
  b: string
}

/**
 * 두 상호가 같은 가게인가.
 *
 * - `same`     — 정규화 후 완전 일치.
 * - `contains` — 한쪽이 다른 쪽을 통째로 품는다(`대가방` ⊂ `대가방 본점`). 흔한 정상 케이스다.
 * - `differ`   — 그 외. **틀렸다는 뜻이 아니라 사람이 봐야 한다는 뜻이다.**
 * - `unknown`  — 한쪽이 비었다.
 */
export function compareBizName(aRaw: string | null | undefined, bRaw: string | null | undefined): NameComparison {
  const a = normalizeBizName(aRaw)
  const b = normalizeBizName(bRaw)
  if (!a || !b) return { verdict: 'unknown', reason: '한쪽 상호가 비어 있습니다', a, b }
  if (a === b) return { verdict: 'same', reason: '상호가 같습니다', a, b }

  const [long, short] = a.length >= b.length ? [a, b] : [b, a]
  // 공백 제거 후 포함 — `대가방본점` ⊃ `대가방`
  if (short.length >= 2 && long.replace(/\s/g, '').includes(short.replace(/\s/g, ''))) {
    return { verdict: 'contains', reason: `한쪽이 다른 쪽을 포함합니다 (${short} ⊂ ${long})`, a, b }
  }
  return { verdict: 'differ', reason: `상호가 다릅니다 (${a} ↔ ${b})`, a, b }
}
