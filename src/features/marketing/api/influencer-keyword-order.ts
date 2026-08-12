/**
 * 🔀 **키워드 픽 배치(순서) 전용** — 무엇을 뽑을지는 `influencer-keyword-rotation.ts`, 그것을 **어떤 순서로
 * 늘어놓을지**가 여기다. 순수 함수라 유닛으로 전수 검증된다.
 *
 * ⚠️ 분리 이유는 600줄 래칫이다(2026-08-11). 로직은 **이동만** 했고 호환을 위해 원래 모듈이
 *   이 심볼들을 그대로 재수출한다(기존 import 경로 유지).
 * ⚠️ 두 함수의 공통 불변식: **각 목록의 상대 순서를 보존한다** — 호출부의 커서 전진(`prefixDone`)이
 *   각 목록의 *선행 구간* 길이를 세므로, 뒤섞으면 커서 계산이 조용히 깨진다.
 */

/**
 * 🔀 **YT 픽과 커서 픽을 번갈아 놓는다** — 커서가 영영 안 도는 것을 푼다 (2026-07-29 실측).
 *
 * ## 무엇이 고장이었나 (12:00 틱)
 * `picks { planned: 16, processed: 2, from_yt: 2, from_cursor: 0 }` — 16개를 계획했는데 예산으로 2개만
 * 돌았고 **둘 다 YT 픽**이었다. 배열이 `[...ytPicks, ...cursorPicks]` 라 커서 픽은 전부 꼬리에 있었다.
 *
 * 그런데 커서 전진은 `prefixDone`(처리된 **선행 구간** 길이)으로 계산한다 → 커서 픽이 한 번도 처리되지
 * 않으니 `nextCursor = cursor + 0` → **커서가 영원히 제자리**다. 두 결함이 서로를 강화한다:
 * 꼬리라서 못 돌고, 못 도니까 커서가 안 밀리고, 안 밀리니 다음 회차도 같은 자리다.
 * ⇒ 활성 키워드 330개 중 **매 회차 같은 소수만** 돌고 나머지는 순번을 못 받는다(수집 폭이 구조적으로 갇힘).
 *
 * ## 오늘 세 번째 같은 병
 * ① 보강 레인: 마지막 track(naver)이 **시계**를 못 받음 · ② 그 전엔 마지막 track 이 **예산**을 못 받음 ·
 * ③ 여기: 뒤쪽 픽이 **순번**을 못 받음. **줄을 세우면 꼬리가 굶는다** — 자원이 무엇이든.
 *
 * ⚠️ 이 함수만으론 부족하다: 순서를 섞으면 커서 픽이 YT 슬롯(희소 자원)을 가져가 성과가중 선택이 희석된다.
 *   그래서 호출부에서 YT 게이트를 **위치 기반(`ytUsed < batch`)에서 멤버십 기반(`ytIds.has`)으로** 함께 바꾼다.
 *   둘 중 하나만 하면 안 된다 — 순서와 쿼터 배분이 한 조건에 얽혀 있던 것이 원인이기 때문이다.
 *
 * ⚠️ 상대 순서는 보존한다 — `prefixDone` 이 각 목록의 **선행 구간**을 세므로 뒤섞으면 커서 계산이 깨진다.
 */
export function interleavePicks<T>(ytPicks: T[], cursorPicks: T[], total: number): T[] {
  const out: T[] = []
  const cap = Number.isFinite(total) ? Math.max(0, total) : 0
  for (let i = 0; i < Math.max(ytPicks.length, cursorPicks.length) && out.length < cap; i++) {
    if (i < ytPicks.length && out.length < cap) out.push(ytPicks[i])
    if (i < cursorPicks.length && out.length < cap) out.push(cursorPicks[i])
  }
  return out
}

/**
 * 🔀 **세 풀(집중·우선·일반)을 라운드로빈으로 병합** — 잘릴 때 공평하게 잘리도록 (2026-08-04).
 *
 * ## 무엇이 고장이었나 (커버리지 붕괴 경보, 라이브 실측)
 * ```
 *   활성 399  ·  never 117  ·  2일+ 206        ← 323개가 이틀째 미실행
 *   회차: planned 16 → processed 5 (spent 56/56, 예산 소진)
 *   24h 실제 실행 54개 = 집중 18 + 나머지 ~36  ← 하루 120슬롯인데 54개뿐
 * ```
 * 옛 코드는 `[...focusPicks, …]` 로 **집중 축을 무조건 앞머리**에 뒀다. 예산이 5개에서 끊기니
 * 집중 4개가 앞자리를 먹고 **일반 풀엔 1개**만 남았다. 게다가 커서 전진은 `prefixDone`
 * (처리된 **앞부분만** 셈)이라 뒤 풀은 잘릴 뿐 아니라 **커서도 안 움직여 다음 회차에 같은 키워드를
 * 또 내놓는다** — 일반 풀(~300개) 한 바퀴에 12일 이상.
 *
 * ## 🗺️ 앞머리의 근거는 이미 낡아 있었다
 * 옛 주석은 *"YT 슬롯(희소)에 확실히 들어가게"* 였는데, 지금 YT 픽은 `pickYtKeywords` 가
 * **전체 키워드에서 따로** 뽑고 호출부는 오히려 그 id 들을 **제외**한다. 앞머리는 YT 에 아무 도움이
 * 안 되면서 일반 풀만 굶기고 있었다(이 레포가 부르는 "낡은 지도").
 *
 * ⚠️ **몫은 안 바꾼다** — 배분은 `planKeywordSplit` 그대로고, 이 함수는 **순서만** 정한다.
 *   집중 풀은 18개뿐이라 회차당 ~2개로도 하루 두 바퀴 이상 돈다(과잉 해소).
 *
 * ## ⚖️ 1:1:1 → **몫 비례** (2026-08-11 — `starved` 경보. 근거·실측은 `docs/handoff/2026-08-11-keyword-merge-proportional.md`)
 *
 * 위 수리는 "앞머리 독식"을 고쳤지만 **잘림의 비대칭**을 남겼다. 한 개씩 번갈아 놓으면 회차가
 * 예산에서 끊길 때 **작은 축은 몫을 다 지키고 큰 축만 깎인다.** 라이브(집중 25·우선 358·일반 76):
 * ```
 *   계획(9)  F p g p g p p p p     예산 5 → F p g p g   ← 우선만 6개 중 4개 상실
 *   키워드 1개당 회전율(우선=1)   설계 1.5 : 1 : 0.5  ·  계획 2.39 : 1 : 1.57
 *     예산 5에서 잘리면  7.2 : 1 : 4.7   ← 24h 실측 7.3 : 1 : 3.2 과 일치
 * ```
 * ⇒ **대표가 정한 축 우선순위(`AXIS_ROTATION_MULTIPLIER`)가 코드에서 조용히 뒤집혀 있었다** —
 * 본업 축(맛집·뷰티·숙소·공동구매)이 전체의 78% 인데 가장 느리게 돌았다.
 *
 * 고치는 법은 균등 배치(Bresenham/smooth WRR): n번째 픽을 `(n+0.5)/몫` 위치에 놓으면 **어디서
 * 잘라도** 앞부분 구성이 몫 비율에 수렴한다. 위 예가 `p p g p F p p g p` 가 되어 우선이 2 → **3**.
 *
 * ⚠️ **몫은 여전히 안 바꾼다** — 순서만.
 *
 * 🔁 **2026-08-12 정정** — 위 문단이 남긴 *"남는 비대칭은 불변식 ④(최소 1슬롯)의 의도된 대가이며,
 *   그 바닥을 없애면 작은 전략 축이 매 회차 0 이 된다"* 는 **더 이상 사실이 아니다.** 그 바닥은
 *   회차 간 이월(carry)로 대체됐다(`planKeywordSplit` docblock §④) — 작은 축은 매 회차가 아니라
 *   `ceil(1/지분)` 회차마다 슬롯을 받고, 장기 평균은 설계 배수에 정확히 수렴한다. 즉 비대칭 자체가
 *   사라졌으므로 이 함수가 그것을 감안할 필요도 없다.
 *   ⚠️ 옛 문구를 믿고 "바닥은 건드리면 안 된다"고 판단하지 말 것 — 폭이 16→9 로 좁아진 뒤 그 바닥의
 *   세금은 12% → **22%** 였고, 실측상 본업 축(우선, 전체의 78% · 이메일 수율 최고)이 가장 느렸다.
 * ⚠️ 풀 내부 **상대 순서는 그대로** — `prefixDone` 이 선행 구간을 세므로 어기면 커서가 깨진다.
 * ⚠️ 비지 않은 축은 여전히 앞 5개 안에 들어온다(2026-08-04 불변식 — 테스트가 고정).
 *
 * ## 🔄 `lead` — **맨 앞자리를 회차마다 돌린다** (2026-08-12. 라이브 실측으로 원인 확정)
 *
 * 위 두 수리로도 안 풀린 게 남아 있었다: **커서는 맨 앞에 놓인 축 하나만 전진한다.**
 * 커서 전진은 `prefixDone`(처리된 **선행** 픽 수)인데 회차가 예산에서 잘리므로(계획 16 → 처리 7),
 * 뒤쪽 축의 픽은 매번 잘려 `prefixDone = 0` → 그 축 커서가 **영원히 제자리** → 다음 회차도 같은
 * 키워드를 내놓고 또 잘린다. 라이브 커서 값이 이걸 그대로 보여줬다:
 * ```
 *   수리 전(집중이 앞)   집중 17 전진   ·  우선 5 정지    ·  일반 52 정지
 *   수리 후(우선이 앞)   우선 5→51 전진 ·  집중 1 정지    ·  일반 53 정지
 * ```
 * **앞자리가 바뀌자 움직이는 커서도 그대로 바뀌었다.** 우선 축이 15일간 정지했던 구간(위치 50~149,
 * 102개)이 앞자리를 받은 뒤 실제로 열렸다(11:00 회차에 위치 50·51·53~56 실행 — 되감김 아님, 통과).
 *
 * ⇒ 어느 축이 앞서든 **나머지는 굶는다.** 그래서 앞자리를 고정하지 않고 회차마다 돌린다.
 *   `lead` 축의 첫 픽만 맨 앞으로 당기고 **나머지 순서는 비례 그대로** — 몫도, 풀 내부 순서도 불변이다.
 *   호출부는 `roundIndex % 3` 을 넘긴다(집중 0 · 우선 1 · 일반 2). 모든 축이 3회차마다 한 번은
 *   앞자리를 받아 커서가 최소 +1 전진한다 ⇒ **어떤 축도 구조적으로 얼어붙을 수 없다.**
 *
 * ⚠️ 이 회전만으론 **충분하지 않다** — 3회차당 +1 은 일반 풀(76) 한 바퀴에 9일이다. 근본 원인은
 *   "계획을 처리 능력보다 크게 잡는 것"이고 그건 `planRoundWidth` 가 맡는다. 둘은 짝이다:
 *   회전은 **얼어붙지 않게** 하는 보험, 폭 맞춤은 **빨리 돌게** 하는 처방.
 * ⚠️ `lead` 를 안 넘기면(기본 −1) 종전과 **byte-동일**하다.
 */
export function mergeKeywordPicks<T>(focus: T[], pri: T[], gen: T[], lead = -1): T[] {
  const pools = [focus, pri, gen]
  const taken = [0, 0, 0]
  const out: T[] = []
  const total = pools[0].length + pools[1].length + pools[2].length
  const EPS = 1e-9
  // 🔄 앞자리 회전 — 지정된 축의 **첫 픽 하나만** 당긴다(그 축 내부 순서는 이미 첫 번째라 불변).
  if (lead >= 0 && lead < pools.length && pools[lead].length > 0) {
    out.push(pools[lead][taken[lead]++])
  }
  for (let n = out.length; n < total; n++) {
    let best = -1
    let bestKey = 0
    for (let i = 0; i < pools.length; i++) {
      if (taken[i] >= pools[i].length) continue
      const key = (taken[i] + 0.5) / pools[i].length   // 몫이 클수록 촘촘히 배치된다
      // 동률이면 **큰 축 먼저** — 같은 자리를 다툴 때 작은 축이 앞서면 잘림이 또 비대칭이 된다.
      if (best < 0 || key < bestKey - EPS
        || (Math.abs(key - bestKey) <= EPS && pools[i].length > pools[best].length)) {
        best = i; bestKey = key
      }
    }
    if (best < 0) break
    out.push(pools[best][taken[best]++])
  }
  return out
}

/**
 * 📏 **이번 회차에 몇 개를 계획할 것인가** — "처리 능력보다 크게 잡지 않는다" (2026-08-12).
 *
 * ## 왜 이게 근본 원인인가
 * 계획 16 · 처리 7 이면 9개는 **매 회차 뽑혔다가 잘린다.** 그 자체는 무해해 보인다(다음 회차가
 * 이어받으니까). 그런데 커서 전진이 `prefixDone`(처리된 **선행** 구간)이라, 잘리는 자리에 있는 축은
 * 커서가 안 밀리고 **다음 회차에 똑같은 키워드를 다시 내놓는다.** 그래서 라이브에서 102개가 15일간
 * 한 번도 순번을 못 받았다. 즉 초과 계획은 "여유"가 아니라 **기아를 만드는 장치**였다.
 *
 * ## 규칙
 * 최근 회차들이 실제로 처리한 수(중앙값)에 **여유 20%** 를 얹어 계획한다. 처리량이 늘면(비용이
 * 싸지면) 계획도 따라 오르고, 줄면 따라 내린다 — 자기 조율이다.
 *
 * ⚠️ **총 처리량은 안 줄어든다** — 어차피 예산이 상한이라 처리 수는 그대로다. 줄어드는 건
 *   "뽑아 놓고 버리는 수"뿐이고, 그 대가로 **모든 축의 커서가 전진**한다.
 * ⚠️ 증거가 없으면(첫 실행·이력 소실) `hardMax` 를 그대로 쓴다 — 모르는 상태에서 좁히면 커버리지가
 *   준다. 좁히는 것은 관측이 있을 때만.
 * ⚠️ 바닥(`minWidth`)이 필요한 이유: 축이 셋이라 3 미만이면 어떤 회차엔 한 축도 못 들어간다.
 */
export function planRoundWidth(
  recentProcessed: readonly number[], hardMax: number, minWidth = 3, headroom = 1.2,
): number {
  const cap = Number.isFinite(hardMax) ? Math.max(0, Math.floor(hardMax)) : 0
  const floor = Math.min(cap, Math.max(1, Math.floor(minWidth)))
  const seen = recentProcessed.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (!seen.length) return cap                       // 증거 없음 → 종전 동작
  const median = seen[Math.floor(seen.length / 2)]
  return Math.max(floor, Math.min(cap, Math.ceil(median * headroom)))
}

/**
 * 📐 **형상별 계획 폭** — YT 동반 회차와 네이버 전용 회차를 **다른 이력으로** 계획한다 (2026-08-12).
 *
 * `planRoundWidth` 는 "최근 처리량의 중앙값"을 쓰는데, 하루 안에 형상이 둘이면 그 중앙값이 둘 다 틀린다:
 * ```
 *   YT 동반 회차     처리 ~9   (키워드당 비용 ~6.2 — 예산 56 을 다 쓴다)
 *   네이버 전용 회차  처리 ~17  (키워드당 비용 ~3.2 — YT 쿼터 소진 후 하루의 상당 시간)
 *   섞은 중앙값 ~12.5 → YT 회차엔 과대 계획(#1142 가 고친 커서 기아 재발) · 네이버 회차엔 과소 계획
 * ```
 * 형상 표식은 `yt.spend > 0` 이다(그 회차가 YT 에 서브리퀘스트를 썼는가 = 이미 기록되는 값).
 *
 * ⚠️ 같은 형상의 이력이 없으면(배포 직후·형상 전환 직후) **전체 이력으로 폴백**한다 —
 *   증거 없이 좁히면 커버리지가 줄고, 증거 없이 넓히면 예산을 넘겨 마감 기록이 깨진다.
 *   폴백은 `planRoundWidth` 의 "증거 없으면 hardMax" 규약과 같은 철학이다.
 */
export function planRoundWidthForShape(
  recent: readonly { processed?: number; yt?: { spend?: number } }[],
  naverOnlyRound: boolean, hardMax: number,
): number {
  const sameShape = recent.filter(f => (Number(f.yt?.spend || 0) > 0) !== naverOnlyRound)
  const src = sameShape.length ? sameShape : recent
  return planRoundWidth(src.map(f => Number(f.processed) || 0), hardMax)
}
