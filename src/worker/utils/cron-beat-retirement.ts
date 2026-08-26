/**
 * 🪦 **은퇴한 하트비트를 판정에서 걷어낸다** — 게이트가 *만족 가능하게* (2026-08-04)
 *
 * ## 왜 (라이브 실측)
 * `/api/_healthcheck/cron` 이 **6일째 503** 이었고, 그래서 `uptime.yml` 이 연 장애 이슈(#845)가
 * **코멘트 84개**를 쌓는 동안 아무도 안 봤다. 침묵으로 잡힌 19건이 **전부 `ads:*`** 였는데,
 * 그중 절반은 **고장이 아니라 이름이 은퇴한 것**이었다:
 *
 * ```
 *   ads:maintenance?phase=quality      1.8일 침묵      ← 그런데 ads:maintenance 는 12분 전에 실행됨
 *   ads:enrich-influencer-driver       1.8일 침묵      ← DO 알람 ads:enrich-influencer 가 인수
 *   ads:sweep-kakao-phone              6.0일 침묵      ← sweep-kakao-chain 으로 개명(라우트만 잔존)
 * ```
 *
 * 하트비트 행은 **레인보다 오래 산다.** 아무도 그 이름을 안 부르면 그 행은 영원히 안 갱신되고,
 * 영원히 `stale` 이고, `ok` 는 영원히 false 다. **꺼질 수 없는 게이트**다 — 같은 날 순환 경보에서
 * 고친 것(`judgeRotation`)과 정확히 같은 병이고, 이번엔 피해가 더 크다: 이 게이트는
 * **사이트 다운 감지와 같은 프로브**에 묶여 있어서, 빨간불이 상시가 되면 **진짜 다운을 가린다.**
 *
 * ## 원칙 — 정보는 남기고, 게이트만 만족 가능하게
 * 지우지 않는다. `retired`/`superseded` 로 **분류해서 계속 보여 주되** `ok` 를 물지 않게 한다.
 * "안 보이게 하는 것"과 "빨간불을 뗄 수 없게 두는 것"은 둘 다 나쁘고, 그 사이가 정답이다.
 */

/** `ads:` 접두와 쿼리스트링을 떼어 한 형태로 — 비교하는 **양쪽 모두** 이걸 통과해야 한다. */
export function beatBaseName(name: string): string {
  const s = String(name ?? '')
  return (s.startsWith('ads:') ? s.slice('ads:'.length) : s).split('?')[0]
}

/**
 * 은퇴 판정 배수 — 자기 임계의 **몇 배**를 넘겨야 "늦은 것"이 아니라 "없는 것"인가.
 *
 * ⚠️ 실측으로 고른 값이다. 라이브 19건을 이 배수로 갈랐을 때:
 * ```
 *   sweep-kakao-phone         57×  → 은퇴 ✅ (실제로 개명됨)
 *   enrich-influencer-driver  17×  → 은퇴 ✅ (DO 알람이 인수)
 *   collect-store-kakao       6.1× → 침묵 ✅ (진짜 밀리는 중)
 *   collect-hira              1.4× → 침묵 ✅ (진짜 밀리는 중)
 * ```
 * ⚠️ **낮추지 말 것** — 8 아래로 내리면 예산에 밀려 늦는 정상 레인이 "은퇴"로 숨어 버린다.
 *   그건 이 파일이 막으려는 것의 **정반대 사고**(고장을 조용히 지우는 것)다.
 */
export const RETIRED_GAP_MULTIPLE = 8
/** 배수와 **함께** 넘겨야 하는 절대 하한(분). 짧은 임계의 레인이 한두 시간 밀렸다고 은퇴가 되면 안 된다. */
export const RETIRED_MIN_AGE_MIN = 24 * 60

export interface BeatLike {
  name: string
  age_minutes?: number | null
  max_gap_min?: number | null
}

export type BeatVerdict = 'judge' | 'superseded' | 'retired'

/**
 * 🔀 **개명 지도** — 옛 이름 → 그 일을 지금 하는 이름.
 *
 * ## 왜 필요한가 (2026-08-25 라이브)
 * `d1-backup`(전체 덤프)은 DB 가 커져 08-02 이후 OOM 으로 죽었고, 같은 일을
 * `d1-backup-chunked` 가 이어받았다. 그런데 옛 하트비트 행은 남아 **영원히 빨간불**이다 —
 * 아래 ② 나이 규칙(8배)이 걷어 주긴 하지만 주간 임계(10,440분)의 8배라 **58일**이 걸린다.
 * 실측 그날 값: `age 32,545 / gap 10,440 = 3.1×` → 아직 `judge`, 즉 **5주를 더 빨갛게** 있는다.
 *
 * 이 파일 맨 위가 적어 둔 그대로다 — 빨간불이 상시가 되면 **진짜 다운을 가린다.**
 * ①(쿼리스트링 변종)은 `name?query` 만 보므로 *개명*은 못 잡는다. 그래서 지도를 둔다.
 *
 * ⚠️ **후임이 자기 임계 안에서 뛰고 있을 때만** 대체로 친다(`freshBaseNames`). 후임까지 죽으면
 *   옛 이름이 후임의 고장을 숨겨선 안 된다 — 그때는 후임 자신이 빨갛게 뜬다.
 * ⚠️ 지우지 않는다 — `superseded` 로 **계속 보여 주되** `ok` 만 안 문다(이 파일의 원칙).
 */
export const BEAT_RENAMED_TO: Readonly<Record<string, string>> = {
  'd1-backup': 'd1-backup-chunked',
  // 🔬 전역 진단 틱이 **트리거별**로 쪼개졌다(2026-08-25 #1210) — `__tick` → `__tick:{cron}`.
  //   같은 분에 여러 트리거가 울리면 전역 키를 마지막 하나가 덮어써서, 정작 가르려던
  //   "어느 트리거가 울렸나"를 못 갈랐다. 쪼갠 순간 옛 키는 **아무도 안 쓰는 이름**이 된다.
  //   🩸 실측: 배포 09:50 이 마지막 기록이고 임계 40분이라 **10:30 에 새 빨간불이 됐다** —
  //     바로 아래 `d1-backup` 을 걷어내는 그 작업 중에 내가 같은 클래스를 하나 새로 만든 것이다.
  //   후임은 5분 틱으로 고정한다(항상 신선 — 이 키가 낡으면 그건 진짜로 볼 일이다).
  '__tick': '__tick:*/5 * * * *',
}

/**
 * 하트비트 하나를 분류한다.
 *
 * - `superseded` … **같은 base 이름의 더 신선한 기록이 있다.** `maintenance?phase=quality` 가
 *   낡아도 `maintenance` 가 방금 뛰었으면 같은 일이 이름만 바꿔 도는 것이다. 임계가 필요 없는
 *   정확한 신호라 이름 규약이 또 바뀌어도 안 깨진다.
 * - `retired`    … 자기 임계의 `RETIRED_GAP_MULTIPLE` 배 **그리고** 하루를 넘겼다. 이 정도면
 *   "늦었다"가 아니라 아무도 안 부르는 이름이다.
 * - `judge`      … 나머지. 평소대로 `ok` 를 문다.
 *
 * ⚠️ 나이나 임계를 **모르면 `judge`** 다(보수적) — 모른다고 조용히 빼면 그게 곧 사각지대다.
 */
export function classifyBeat(
  beat: BeatLike,
  freshBaseNames: ReadonlySet<string>,
  /**
   * 🪦 지금 **디스패처가 알고 있는** 레인 base 이름(런타임이 매 실행 남기는 목록). 주면 판정이 훨씬 빨라진다.
   *
   *   ⚠️ 이게 없으면 **코드에서 삭제된 레인이 16일 동안 "진짜 침묵"으로 보인다**(은퇴 임계가 자기 주기의
   *   8배라서 — 48시간 주기면 384시간). 2026-08-10 에 그 때문에 실제로 오진했다: `collect-nara-vendor` 는
   *   `collect-nara-contract` 로 대체되며 **코드에서 사라진** 레인인데 "114시간째 멈춤"으로 보고돼,
   *   대표에게 **필요 없는 API 화면 캡처를 요청**했다. 나이는 은퇴를 늦게 말해 주지만 **"부르는 사람이
   *   없다"는 사실은 즉시 알 수 있다** — `orphanLaneBeats` 가 쓰던 바로 그 신호다.
   *   미지정이면 종전대로(나이 기반만) 동작한다.
   */
  knownBaseNames?: ReadonlySet<string>,
): BeatVerdict {
  const age = Number(beat?.age_minutes)
  const gap = Number(beat?.max_gap_min)
  if (!Number.isFinite(age) || !Number.isFinite(gap) || gap <= 0) return 'judge'
  // ① 같은 일이 다른 이름으로 살아 있다 — **쿼리 붙은 변종만** 해당(base 자신은 자기를 대체 못 한다).
  const raw = String(beat?.name ?? '')
  if (raw.includes('?') && freshBaseNames.has(beatBaseName(raw))) return 'superseded'
  // ①-a 개명 — 옛 이름의 일을 새 이름이 **지금** 하고 있다(위 지도). 나이 8배를 기다리지 않는다.
  const successor = BEAT_RENAMED_TO[beatBaseName(raw)]
  if (successor && freshBaseNames.has(successor)) return 'superseded'
  // ①-b 아무도 안 부르는 이름 — 디스패처 목록에 없고 하루 넘게 조용하면 은퇴다(나이 8배를 안 기다린다).
  //   ⚠️ 목록이 비어 있으면(부팅 직후·기록 유실) 판정하지 않는다 — 전 레인을 은퇴로 만들면 사각지대가 생긴다.
  if (knownBaseNames?.size && raw.startsWith('ads:') && !knownBaseNames.has(beatBaseName(raw)) && age > RETIRED_MIN_AGE_MIN) return 'retired'
  // ② 자기 임계를 한참 넘겼다 = 늦은 게 아니라 없는 것.
  if (age > gap * RETIRED_GAP_MULTIPLE && age > RETIRED_MIN_AGE_MIN) return 'retired'
  return 'judge'
}

/**
 * "지금 살아 있는 base 이름" 집합 — `classifyBeat` 의 `superseded` 판정 입력.
 *
 * ⚠️ **자기 임계 안에서 뛴 기록만** 신선으로 친다. 낡은 기록끼리 서로를 살려 주면
 *   레인이 통째로 죽었을 때 전부 `superseded` 로 숨어 버린다(사각지대 자가생성).
 */
export function freshBaseNames(beats: ReadonlyArray<BeatLike>): Set<string> {
  const out = new Set<string>()
  for (const b of beats) {
    const age = Number(b?.age_minutes)
    const gap = Number(b?.max_gap_min)
    if (!Number.isFinite(age) || !Number.isFinite(gap) || gap <= 0) continue
    if (age <= gap) out.add(beatBaseName(b.name))
  }
  return out
}
