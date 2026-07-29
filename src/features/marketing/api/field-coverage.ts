/**
 * 📊 원본 응답 **필드 커버리지 프로브** — "무엇이 실제로 채워져 오는가" (2026-07-29 신설).
 *
 * ## 왜 필요한가 (실측이 만든 모듈)
 * 같은 날 세 번, 같은 이유로 데이터를 잃고 있었다는 게 드러났다 — 그리고 세 번 다
 * **원본 응답이 무엇을 주는지 몰라서** 생긴 일이었다:
 *
 *   - `upteNm`(업태)로 분류하려 했는데 그 키는 **실응답에 아예 없었다** → 온라인판매 15만 건의
 *     subcategory 가 **100% 상수 '통신판매'** 로 굳었다.
 *   - `"N/A"` 를 값으로 채택해 **주소의 31.7%** 를 잃었다.
 *   - 그리고 지금 남은 수수께끼: **온라인 판매업체인데 홈페이지 보유율이 0.0%** 다(원부에 도메인
 *     필드가 있는데도). 값이 전부 비었는지, 형식이 URL 이 아니라 정규식에 걸리는지 **알 방법이 없다.**
 *
 * 공통점은 하나다: **필드 이름을 스펙 추정으로 쓰고, 그게 맞았는지 확인할 길이 없었다.**
 * 게다가 이 개발 환경은 `apis.data.go.kr` 로 나가는 CONNECT 가 막혀 있어 **직접 호출로 못 본다.**
 * ⇒ 라이브 워커가 **이미 받아온 응답**을 세어 진단에 남긴다. 추가 요청 0 · 외부 쿼터 0.
 *
 * ## 원칙
 * - **세기만 한다.** 수집 동작에 영향을 주지 않는다(순수 함수).
 * - 예시 값은 **형식을 보기 위한 것**이지 데이터가 아니다 → 개인정보는 가린다(아래 `maskExample`).
 * - `isNoValue`(public-data-diag SSOT)로 '값 없음'을 판정한다 — `"N/A"` 를 채워진 것으로 세면
 *   이 프로브 자체가 거짓말이 된다(고치려는 바로 그 버그를 반복).
 */
import { isNoValue } from './public-data-diag'

export interface FieldCoverage {
  /** 원본 필드명 */
  key: string
  /** 값이 있던 행 수 */
  filled: number
  /** 채움률(%) — 0~100 정수 */
  pct: number
  /** 형식 확인용 예시(가려짐·잘림). 없으면 생략. */
  ex?: string
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

/**
 * 예시 값 마스킹 — **형식은 보이고 내용은 안 보이게**.
 *   진단 스냅샷은 어드민 화면과 핸드오프 문서로 흘러간다. 여기에 실제 이메일·사업자번호가 실리면
 *   그건 우리가 만든 새 유출 경로다(같은 세션에서 요청 URL 의 서비스키를 가린 것과 같은 이유).
 */
export function maskExample(raw: unknown, max = 40): string {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  // 이메일: 로컬파트 첫 글자만 남긴다 → 형식(도메인 종류)은 보인다.
  s = s.replace(EMAIL_RE, m => `${m[0]}***@${m.split('@')[1]}`)
  // 8자리 이상 숫자 연속(사업자번호·전화·계좌): 앞 3자리만.
  s = s.replace(/\d{8,}/g, d => `${d.slice(0, 3)}${'*'.repeat(Math.min(6, d.length - 3))}`)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/**
 * 항목 배열의 필드별 커버리지. **채움률 내림차순** → 같으면 키 이름순(실행마다 같은 순서).
 *
 * @param items 원본 응답 항목(이미 받아온 것)
 * @param top   상위 몇 개까지 남길지(스냅샷 크기 제한). 기본 40.
 */
export function fieldCoverage(items: Array<Record<string, unknown>>, top = 40): FieldCoverage[] {
  const n = items.length
  if (!n) return []
  const filled = new Map<string, number>()
  const example = new Map<string, string>()
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    for (const [k, v] of Object.entries(it)) {
      if (!filled.has(k)) filled.set(k, 0) // 키는 등장 자체로 기록(전부 비어도 '있다'는 사실이 정보다)
      if (isNoValue(v)) continue
      filled.set(k, (filled.get(k) || 0) + 1)
      if (!example.has(k)) example.set(k, maskExample(v))
    }
  }
  const out: FieldCoverage[] = [...filled.entries()].map(([key, f]) => ({
    key, filled: f, pct: Math.round((f / n) * 100), ...(example.has(key) ? { ex: example.get(key) } : {}),
  }))
  out.sort((a, b) => (b.pct - a.pct) || (b.filled - a.filled) || a.key.localeCompare(b.key))
  return out.slice(0, Math.max(1, top))
}

/**
 * 한 줄 요약 — 상태줄에 그대로 띄울 수 있게. "무엇이 비어 있나"를 먼저 보여준다(그게 행동 대상이라서).
 * @example `빈 필드 12/40: domnCn·telno·upteNm …`
 */
export function coverageNote(cov: FieldCoverage[]): string | null {
  if (!cov.length) return null
  const empty = cov.filter(c => c.pct === 0).map(c => c.key)
  if (!empty.length) return `전 필드 채워짐(${cov.length})`
  return `빈 필드 ${empty.length}/${cov.length}: ${empty.slice(0, 8).join('·')}${empty.length > 8 ? ' …' : ''}`
}
