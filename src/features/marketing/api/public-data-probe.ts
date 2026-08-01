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

type TargetDef = { label: string; url: (key: string, env: Env) => string }

/**
 * 프로브 대상 — **레인과 같은 상수**에서 만든다(따로 적으면 드리프트하고, 드리프트하면 프로브가 거짓말한다).
 *   통신판매는 `COMMERCE_SERVICES` 를 그대로 쓴다. 나머지는 각 레인의 base 상수와 같은 문자열을 쓰되
 *   `ads-public-data-probe.test.ts` 가 **원본 파일과 대조**해 어긋나면 실패시킨다.
 */
export const PROBE_TARGETS: Record<string, TargetDef> = {
  'commerce-status': {
    label: '통신판매 등록현황',
    url: (k) => `${COMMERCE_SERVICES[0].base}/${COMMERCE_SERVICES[0].op}?serviceKey=${serviceKeyParam(k)}&pageNo=1&numOfRows=1&type=json&_type=json&resultType=json`,
  },
  'commerce-detail': {
    label: '통신판매 등록상세',
    url: (k) => `${COMMERCE_SERVICES[1].base}/${COMMERCE_SERVICES[1].op}?serviceKey=${serviceKeyParam(k)}&pageNo=1&numOfRows=1&type=json&_type=json&resultType=json`,
  },
  franchise: {
    label: '공정위 가맹정보',
    url: (k) => `https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandReleaseInfo?serviceKey=${serviceKeyParam(k)}&pageNo=1&numOfRows=1&resultType=json`,
  },
  nara: {
    label: '나라장터 조달업체',
    url: (k) => `https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpBasicInfo?serviceKey=${serviceKeyParam(k)}&pageNo=1&numOfRows=1&type=json`,
  },
  localdata: {
    label: '인허가(일반음식점)',
    url: (k) => `https://apis.data.go.kr/1741000/general_restaurants?serviceKey=${serviceKeyParam(k)}&pageIndex=1&pageSize=1&type=json&resultType=json`,
  },
  nps: {
    label: '국민연금 사업장',
    url: (k) => `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${serviceKeyParam(k)}&pageNo=1&numOfRows=1&dataType=JSON`,
  },
}

/** 대상 이름 목록 — 어드민이 무엇을 찌를 수 있는지 보여 주기 위해. */
export function probeTargetNames(): string[] { return Object.keys(PROBE_TARGETS) }

/**
 * 한 대상을 **1회** 찌른다. 절대 던지지 않는다(진단이 500 을 내면 진단이 아니다).
 * @param keyOverride 시험용. 실전에서는 `PUBLIC_DATA_SERVICE_KEY` 를 쓴다.
 */
export async function probePublicData(env: Env, target: string, keyOverride?: string): Promise<ProbeResult> {
  const def = PROBE_TARGETS[target]
  const base: ProbeResult = { target, label: def?.label || target, url: '', http: null, body: '', is_json: false, hard: false }
  if (!def) return { ...base, error: `알 수 없는 대상 — ${probeTargetNames().join(', ')} 중 하나` }

  const key = keyOverride ?? String((env as unknown as { PUBLIC_DATA_SERVICE_KEY?: string }).PUBLIC_DATA_SERVICE_KEY || '')
  if (!key) return { ...base, error: 'PUBLIC_DATA_SERVICE_KEY 미설정', hard: true }

  const url = def.url(key, env)
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
export async function probeAllPublicData(env: Env): Promise<ProbeResult[]> {
  const names = probeTargetNames()
  const out: ProbeResult[] = []
  for (const n of names) out.push(await probePublicData(env, n))
  return out
}
