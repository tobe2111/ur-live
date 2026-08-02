/**
 * 🔬 **공공 API 한 방 프로브** — 상대가 실제로 뭐라고 답하는지 그 자리에서 본다 (2026-08-01 신설).
 *
 * ## 왜 이게 필요했나 (실측)
 * 공공데이터 레인 다섯 개가 며칠째 0건인데 **원문을 한 번도 못 읽었다.**
 *
 * | 레인 | 마지막 실적 | 저장된 진단 |
 * |---|---|---|
 * | 통신판매(누적 13만 — 최대 공급원) | 07-29 14:00 | `등록현황: 비JSON 응답 \| 등록상세: 비JSON 응답` |
 * | 인허가(매장 후보) | 07-31 20:02 | `HTTP 500 — Unexpected errors` |
 * | 공정위 가맹 · 나라장터 | 07-31 | `HTTP 404 — API not found` |
 * | 고용24 | 07-31 | `개인회원은 사용할 수 없는 OPEN-API입니다` |
 *
 * 저 문구들은 **요약이다.** 원문은 레인이 D1 에 스탬프를 쓸 때 비로소 남는데, 그 레인들은
 * *스탬프를 쓰기 전에 죽는다*(08-01 하루종일 판 그 문제). 08-01 13:47 에 통신판매를 수동
 * 트리거해 72초를 지켜봤지만 `last_run` 은 **07-29 그대로**였다 — 즉 **레인을 통해서는
 * 원문을 볼 수 없다.** 관측이 관측 대상의 생존에 걸려 있는 구조 자체가 문제다.
 *
 * ## 그래서 이 모듈은 레인이 아니다
 * fetch **1회**, D1 쓰기 **0회**, 결과를 **HTTP 응답 본문으로 즉시** 돌려준다.
 * 예산·커서·스탬프·체인 전부 없다 ⇒ 죽을 자리가 없다.
 *
 * ## 🔐 키는 반드시 가린다
 * 이 레포는 **public** 이고 프로브 결과는 어드민 화면과 인계 문서로 흘러간다.
 * data.go.kr 게이트웨이는 오류 본문에 **요청 URL 을 통째로 echo 하는 경우가 있다** —
 * 그래서 URL 뿐 아니라 **본문에도** `redactServiceKey` 를 먹인다. 키가 한 번 실리면 회수 불가다.
 *
 * ## ⚠️ 못 하는 것 (과신 금지)
 * - **고치지 않는다.** 무엇이 잘못됐는지 보여줄 뿐이다.
 * - 레인이 실제로 쓰는 파라미터(페이지·날짜·업종 커서)까지 재현하지는 않는다. 1페이지 최소 요청만 쏜다
 *   → "인증·엔드포인트는 되는데 특정 파라미터에서 깨진다" 는 경우 프로브는 **초록으로 나온다.**
 *   그건 그것대로 값진 신호다(원인을 파라미터로 좁혀 준다).
 * - 이 개발환경에서는 `apis.data.go.kr` 로 나가는 CONNECT 가 프록시에 막혀 있어 **로컬에서 못 돌린다.**
 *   반드시 라이브(ur-ads, 키가 있는 곳)에서 돈다.
 */
import { redactServiceKey } from './license-url'
import { serviceKeyParam, describePublicDataBody, isHardConfigFailure } from './public-data-diag'
import { COMMERCE_SERVICES } from './commerce-notify-collect'
import type { Env } from '@/worker/types/env'

/** 응답 본문에서 남길 최대 길이 — 어드민 화면에 붙여넣을 만큼만(전문 로그가 아니다). */
const BODY_MAX = 900

export interface ProbeResult {
  target: string
  label: string
  /** 🔐 키가 가려진 요청 URL — 그대로 대표께 보여드릴 수 있어야 한다. */
  url: string
  /** fetch 자체가 실패하면 null(그때 `error` 에 사유). */
  http: number | null
  content_type?: string
  /** 🔐 키가 가려진 응답 본문 앞부분. JSON 이면 그대로, XML/HTML 이면 태그째 보여 준다(형태가 단서다). */
  body: string
  /** 본문이 JSON 으로 파싱되는가 — "비JSON 응답" 의 정체를 가르는 첫 갈래. */
  is_json: boolean
  /** 알려진 공공데이터 오류코드 해석(있으면). */
  hint?: string
  /** 사람이 고쳐야 낫는 실패인가(활용신청·회원등급·엔드포인트) vs 일시 장애인가. */
  hard: boolean
  error?: string
}

/**
 * 🔬 **파라미터를 흔들 수 있어야 한다** (2026-08-01 프로브 1차 실행이 곧바로 요구한 것).
 *
 *   첫 실행에서 통신판매가 **HTTP 200 · JSON · totalCount 2,649,409** 로 완벽히 정상이었다.
 *   즉 키·활용신청·엔드포인트 전부 유효한데 **레인만 "비JSON 응답"** 을 받는다.
 *   프로브와 레인의 차이는 딱 하나 — `numOfRows` 가 **1 vs 500**, `pageNo` 가 **1 vs 63**.
 *   ⇒ 그 둘을 흔들어 **어디서 깨지는지**를 좁힌다. 이 모듈의 원래 한계 주석("특정 파라미터에서
 *     깨지면 프로브는 초록으로 나온다")이 예고한 바로 그 후속이다.
 */
export interface ProbeOpts {
  rows?: number
  page?: number
  /**
   * 🧭 **후보 경로**(배포 없이 죽은 엔드포인트의 후임을 찾는다 — 2026-08-02 신설).
   *
   *   왜 필요한가: 인허가 레인이 `NO_OPENAPI_SERVICE_ERROR`(*"해당 오픈API 서비스가 없거나 폐기됨"*)로
   *   죽어 있는데, **맞는 주소를 확인할 방법이 배포뿐**이었다. 후보 하나 시험하는 데 배포 한 번이면
   *   아무도 안 찾는다. 그래서 경로만 갈아 끼워 그 자리에서 찔러 본다.
   *
   *   🔒 **호스트는 고정이다**(`apis.data.go.kr`) — 임의 URL 을 받으면 어드민 인증이 있어도 SSRF 다.
   *     경로만 받고, 서비스키·페이징은 이 모듈이 붙인다(키가 로그·화면에 새지 않게).
   */
  path?: string
  /** 후보 경로의 호스트(상대 경로일 때만 의미 있다). 허용 목록 밖이면 **거절**된다. */
  host?: string
}

/**
 * 후보 경로 프로브가 허용하는 **고정 호스트 목록**. 임의 URL 을 여는 게 아니라 *열거된 둘*뿐이다.
 * ⚠️ 늘리지 말 것 — 하나 늘 때마다 SSRF 표면이 그만큼 늘어난다. 늘려야 하면 **왜 그 호스트인지**를
 *   여기에 근거로 남겨라(아래 두 개처럼).
 *
 *   - `apis.data.go.kr` — 공공데이터포털 게이트웨이. 우리 레인 대부분이 여기로 간다.
 *   - `www.localdata.go.kr` — 지방행정 인허가 **원천**(2026-08-02 추가). 우리 레인의 페이징 파라미터가
 *     `pageIndex`/`pageSize` 이고 업종 키가 `opnSvcId` 인 것이 이 호스트의 규약과 정확히 일치한다 —
 *     즉 이 코드는 원래 여기를 향해 쓰였고, "폐쇄 후 이관" 때 base 만 바뀌었는데 그 경로가 존재하지 않는다.
 */
export const PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr'] as const
export type ProbeHost = (typeof PROBE_ALLOWED_HOSTS)[number]
/** @deprecated 단수 상수는 남겨 둔다(기존 호출부·시험 호환). 판정은 `PROBE_ALLOWED_HOSTS` 가 한다. */
export const PROBE_ALLOWED_HOST: ProbeHost = PROBE_ALLOWED_HOSTS[0]

/**
 * 경로 정규화 — 앞 슬래시·공백·쿼리스트링을 떼고 **호스트와 경로**만 남긴다(쿼리는 이 모듈이 붙인다).
 * @param defaultHost 상대 경로일 때 쓸 호스트(미지정이면 공공데이터포털).
 * @returns 허용 호스트가 아니거나 경로 문자가 아니면 `null` — **조용히 무시하지 않고 거절**한다.
 */
export function normalizeProbePath(raw: string | undefined | null, defaultHost?: string): { host: ProbeHost; path: string } | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const pickHost = (h: string | undefined): ProbeHost | null =>
    (PROBE_ALLOWED_HOSTS as readonly string[]).includes(String(h || '')) ? (h as ProbeHost) : null
  // 절대 URL 이 오면 **허용 호스트일 때만** 경로를 취한다(다른 호스트는 거절 — 조용히 무시하지 않는다).
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      const h = pickHost(u.hostname)
      if (!h) return null
      return { host: h, path: u.pathname.replace(/^\/+/, '') }
    } catch { return null }
  }
  if (t.includes('?') || t.includes('#')) return null // 쿼리 주입 차단(키 파라미터를 덮어쓸 수 있다)
  if (!/^[A-Za-z0-9._~\-/]+$/.test(t)) return null    // 경로 문자만
  return { host: pickHost(defaultHost) || PROBE_ALLOWED_HOSTS[0], path: t.replace(/^\/+/, '') }
}

/** ⚠️ 페이징만 받는다 — `path`(후보 경로)는 대상 정의와 무관하다(그건 대상을 *대체*하는 것이다). */
export type ProbePaging = { rows: number; page: number }
type TargetDef = { label: string; url: (key: string, env: Env, o: ProbePaging) => string }

/**
 * 프로브 대상 — **레인과 같은 상수**에서 만든다(따로 적으면 드리프트하고, 드리프트하면 프로브가 거짓말한다).
 *   통신판매는 `COMMERCE_SERVICES` 를 그대로 쓴다. 나머지는 각 레인의 base 상수와 같은 문자열을 쓰되
 *   `ads-public-data-probe.test.ts` 가 **원본 파일과 대조**해 어긋나면 실패시킨다.
 */
export const PROBE_TARGETS: Record<string, TargetDef> = {
  'commerce-status': {
    label: '통신판매 등록현황',
    url: (k, _e, o) => `${COMMERCE_SERVICES[0].base}/${COMMERCE_SERVICES[0].op}?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&type=json&_type=json&resultType=json`,
  },
  'commerce-detail': {
    label: '통신판매 등록상세',
    url: (k, _e, o) => `${COMMERCE_SERVICES[1].base}/${COMMERCE_SERVICES[1].op}?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&type=json&_type=json&resultType=json`,
  },
  franchise: {
    // ⚠️ 2026-08-02 실측 수리: 오퍼레이션이 `getBrandReleaseInfo` 로 적혀 있었는데 **레인은 `getBrandList`** 다.
    //   그래서 레인은 `HTTP 404 — API not found`, 프로브는 `400 NO_OPENAPI_SERVICE_ERROR` 로 **다른 답**이 왔고,
    //   나는 그 400 을 근거로 "서비스가 폐기됐다"고 판정할 뻔했다. 프로브가 레인과 다른 곳을 찌르면
    //   초록이든 빨강이든 **오진의 재료**가 된다. 기존 유닛은 서비스명(`FftcBrandRlsInfo2_Service`)만 대조해
    //   오퍼레이션 차이를 통과시켰다 — 그 구멍을 같은 커밋에서 막았다.
    label: '공정위 가맹정보',
    url: (k, _e, o) => `https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandList?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&resultType=json`,
  },
  nara: {
    label: '나라장터 조달업체',
    url: (k, _e, o) => `https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpBasicInfo?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&type=json`,
  },
  localdata: {
    label: '인허가(일반음식점)',
    url: (k, _e, o) => `https://apis.data.go.kr/1741000/general_restaurants?serviceKey=${serviceKeyParam(k)}&pageIndex=${o.page}&pageSize=${o.rows}&type=json&resultType=json`,
  },
  hira: {
    // 🏥 심평원 병원정보 — 2026-08-02 신설. **60회 실행에 저장 0**(timeout)인데 프로브 대상이 아니라
    //   원문을 한 번도 못 봤다. 진단할 수 없는 레인은 고칠 수도 없다.
    //   ⚠️ base 는 `hira-hospital-collect.ts` 의 `HIRA_BASE` 와 **같은 문자열**이어야 한다
    //     (유닛이 원본 파일과 대조한다 — 따로 적으면 프로브가 거짓말한다).
    label: '심평원 병원정보',
    url: (k, _e, o) => `https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&_type=json`,
  },
  nps: {
    label: '국민연금 사업장',
    url: (k, _e, o) => `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${serviceKeyParam(k)}&pageNo=${o.page}&numOfRows=${o.rows}&dataType=JSON`,
  },
}

/** 대상 이름 목록 — 어드민이 무엇을 찌를 수 있는지 보여 주기 위해. */
export function probeTargetNames(): string[] { return Object.keys(PROBE_TARGETS) }

/**
 * 한 대상을 **1회** 찌른다. 절대 던지지 않는다(진단이 500 을 내면 진단이 아니다).
 * @param keyOverride 시험용. 실전에서는 `PUBLIC_DATA_SERVICE_KEY` 를 쓴다.
 */
export async function probePublicData(env: Env, target: string, keyOverride?: string, opts?: ProbeOpts): Promise<ProbeResult> {
  // 상한을 둔다 — 프로브가 수집처럼 굴면 안 되고, 잘못된 값이 상대편에 부담을 주면 안 된다.
  const o = {
    rows: Math.min(1000, Math.max(1, Math.trunc(Number(opts?.rows)) || 1)),
    page: Math.min(100000, Math.max(1, Math.trunc(Number(opts?.page)) || 1)),
  }
  // 🧭 후보 경로가 오면 **대상 정의를 대체**한다 — 죽은 엔드포인트의 후임을 배포 없이 찾기 위해.
  const candidate = normalizeProbePath(opts?.path, opts?.host)
  const rejectedPath = !!opts?.path && !candidate // 거절은 조용히 넘기지 않는다(왜 안 됐는지 말해야 고친다)
  const def = PROBE_TARGETS[target]
  const label = candidate ? `후보 경로 — ${candidate.host}/${candidate.path}` : (def?.label || target)
  const base: ProbeResult = { target, label, url: '', http: null, body: '', is_json: false, hard: false }
  if (rejectedPath) return { ...base, error: `후보 경로 거절 — ${PROBE_ALLOWED_HOSTS.join(' 또는 ')} 의 경로만 받습니다(쿼리·다른 호스트 불가)`, hard: true }
  if (!def && !candidate) return { ...base, error: `알 수 없는 대상 — ${probeTargetNames().join(', ')} 중 하나` }

  const key = keyOverride ?? String((env as unknown as { PUBLIC_DATA_SERVICE_KEY?: string }).PUBLIC_DATA_SERVICE_KEY || '')
  //   🔑 **키를 발급처가 아닌 호스트로 보내지 않는다.** LOCALDATA 는 자체 키 체계(`authKey`)를 쓰고
  //     우리가 가진 건 공공데이터포털 `serviceKey` 다. 남의 호스트에 우리 키를 실어 보내는 건
  //     "혹시 되나" 보려고 자격증명을 흘리는 것이다. 키 없이 찔러도 **판정은 된다** —
  //     인증 오류가 오면 *"엔드포인트는 존재한다"*, `NO_OPENAPI_SERVICE_ERROR` 면 *"여기도 아니다"* 다.
  const needsKey = !candidate || candidate.host === 'apis.data.go.kr'
  if (!key && needsKey) return { ...base, error: 'PUBLIC_DATA_SERVICE_KEY 미설정', hard: true }

  //   공공데이터포털은 페이징 파라미터 이름이 서비스마다 갈린다(pageNo/numOfRows ↔ pageIndex/pageSize).
  //   후보를 찌를 땐 **둘 다** 실어 보낸다 — 모르는 쪽을 무시하는 게 이 게이트웨이의 동작이고,
  //   하나만 보내면 "이름이 달라서" 실패한 것을 "주소가 틀려서"로 오진하게 된다.
  const paging = `pageNo=${o.page}&numOfRows=${o.rows}&pageIndex=${o.page}&pageSize=${o.rows}&type=json&_type=json&resultType=json`
  const url = candidate
    ? (candidate.host === 'apis.data.go.kr'
      ? `https://${candidate.host}/${candidate.path}?serviceKey=${serviceKeyParam(key)}&${paging}`
      : `https://${candidate.host}/${candidate.path}?${paging}`) // 키 없이 — 존재 여부만 판정(위 주석)
    : def!.url(key, env, o)
  const safeUrl = redactServiceKey(url)
  let res: Response | null = null
  let netErr = ''
  try { res = await fetch(url, { signal: AbortSignal.timeout(15_000) }) } catch (e) { netErr = String((e as Error)?.message || e || '네트워크 오류') }
  if (!res) return { ...base, url: safeUrl, error: redactServiceKey(netErr).slice(0, 200) }

  const raw = await res.text().catch(() => '')
  // 🔐 게이트웨이가 오류 본문에 요청 URL 을 echo 하는 경우가 있다 — 본문에도 반드시 먹인다.
  const body = redactServiceKey(raw).slice(0, BODY_MAX)
  let isJson = false
  try { JSON.parse(raw); isJson = true } catch { isJson = false }
  const hint = describePublicDataBody(raw) || undefined
  // 판정 재료를 한 문자열로 모아 하드/소프트를 가른다(레인이 쓰는 것과 같은 기준).
  const verdictSrc = `HTTP ${res.status} ${hint || ''} ${body}`
  return {
    ...base,
    url: safeUrl,
    http: res.status,
    content_type: res.headers.get('content-type') || undefined,
    body,
    is_json: isJson,
    hint,
    hard: isHardConfigFailure(verdictSrc),
  }
}

/** 전부 한 번씩 — 대상 6개면 fetch 6회. 어느 것이 살아 있는지 한 화면에서 본다(대조군이 곧 진단이다). */
export async function probeAllPublicData(env: Env, opts?: ProbeOpts): Promise<ProbeResult[]> {
  const names = probeTargetNames()
  const out: ProbeResult[] = []
  for (const n of names) out.push(await probePublicData(env, n, undefined, opts))
  return out
}

/**
 * 🪜 **어디서 깨지는지 좁힌다** — 같은 대상에 rows 를 키워 가며 첫 실패 지점을 찾는다.
 *   레인이 쓰는 값(통신판매 500)까지 훑으면 "몇 건부터 게이트웨이가 무너지는가" 가 한 번에 나온다.
 *   ⚠️ 실패해도 멈추지 않고 끝까지 훑는다 — 간헐 실패와 임계값 실패는 다르고, 그 구분이 처방을 가른다.
 */
export async function probeLadder(env: Env, target: string, rowsList: number[], page = 1): Promise<ProbeResult[]> {
  const out: ProbeResult[] = []
  for (const rows of rowsList) out.push(await probePublicData(env, target, undefined, { rows, page }))
  return out
}
