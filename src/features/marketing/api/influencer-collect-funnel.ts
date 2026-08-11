/**
 * 📈 **회차 퍼널 시계열** — "어제와 오늘이 왜 다른가"를 볼 수 있게 (2026-08-11 대표 승인 "3번").
 *
 * ## 왜 (오늘 조사가 오래 걸린 이유가 그대로 근거다)
 * 대표가 *"발굴량이 줄어들면 안 돼"* 라고 했고 실제로 4일 연속 하락이 있었다. 그런데 원인을 재려니
 * **회차 기록이 마지막 1회분만 남아 있었다**(`ads_autocollect_stats` 는 매 회차 덮어쓴다).
 * 남아 있는 것은 리드 테이블의 일별 건수뿐이라 *"몇 명 들어왔나"* 는 알아도
 * *"몇 번 시도해서, 얼마를 쓰고, 어디서 잘렸나"* 는 **영영 모른다**. 그래서 이렇게 됐다:
 * ```
 *   같은 날 두 회차의 네이버 수확률   458→50 (10.9%)   vs   538→317 (58.9%)
 * ```
 * 회차마다 6배 흔들리는데 **그 분포를 볼 방법이 없었다.** 추측으로 처방을 내면 이 레포가 반복해 겪은
 * 오진이 된다(08-09 에 키워드 상한을 올리며 "8천~1.2만"을 기대했다가 오히려 내려간 것이 그 예다).
 *
 * ## 🚫 이 파일이 **하지 않는 것** — 대표 지시 (2026-08-11)
 * > *"유튜브는 최대한 계속 받아내고 싶어"*
 *
 * 조사에서 *"요청당 제안가능 리드가 네이버 3.07 vs 유튜브 0.28(11배)"* 라는 숫자가 나왔고
 * **유튜브 비중 축소**를 제안했는데 대표가 **명시적으로 거부**했다. 그러니 이 시계열을 보고
 * *"유튜브가 비효율이니 줄이자"* 로 가지 말 것 — **그 결정은 이미 내려졌다.**
 * 이 데이터의 용도는 *"같은 유튜브 몫을 유지하면서 어디서 더 벌 수 있나"* 이지 유튜브 삭감이 아니다.
 *
 * ## 비용 0 — 새 쓰기를 안 만든다
 * 수집 레인은 이미 회차마다 `ads_autocollect_stats` 를 **읽고 쓴다**(1 batch 안). 이 시계열은 그 JSON
 * 안에 얹히므로 **서브리퀘스트가 0개 늘어난다.** 회차는 이미 `spent 56/56` 로 예산을 100% 쓰고 있어서
 * (실측) 여기서 D1 쓰기를 하나라도 더하면 **그만큼 발굴이 잘린다** — 관측을 만들려다 관측 대상을 줄이는 셈.
 *
 * ⚠️ **KST 로 묶는다.** 워커 런타임은 UTC 라 `toISOString().slice(0,10)` 으로 묶으면 한국 기준 하루가
 *   두 날에 갈린다(CLAUDE.md 시각 규칙 — 이 레포가 반복해 틀린 자리).
 */

/** 한 회차가 남기는 값 — 전부 이미 계산돼 있는 것들이다(새로 재지 않는다). */
export interface FunnelRound {
  /** 회차 시각(ms). 테스트가 주입한다 — 워커에서 `Date.now()`. */
  at: number
  saved: number
  planned: number
  processed: number
  spent: number
  budget: number
  yt: { found: number; saved: number; spend: number }
  nb: { found: number; saved: number; spend: number }
}

/** 하루치 합계. 필드명이 짧은 이유: 이 JSON 은 다른 관측값과 **같은 행**에 산다(길이 상한 공유). */
export interface FunnelDay {
  d: string; n: number; saved: number; planned: number; processed: number; spent: number
  ytF: number; ytS: number; ytB: number
  nbF: number; nbS: number; nbB: number
}

export interface CollectFunnel {
  /** 최신이 마지막. KST 일자. */
  days: FunnelDay[]
  /** 최근 회차 원본 — 일 합계가 가리는 **회차 간 편차**를 보려고 남긴다(위 10.9% vs 58.9%). */
  recent: FunnelRound[]
}

/** 보존 창 — 넓게 잡을수록 좋지만 이 JSON 은 다른 값과 한 행을 쓴다. 2주면 주간 주기를 두 번 본다. */
export const FUNNEL_DAYS = 14
/** 회차 원본 보존 수 — 하루 24회차 중 최근 12개(반나절). 편차 확인용이라 전량은 필요 없다. */
export const FUNNEL_ROUNDS = 12

/**
 * 🇰🇷 KST 일자 키. **UTC 로 자르면 한국 기준 하루가 갈린다** — 이 레포의 반복 실수라 여기서 명시적으로 민다.
 *   (`src/utils/date.ts` 는 브라우저/워커 공용 SSOT 이지만 여기 필요한 건 '일자 키' 하나뿐이라 인라인.)
 */
export const kstDay = (ms: number): string => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)

const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0)

/**
 * 회차 하나를 시계열에 얹는다 — **순수함수**(유닛이 고정). 이전 값이 깨져 있어도 새로 시작한다
 * (관측이 예외를 던져 수집을 멈추면 본말전도다).
 */
export function appendCollectFunnel(prev: CollectFunnel | undefined | null, r: FunnelRound): CollectFunnel {
  const days = Array.isArray(prev?.days) ? [...prev!.days] : []
  const recent = Array.isArray(prev?.recent) ? [...prev!.recent] : []
  const d = kstDay(r.at)
  const last = days.length ? days[days.length - 1] : null
  // ⚠️ 같은 날이면 **합산**, 아니면 새 줄. 날짜가 뒤로 가는 입력(시계 보정 등)은 마지막 줄에 합산한다 —
  //   과거 줄을 뒤져 고치면 순서가 깨져 그래프가 뒤엉킨다.
  const row: FunnelDay = last && last.d === d ? last : {
    d, n: 0, saved: 0, planned: 0, processed: 0, spent: 0,
    ytF: 0, ytS: 0, ytB: 0, nbF: 0, nbS: 0, nbB: 0,
  }
  row.n += 1
  row.saved += n(r.saved); row.planned += n(r.planned); row.processed += n(r.processed); row.spent += n(r.spent)
  row.ytF += n(r.yt?.found); row.ytS += n(r.yt?.saved); row.ytB += n(r.yt?.spend)
  row.nbF += n(r.nb?.found); row.nbS += n(r.nb?.saved); row.nbB += n(r.nb?.spend)
  if (!(last && last.d === d)) days.push(row)

  recent.push({
    at: r.at, saved: n(r.saved), planned: n(r.planned), processed: n(r.processed), spent: n(r.spent), budget: n(r.budget),
    yt: { found: n(r.yt?.found), saved: n(r.yt?.saved), spend: n(r.yt?.spend) },
    nb: { found: n(r.nb?.found), saved: n(r.nb?.saved), spend: n(r.nb?.spend) },
  })
  return { days: days.slice(-FUNNEL_DAYS), recent: recent.slice(-FUNNEL_ROUNDS) }
}

/**
 * 사람이 바로 읽는 요약 — **총계가 아니라 "요청당 수확"** 으로 준다.
 *
 * 유어애즈의 유일한 지표는 *"제안 보낼 수 있는 리드 수"* 이고(CLAUDE.md), 그 앞단의 효율은
 * **서브리퀘스트당 저장 수**다(회차 예산이 100% 소진되는 것이 실측이라, 요청이 곧 희소자원이다).
 * 총계만 보면 "오늘 적게 들어왔다"까지만 알고 **왜**를 모른다 — 오늘 조사가 그래서 길었다.
 */
export function funnelSummary(f: CollectFunnel | undefined | null): Array<{ d: string; saved: number; perReq: number; ytPerReq: number; nbPerReq: number; fill: number }> {
  const days = Array.isArray(f?.days) ? f!.days : []
  const per = (s: number, b: number): number => (b > 0 ? Math.round((s / b) * 100) / 100 : 0)
  return days.map(x => ({
    d: x.d,
    saved: x.saved,
    perReq: per(x.saved, x.spent),
    ytPerReq: per(x.ytS, x.ytB),
    nbPerReq: per(x.nbS, x.nbB),
    // 계획 대비 실제 처리 비율 — 낮으면 예산이 회차 중간에 마른 것이다(실측 planned 16 → processed 7).
    fill: x.planned > 0 ? Math.round((x.processed / x.planned) * 100) / 100 : 0,
  }))
}
