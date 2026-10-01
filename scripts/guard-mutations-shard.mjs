/**
 * 🧩 **전수 주입 검증의 자동 분할** — 벽시계가 타임아웃을 향해 기어오르는 것을 구조적으로 끊는다.
 *
 * ## 왜 (2026-10-01 실측 — 대표 지시 "타임아웃 문제도 영구적으로 해결해줘")
 * `guard-mutations-full.yml` 야간 전수가 **3주 만에 두 배**가 됐다. 주입 수에 선형이고,
 * 주입은 "새 가드를 만들면 주입을 한 줄 추가" 룰 때문에 **구조적으로 계속 늘어난다**:
 * ```
 *   09-10  42분 (주입 ~1,500)      09-23  70분
 *   09-16  40분                    09-28  76분
 *   09-17  64분                    09-30  68분 (~2,230)
 *   10-01  77분+ (2,370)  ← timeout-minutes: 90 에 닿는 중
 * ```
 * 그 야간이 **전수의 유일한 보증**이다(PR 은 `--changed` 로만 돈다 — 두 워크플로가 짝이다).
 * 넘으면 `timed_out` 이라 빨간불은 뜨지만, **보증이 멈춘다.**
 *
 * ## 왜 "타임아웃 상향" 이 답이 아닌가
 * 90 → 180 은 같은 벽을 뒤로 미는 것뿐이고, 그 사이 ①주입은 계속 늘고 ②한 덩어리 3시간 작업은
 * 러너 손실 한 번에 통째로 날아간다. **벽시계를 주입 수와 무관하게 만드는 것**이 영구적이다.
 *
 * ## 처방: 벽시계 = O(주입수 / 조각수), 조각수는 **자동**
 * 조각 수를 사람이 관리하면 그 숫자가 낡는다(이 레포가 반복해 당한 "낡은 지도" — 같은 워크플로의
 * 주석이 실제로 `950건 × 40분` 이라고 2.5배 낡은 값을 적고 있었다). 그래서 **세어서 계산한다**:
 * 계획 작업이 주입 수를 읽어 조각 수를 정하고, 행렬이 그만큼 병렬로 돈다.
 * ⇒ 주입이 2,370 → 10,000 이 돼도 **사람이 고칠 것이 없다.**
 *
 * ## 이 모듈이 **못 하는 것**
 * 주입 하나하나가 느려지는 것(테스트 자체가 무거워지는 것)은 조각으로 못 막는다 —
 * 그건 `SECONDS_PER_INJECTION` 이 실측과 벌어지는 것으로 드러나고, 그때 이 상수를 갱신한다.
 * 상수가 낡아도 **조각이 늘어나는 방향**으로만 틀리므로(과소추정 → 조각 과다) 안전한 쪽이다.
 */

/**
 * 주입 1건당 벽시계. 2026-10-01 야간 실측에서 역산: `68분 × 60 / 2,230건 ≈ 1.83초`,
 * 같은 날 main push 실행은 `77분+ / 2,370건 ≈ 1.95초`. **보수적으로 2.0 초**를 쓴다.
 * ⚠️ 낮추지 말 것 — 낮추면 조각이 줄어 벽시계가 늘어난다(틀리면 타임아웃 쪽으로 틀린다).
 */
export const SECONDS_PER_INJECTION = 2.0

/**
 * 조각 하나의 목표 벽시계(분). 작게 잡는 이유는 둘이다 —
 * ① 러너 손실 시 잃는 것이 그만큼뿐 ② 야간 전체가 이 값 + 설치시간 안에 끝난다.
 * ⚠️ 조각마다 `checkout + npm ci` 고정비(실측 ~2분)가 붙으므로 무한히 쪼개는 건 손해다.
 */
export const TARGET_SHARD_MINUTES = 12

/**
 * 조각 수 상한. 폭주한 주입 수가 러너를 100개 띄우는 것을 막는다.
 * 이 상한에 닿으면 조각이 아니라 **주입 자체의 비용**을 봐야 한다는 신호다.
 */
export const MAX_SHARDS = 16

/**
 * 주입 수 → 조각 계획. 순수 함수(테스트가 문자열이 아니라 **동작**을 잰다).
 * @param {number} count 전체 주입 수
 * @returns {{ total: number, perShard: number, estMinutes: number }}
 */
export function planShards(count) {
  if (!Number.isFinite(count) || count < 0) throw new Error(`planShards: 주입 수가 숫자가 아니다 — ${count}`)
  const totalMinutes = (count * SECONDS_PER_INJECTION) / 60
  const want = Math.ceil(totalMinutes / TARGET_SHARD_MINUTES)
  // 0건이어도 조각 1개는 돈다 — 그 1개가 "0건이면 실패" 를 보고하는 자리다.
  const total = Math.min(MAX_SHARDS, Math.max(1, want))
  const perShard = Math.ceil(count / total)
  return { total, perShard, estMinutes: (perShard * SECONDS_PER_INJECTION) / 60 }
}

/**
 * 주입 i 번째가 어느 조각인가. **나머지 분배**라 조각 크기 차이가 최대 1 이다.
 * ⚠️ 해시가 아니라 색인을 쓰는 이유: 균형이 벽시계를 정한다(벽시계 = 가장 큰 조각).
 * 주입이 하나 늘면 배치가 섞이지만, 한 실행 안에서 **전수를 정확히 한 번** 덮으면 그걸로 족하다.
 * @param {number} i @param {number} total
 */
export function shardOf(i, total) {
  return i % total
}

/**
 * `--shard k/n` 파싱. 없으면 null(=전수).
 * @param {string[]} argv
 * @returns {{ index: number, total: number } | null}
 */
export function parseShard(argv) {
  const eq = argv.find((a) => a.startsWith('--shard='))
  const i = argv.indexOf('--shard')
  const raw = eq ? eq.slice('--shard='.length) : i !== -1 ? argv[i + 1] : null
  if (!raw) return null
  const m = /^(\d+)\/(\d+)$/.exec(raw.trim())
  if (!m) throw new Error(`--shard 는 \`k/n\` 형태다 (0 ≤ k < n) — 받은 값: ${raw}`)
  const index = Number(m[1])
  const total = Number(m[2])
  if (total < 1) throw new Error(`--shard: n 은 1 이상이어야 한다 — ${raw}`)
  if (index >= total) throw new Error(`--shard: k 는 n 보다 작아야 한다 — ${raw}`)
  return { index, total }
}

/**
 * 🖨️ `--plan <주입수>` — GitHub Actions 출력 형태로 계획을 찍는다.
 * 행렬을 사람이 적지 않게 하는 자리. 주입 수는 호출부(`--dump-manifest`)가 센 값을 넘긴다.
 */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  const pi = process.argv.indexOf('--plan')
  if (pi !== -1) {
    const count = Number(process.argv[pi + 1])
    const { total, perShard, estMinutes } = planShards(count)
    const matrix = JSON.stringify([...Array(total).keys()])
    process.stdout.write(`matrix=${matrix}\ntotal=${total}\n`)
    process.stderr.write(
      `🧩 주입 ${count}건 → 조각 ${total}개 × 약 ${perShard}건 (조각당 추정 ${estMinutes.toFixed(1)}분, ` +
        `목표 ${TARGET_SHARD_MINUTES}분 · 상한 ${MAX_SHARDS}조각)\n`,
    )
  }
}
