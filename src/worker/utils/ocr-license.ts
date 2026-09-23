/**
 * 🔍 서류 OCR — 사업자등록증 · 영업신고증 두 축.
 *
 * 2026-09-16 (결재 `docs/decisions/2026-09-16-ocr-license-automation.md`,
 * 대표가 Pages `ur-live` production 에 Workers AI 바인딩을 켜며 착수).
 *
 * ## 이 파일이 하는 일은 딱 하나 — **읽기**
 * 사진에서 글자를 뽑아 구조화한다. **판정도 승인도 하지 않는다.**
 * 대조는 `shared/korean-address.ts`(순수 함수), 승인 버튼은 사람이 누른다.
 *
 * ## 🚧 결재가 못 박은 안전 레일 둘 — 이 파일도 그 아래 있다
 * 1. **자동 승인은 게이트 뒤**(`ocr_auto_verify_enabled`, 기본 OFF). 이 파일은 추출만 하고
 *    누가 그 값을 쓸지 결정하지 않는다.
 * 2. **자동 반려는 하지 않는다.** 그래서 이 파일의 실패는 전부 `ok:false` 이고,
 *    호출부는 그것을 "의심스럽다" 가 아니라 **"못 읽었다"** 로 다뤄야 한다.
 *
 * ## ⚠️ AI 바인딩은 optional 이다
 * Pages 는 production / preview 바인딩이 따로인데 **preview 엔 안 붙어 있다**
 * (2026-09-16 API 실측). 없으면 조용히 `ok:false` 로 돌아간다 = 사람이 눈으로 보는 현행 동작.
 * 이건 결함이 아니라 이득이다 — 프리뷰 배포가 추론 비용을 안 태운다.
 *
 * ## 🩸 앞선 코드가 어긴 것 (2026-05-27 작성 → 한 번도 안 돎)
 * `ocr-business-registration.ts` 는 추출값이 맞으면 **게이트 없이**
 * `UPDATE sellers SET business_registration_status='verified'` 를 때렸다.
 * 게다가 비교 대상이 *사장님이 직접 타이핑한 값* 이라 "사진이 본인이 적은 것과 같다" 만 증명한다 —
 * 남의 가게 이름으로 낸 위조는 그대로 통과한다. 그래서 이 파일은 **등록한 매장 주소**와 맞춘다.
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../types/env'
import { aiText } from './ai-text'

/** 어느 서류인가. 프롬프트와 추출 필드가 갈린다. */
export type DocKind = 'business_registration' | 'business_license'

export const DOC_LABEL: Record<DocKind, string> = {
  business_registration: '사업자등록증',
  business_license: '영업신고증',
}

export interface OcrDocResult {
  ok: boolean
  kind: DocKind
  /** 상호 / 업소명 */
  bizName: string | null
  /** 사업장 / 영업소 소재지 */
  address: string | null
  /** 대표자 · 성명 (등록증 위주) */
  ownerName: string | null
  /** 사업자등록번호 10자리(하이픈 제거) — 등록증만 */
  bizNumber: string | null
  /** 관리번호 `3000000-101-2026-00229` 형태 — 영업신고증만 */
  mgtNo: string | null
  /** 개업연월일 / 신고일 YYYYMMDD */
  permitDate: string | null
  /** 핵심 필드 중 읽힌 비율 0~1 — **정확도가 아니라 충실도다** */
  fill: number
  message: string
  /** 모델 원문 — 어드민이 "왜 이렇게 읽었나" 를 볼 수 있어야 한다 */
  raw?: string
}

/** Workers AI 비전 모델. 바꿀 때는 `fill` 실측을 다시 낼 것. */
export const OCR_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
/**
 * 🎲 한 라운드에 **동시에** 몇 번 물어보나 (2026-09-21 대표 *"너가 완벽히 처리 후에 자동 승인 게이트 켤게"*).
 *
 * ## 🩸 왜 필요한가 — 20회 라이브 실측이 문제를 둘로 갈랐다
 * 같은 서류(seller 15)로 20회를 돌렸다:
 * ```
 * 빈 응답            10 / 20  (50%)   ← 순차 재시도 2회를 이미 쓴 뒤의 숫자다
 * 읽혔을 때 사업자번호  9 / 9   (100%)
 * 읽혔을 때 개업일     9 / 9   (100%)
 * 읽혔을 때 대표자     9 / 10
 * 읽혔을 때 상호       3 / 9           ← 오독이 잦다
 * ```
 * ⇒ **값 정확도가 아니라 "읽히느냐" 가 전부다.** 그리고 가입 폼이 채우는 세 칸
 *   (사업자번호·대표자·개업일)은 읽히기만 하면 사실상 완벽하다. 상호는 오독이 잦지만
 *   **가입 화면에서 상호는 지도가 준다**(2026-09-21 안 B) — 그래서 실질 영향이 작다.
 *
 * ## 왜 순차가 아니라 병렬인가
 * 순차 2회에 50% 가 빈손이므로 단발 성공률은 약 29% 다(0.71² ≈ 0.5). 실패율을 한 자릿수로
 * 내리려면 8회쯤 필요한데, **순차 8회는 사장님을 8배 기다리게 한다.** 병렬이면 지연은 1회분이다.
 *
 * ## ⚠️ 이 숫자를 올리기 전에 볼 것
 * 호출 수는 그대로 추론 비용이고 **서브리퀘스트 예산**(무료 인보케이션당 50)도 함께 쓴다.
 * 지금 값은 [4 병렬 × 최대 2 라운드 = 최대 8] 이라 두 예산 모두 여유가 크다.
 */
export const OCR_PARALLEL_ATTEMPTS = 4
/** 첫 라운드가 통째로 빈손일 때 한 번 더. (0.71⁴)² ≈ 6% 까지 내려간다. */
export const OCR_ROUNDS = 2

const PROMPTS: Record<DocKind, string> = {
  business_registration: `이 이미지는 대한민국 사업자등록증입니다. 아래 JSON 만 출력하세요. 설명 금지.
{"biz_name":"상호(법인명)","address":"사업장 소재지 전체 주소","owner_name":"대표자 성명","biz_number":"등록번호 XXX-XX-XXXXX","permit_date":"개업연월일 YYYY-MM-DD"}
읽을 수 없는 항목은 null 로 두세요. 추측하지 마세요.`,
  business_license: `이 이미지는 대한민국 영업신고증(또는 영업허가증)입니다. 아래 JSON 만 출력하세요. 설명 금지.
{"biz_name":"업소명(상호)","address":"영업소 소재지 전체 주소","owner_name":"성명(대표자)","mgt_no":"관리번호","permit_date":"신고일(허가일) YYYY-MM-DD"}
읽을 수 없는 항목은 null 로 두세요. 추측하지 마세요.`,
}

function emptyResult(kind: DocKind, message: string, raw?: string): OcrDocResult {
  return {
    ok: false, kind, bizName: null, address: null, ownerName: null,
    bizNumber: null, mgtNo: null, permitDate: null, fill: 0, message, raw,
  }
}

/**
 * 🪞 프롬프트의 자리표시자를 모델이 **그대로 되돌려 준** 값 (2026-09-21 라이브 실측: `"biz_name":"상호(법인명)"` — 사진을 안 읽고
 * 예시 JSON 을 베꼈다). 값으로 두면 상호 대조가 `differ` 로 떨어져 사람 큐에 "상호(법인명)" 이 뜬다. 읽은 게 아니므로 null.
 */
const PROMPT_PLACEHOLDERS = new Set([
  '상호(법인명)', '사업장 소재지 전체 주소', '대표자 성명', '등록번호 XXX-XX-XXXXX', '개업연월일 YYYY-MM-DD',
  '업소명(상호)', '영업소 소재지 전체 주소', '성명(대표자)', '관리번호', '신고일(허가일) YYYY-MM-DD',
])

/**
 * 🪞 모델이 **필드 이름을 값 자리에 적은** 경우 (2026-09-21 20회 실측 중 1회:
 * `"address":"business_location","owner_name":"representative_name"`). 프롬프트에 없는
 * 이름까지 지어내므로 위 목록으로는 못 잡는다.
 *
 * 판정은 **언더스코어를 낀 순수 ASCII 식별자**로 좁힌다 — 한국 사업자등록증의 상호·주소·대표자에
 * 그런 모양이 올 수 없다. ⚠️ 영문 상호(`GS25`)를 잡지 않도록 언더스코어를 **요구**한다.
 */
function looksLikeFieldName(s: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(s)
}

/** `null` 문자열·빈 문자열·`-` 같은 빈 표기를 전부 null 로. */
function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === 'null' || s === '-' || s === 'N/A' || s === '없음') return null
  if (PROMPT_PLACEHOLDERS.has(s)) return null
  if (looksLikeFieldName(s)) return null
  return s
}

/**
 * 서류 사진에서 필드를 뽑는다.
 *
 * @param ai `env.AI` — **없으면 조용히 `ok:false`**(현행 동작 유지)
 * @param imageBytes 이미지 바이트
 * @param kind 어느 서류인가
 */
export async function ocrDocument(
  ai: Env['AI'],
  imageBytes: Uint8Array,
  kind: DocKind,
): Promise<OcrDocResult> {
  if (!ai) return emptyResult(kind, 'AI 바인딩이 없어 건너뜁니다 (사람이 확인)')
  if (!imageBytes || imageBytes.length === 0) return emptyResult(kind, '이미지가 비어 있습니다')

  // 🎲 2026-09-21 — **같은 사진을 여러 번, 동시에 묻는다.**
  //   종전엔 순차 재시도 1회(= 총 2회)였는데 20회 실측에서 **10회가 빈손**이었다. 단발 성공률이
  //   약 29% 라는 뜻이라(0.71² ≈ 0.5) 순차로는 지연을 몇 배로 늘려야 한 자릿수가 된다.
  //   병렬이면 지연은 1회분이고, 덤으로 **여러 답을 비교해 다수결**을 할 수 있다.
  //
  //   ⚠️ 예외(쿼터 초과·모델 라이선스 5016)는 재시도해도 같은 답이 온다 — 라운드를 더 돌지 않고
  //     그대로 내보낸다(비용만 든다). 다만 **한 응답의 예외가 나머지 응답을 버리게 하지는 않는다.**
  const askOnce = async (): Promise<{ text: string; err?: string }> => {
    try {
      const res = await ai.run(OCR_MODEL, {
        image: Array.from(imageBytes),
        prompt: PROMPTS[kind],
        max_tokens: 384,
      })
      return { text: aiText(res) }
    } catch (err) {
      // ⚠️ 원문 메시지를 소비자에게 돌려주지 않는다(CLAUDE.md safeError 룰) — 여기선 길이만 자른다
      return { text: '', err: String((err as Error)?.message || '').slice(0, 80) }
    }
  }

  // 🙅 빈 응답과 같은 부류: JSON 이 한 글자도 없는 산문("현재 제공할 수 있는 정보는 없습니다." — 실측).
  //
  // ⚠️ 2026-09-21 정직하게: **이제 이건 정합성 장치가 아니라 절약이다.** 병렬로 바꾸면서
  //   아래 `if (r.ok)` 게이트가 산문을 어차피 걸러내게 됐다(파싱은 JSON 을 못 찾으면 ok:false).
  //   즉 이 줄을 지워도 **동작은 같고** 정규식·JSON.parse 한 번씩만 더 돈다.
  //   ⇒ 이걸 "산문 방어" 라고 믿지 말 것. 진짜 방어선은 `r.ok` 다(주입이 그쪽을 지킨다).
  const isBlank = (t: string) => !t || !/\{/.test(t)
  const parsed: OcrDocResult[] = []
  let attempts = 0
  let firstErr = ''

  for (let round = 0; round < OCR_ROUNDS && parsed.length === 0; round += 1) {
    const answers = await Promise.all(
      Array.from({ length: OCR_PARALLEL_ATTEMPTS }, () => askOnce()),
    )
    attempts += answers.length
    for (const a of answers) {
      if (a.err && !firstErr) firstErr = a.err
      if (isBlank(a.text)) continue
      const r = parseOcrText(a.text, kind)
      if (r.ok) parsed.push(r)
    }
    // 쿼터·라이선스처럼 **모두** 예외로 죽었으면 더 물어봐야 소용없다.
    if (firstErr && answers.every((a) => a.err)) break
  }

  if (parsed.length === 0) {
    if (firstErr) return emptyResult(kind, `읽기 실패: ${firstErr}`)
    return emptyResult(kind, `모델이 빈 응답을 돌려줬습니다 (${attempts}회 시도)`)
  }

  // 자리를 채우려고 실패분까지 세지 않는다 — `N/M회 읽음` 의 M 은 **실제로 물어본 횟수**다.
  const padded = [...parsed, ...Array.from({ length: Math.max(0, attempts - parsed.length) },
    () => emptyResult(kind, '빈 응답'))]
  return mergeOcrResults(padded, kind)
}



/**
 * 📄 모델 원문 한 개 → 구조화된 결과. **순수 함수**(네트워크·시각·난수 0)라 시험이 직접 부른다.
 *
 * 2026-09-21 에 `ocrDocument` 본문에서 잘라냈다 — 내용은 그대로다. 나눈 이유는 둘:
 * ① 여러 응답을 **각각** 파싱한 뒤 다수결해야 해서 ② 파싱 규칙이 실측을 만날 때마다 늘어나는데
 * (자리표시자·이스케이프된 JSON·등록번호 칸의 개업일) 그때마다 네트워크 호출 없이 시험하고 싶어서.
 */
export function parseOcrText(text: string, kind: DocKind): OcrDocResult {
  const m = text.match(/\{[\s\S]*?\}/)
  if (!m) return emptyResult(kind, '응답에서 JSON 을 찾지 못했습니다', text)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    // 🧵 2026-09-21 (S-OCR 실측 8회 중 1회): 모델이 JSON 을 **문자열로 한 번 더 감싸** 돌려줬다 —
    //   `"{\n \"biz_name\": ...}"` 처럼 따옴표가 역슬래시로 이스케이프돼 있어 그대로는 해석이 안 된다.
    //   다 읽어 놓고 `unreadable` 로 버리는 것이 아까우니 이스케이프를 한 겹 벗겨 한 번 더 시도한다.
    try {
      parsed = JSON.parse(m[0].replace(/\\"/g, '"').replace(/\\n/g, '\n')) as Record<string, unknown>
    } catch {
      return emptyResult(kind, 'JSON 을 해석하지 못했습니다', text)
    }
  }

  const bizNumberRaw = clean(parsed.biz_number)
  let bizNumber = bizNumberRaw ? bizNumberRaw.replace(/\D/g, '') : null
  let dateRaw = clean(parsed.permit_date)
  // 🔀 2026-09-21 (S-OCR 실측 5회 중 2회): 모델이 **등록번호 칸에 개업연월일**을 넣고 permit_date 는 비웠다
  //   (`"biz_number":"2024년 03월 02일","permit_date":null`). 숫자만 남기면 8자리라 등록번호 검사(10자리)에서 떨어져
  //   fill 이 0.75 로 깎이고, 어드민 화면엔 등록번호 빈칸 + 개업일 빈칸이 뜬다. 값이 날짜 모양이면 제자리로 옮긴다.
  if (bizNumberRaw && !dateRaw && bizNumber && bizNumber.length === 8 && /년|[-./]/.test(bizNumberRaw)) {
    dateRaw = bizNumberRaw
    bizNumber = null
  }
  const permitDate = dateRaw ? dateRaw.replace(/\D/g, '') : null

  const result: OcrDocResult = {
    ok: true,
    kind,
    bizName: clean(parsed.biz_name),
    address: clean(parsed.address),
    ownerName: clean(parsed.owner_name),
    bizNumber: bizNumber && /^\d{10}$/.test(bizNumber) ? bizNumber : null,
    mgtNo: clean(parsed.mgt_no),
    permitDate: permitDate && /^\d{8}$/.test(permitDate) ? permitDate : null,
    fill: 0,
    message: '',
    raw: text.slice(0, 1200),
  }

  // 충실도 — 그 서류에서 **기대되는** 필드만 센다(등록증에 관리번호를 기대하면 늘 낮게 나온다)
  const expected: Array<string | null> = kind === 'business_registration'
    ? [result.bizName, result.address, result.ownerName, result.bizNumber]
    : [result.bizName, result.address, result.mgtNo, result.permitDate]
  const got = expected.filter(Boolean).length
  result.fill = got / expected.length
  result.message = got === 0
    ? '항목을 하나도 읽지 못했습니다'
    : result.fill >= 0.75 ? '읽었습니다' : '일부만 읽었습니다'
  if (got === 0) result.ok = false

  return result
}

/**
 * 🗳️ 같은 사진을 여러 번 읽은 결과를 **필드별 다수결**로 합친다. 순수 함수.
 *
 * ## 왜 필드별인가
 * 20회 실측에서 한 응답이 통째로 맞거나 통째로 틀리지 않았다 — 한 응답 안에서도
 * 사업자번호는 맞고 주소만 `전북특벨자치도` 였다. 그래서 응답 하나를 고르는 게 아니라
 * **칸마다 따로** 센다.
 *
 * ## 정규화해서 묶는다
 * `전북 특별자치도 …`(4회) 와 `전북특별자치도 …`(3회) 는 **같은 답**이다(띄어쓰기만 다름).
 * 공백을 지워 묶으면 7회가 되어 다른 오독을 확실히 이긴다. 돌려주는 값은 그 무리의 **첫 원본**이다.
 *
 * ## ⚠️ 다수결이 못 고치는 것
 * 모델이 **일관되게** 잘못 읽는 글자(실측: 상호 `클`→`글` 이 9회 중 6회)는 다수결도 못 이긴다.
 * 그건 판독 모델을 바꿔야 하는 문제이고, 그래서 가입 화면은 상호를 **지도에서** 받는다.
 */
export function mergeOcrResults(results: OcrDocResult[], kind: DocKind): OcrDocResult {
  const read = results.filter((r) => r.ok)
  if (read.length === 0) {
    const first = results[0]
    return emptyResult(kind, first?.message || '읽지 못했습니다', first?.raw)
  }

  /** 공백을 지워 묶고, 가장 많이 나온 무리의 첫 원본을 돌려준다. */
  const vote = (pick: (r: OcrDocResult) => string | null): string | null => {
    const groups = new Map<string, { first: string; n: number }>()
    for (const r of read) {
      const v = pick(r)
      if (!v) continue
      const key = v.replace(/\s+/g, '')
      const g = groups.get(key)
      if (g) g.n += 1
      else groups.set(key, { first: v, n: 1 })
    }
    let best: { first: string; n: number } | null = null
    for (const g of groups.values()) if (!best || g.n > best.n) best = g
    return best ? best.first : null
  }

  const merged: OcrDocResult = {
    ok: true,
    kind,
    bizName: vote((r) => r.bizName),
    address: vote((r) => r.address),
    ownerName: vote((r) => r.ownerName),
    bizNumber: vote((r) => r.bizNumber),
    mgtNo: vote((r) => r.mgtNo),
    permitDate: vote((r) => r.permitDate),
    fill: 0,
    message: '',
    // 어드민이 "왜 이렇게 읽었나" 를 볼 수 있어야 한다 — 다수결에 참여한 첫 원문.
    raw: read[0].raw,
  }
  const expected: Array<string | null> = kind === 'business_registration'
    ? [merged.bizName, merged.address, merged.ownerName, merged.bizNumber]
    : [merged.bizName, merged.address, merged.mgtNo, merged.permitDate]
  const got = expected.filter(Boolean).length
  merged.fill = got / expected.length
  // 🔎 몇 번 중 몇 번이 읽혔는지 남긴다 — 이 모델은 같은 사진에도 절반쯤 빈손이라(실측),
  //   어드민이 "이 판정이 얼마나 단단한가" 를 알아야 한다.
  const tally = `${read.length}/${results.length}회 읽음`
  merged.message = got === 0
    ? `항목을 하나도 읽지 못했습니다 (${tally})`
    : `${merged.fill >= 0.75 ? '읽었습니다' : '일부만 읽었습니다'} (${tally})`
  if (got === 0) merged.ok = false
  return merged
}

/**
 * 자동 승인 게이트 — **기본 OFF**.
 *
 * 결재 §안전 레일 ①: 1단계는 추출값을 어드민 화면에 나란히 띄우기만 한다.
 * 이 함수가 `true` 를 돌려주기 전에는 어떤 코드도 `business_registration_status` 를
 * 스스로 `verified` 로 바꾸면 안 된다.
 *
 * ⚠️ 조회 실패는 `false`(= 꺼짐). 게이트는 **못 읽으면 닫히는 쪽**이 안전하다.
 */
export async function isOcrAutoVerifyEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'ocr_auto_verify_enabled' LIMIT 1",
    ).first<{ value: string }>()
    return String(row?.value || '').toLowerCase() === 'true'
  } catch {
    return false
  }
}
