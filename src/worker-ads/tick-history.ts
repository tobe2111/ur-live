/**
 * 📼 **회차 이력** — 지난 N회차가 각각 몇 개를 띄워 몇 개가 죽었는지 (2026-08-02).
 *
 * ## 왜 (내 측정이 틀렸다는 걸 발견하고 만들었다)
 * 붕괴 판정에 필요한 건 회차별 [띄운 수 ↔ 실패 수 ↔ 성공max ms] 인데, **어디에도 안 남아 있었다**:
 *
 * | 저장소 | 실제 보관 |
 * |---|---|
 * | `cron_hb:{레인이름}` | 레인당 **최신 1건**. 그 레인이 다음 회차에 또 돌면 **덮어쓴다** |
 * | `ads_dispatch_last` | **최신 회차 1건**. 매 회차 쓰지만 덮어쓴다 |
 *
 * 그래서 하트비트를 시각별로 묶어 세면 **옛 회차가 자동으로 작아 보인다** — 그 레인들이 그 뒤에
 * 다시 돌며 기록을 옮겨갔기 때문이다. 실제로 그 착시를 근거로 *"레인이 많은 회차일수록 더 죽는다"* 는
 * 신호를 보고했다가 **철회**했다. 덮어쓰기를 부하로 읽은 것이다.
 *
 * 🔑 **교훈**: *최신값만 보관하는 저장소로는 시계열을 만들 수 없다.* 만들려면 이력을 따로 남겨야 한다.
 *   (이 레포가 반복해 만난 "관측이 없어서 오진" 클래스의 새 변종 — 이번엔 관측이 *있는 것처럼 보였다*.)
 *
 * ## 설계 — 회차당 **쓰기 1회**, 링 버퍼
 * 부모가 마지막 flush 를 할 때 그 회차의 집계를 한 줄 append 한다.
 * ⚠️ **부모가 flush 전에 죽으면 그 회차는 이력에 없다.** 그건 결함이 아니라 **신호다** —
 *   "기록조차 못 남긴 회차"가 가장 심하게 붕괴한 회차이고, 빈자리가 그걸 말한다.
 *   (그래서 `at` 대신 `h`(UTC 시)를 키로 둬 빈 시각을 눈으로 셀 수 있게 한다.)
 * ⚠️ 값 길이 상한을 지킨다 — `platform_settings` 한 행에 무한정 쌓으면 읽기 비용이 커진다.
 */

/** 한 회차 요약. 키 이름이 짧은 이유: 24개가 한 행에 들어가야 한다. */
export interface TickSummary {
  /** 회차 시작 ISO — 같은 회차인지 판정하는 키. */
  at: string
  /** UTC 시(0~23). 빈 시각을 눈으로 세기 위한 것. ⚠️ 대표 보고는 KST(+9)로 변환할 것. */
  h: number
  /** 이번 회차에 **띄운** 레인 수(디스패처가 센 값 — 기록이 없어도 띄운 건 띄운 것이다). */
  ran: number
  /** 하트비트를 남긴 수(예산 밖 레인 포함) / 성공 / 실패. */
  n: number
  /**
   * 🔴 **띄웠는데 하트비트가 없는 레인 수** — 붕괴의 핵심 지표.
   *   ⚠️ 처음엔 `ran - n` 으로 계산했는데 **라이브에서 음수가 나왔다**(19:00 회차 `띄운 7 · 기록 9`).
   *     예산 밖 레인(`sheets-sync` 같은 생 waitUntil)과 DO 알람 레인이 **자기 하트비트를 따로** 남기기
   *     때문이다. 뺄셈은 두 집합이 같다고 가정했는데 그 가정이 거짓이었다.
   *   ⇒ **이름으로 대조**한다. 음수가 구조적으로 불가능하다.
   */
  miss: number
  /** 예산 밖에서 기록을 남긴 레인 수(우회·DO 알람·자식 self-beat). `n = (ran - miss) + off`. */
  off: number
  ok: number
  fail: number
  /** 성공 최대 ms ↔ 실패 최소 ms — 겹치면 '시간 벽'이 아니라 'CPU 고갈'이다(이 레포의 판정 관용구). */
  okMax: number
  failMin: number | null
  /** 실패한 레인 이름(상한 6개 — 길이 방어). */
  bad: string[]
}

/** 링 크기. 24 = 하루. 더 늘리면 값이 길어져 읽기가 비싸진다. */
export const TICK_HISTORY_CAP = 24
/** 값 길이 상한(문자) — 넘으면 오래된 것부터 더 버린다. */
export const TICK_HISTORY_MAX_CHARS = 8000
export const TICK_HISTORY_KEY = 'ads_tick_history'

/** 저장값 → 배열. 깨진 값·구 포맷에도 **던지지 않는다**(관측이 작업을 막으면 안 된다). */
export function readTickHistory(raw: unknown): TickSummary[] {
  if (Array.isArray(raw)) return raw.filter(isTick)
  if (typeof raw !== 'string' || !raw.trim().startsWith('[')) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(isTick) : []
  } catch { return [] }
}

function isTick(v: unknown): v is TickSummary {
  const o = v as TickSummary | null
  return !!o && typeof o.at === 'string' && Number.isFinite(o.ran) && Number.isFinite(o.n)
}

/**
 * 회차 하나를 덧붙인다(오래된 것부터 버림).
 *
 * ⚠️ **같은 `at` 이 이미 있으면 교체**한다 — 한 회차에 flush 가 두 번 일어나도 항목이 둘로 갈리지 않게.
 *   (갈리면 회차 수가 부풀어 "얼마나 자주 도는가"를 오판한다.)
 */
export function appendTick(prev: unknown, entry: TickSummary, cap = TICK_HISTORY_CAP): string {
  const list = readTickHistory(prev).filter(t => t.at !== entry.at)
  list.push(entry)
  let out = list.slice(-Math.max(1, cap))
  let json = JSON.stringify(out)
  // 길이 방어 — 이름이 길거나 실패가 많으면 24개도 길어질 수 있다.
  while (json.length > TICK_HISTORY_MAX_CHARS && out.length > 1) {
    out = out.slice(1)
    json = JSON.stringify(out)
  }
  return json
}

/**
 * 하트비트 목록 → 회차 요약.
 *
 * @param ranNames 이번 회차에 **디스패처가 띄운** 레인 이름(`ads:` 접두어 없이). 기록 목록과 **집합이 다르다** —
 *   예산 밖 레인이 따로 기록을 남기므로, 개수 뺄셈이 아니라 **이름 대조**로 판정해야 한다
 *   (라이브에서 `띄운 7 · 기록 9` 가 실제로 나왔다).
 */
export function summarizeTick(
  at: string, hourUTC: number, ranNames: readonly string[],
  beats: ReadonlyArray<{ name: string; ok: boolean; ms: number }>,
): TickSummary {
  // 🧹 `ads:scheduled`(회차가 울렸다는 사실 자체)는 레인이 아니다 — 세면 성공률이 부풀려진다.
  const lanes = beats.filter(b => b.name !== 'ads:scheduled')
  const ok = lanes.filter(b => b.ok)
  const bad = lanes.filter(b => !b.ok)
  const beatNames = new Set(lanes.map(b => b.name.replace(/^ads:/, '')))
  const ran = new Set(ranNames)
  return {
    at, h: hourUTC, ran: ran.size, n: lanes.length, ok: ok.length, fail: bad.length,
    miss: [...ran].filter(nm => !beatNames.has(nm)).length,
    off: [...beatNames].filter(nm => !ran.has(nm)).length,
    okMax: ok.reduce((m, b) => Math.max(m, b.ms), 0),
    failMin: bad.length ? bad.reduce((m, b) => Math.min(m, b.ms), Infinity) : null,
    bad: bad.map(b => b.name.replace(/^ads:/, '')).slice(0, 6),
  }
}
