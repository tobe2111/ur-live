# 2026-08-08 — 배포 게이트가 막혀 있었다: high 3건 해소 (의존성)

## ⚠️ 먼저 — **다른 세션이 같은 것을 동시에 고쳤다** (#1093)

작업 도중 main 이 움직였고, 거기에 **같은 차단 3건을 고친 커밋**이 들어와 있었다
(`2e0a59a94` — `js-yaml@4`·`nanoid@3` override). 접근은 달랐다:

| | #1093 (다른 세션) | 이 PR |
|---|---|---|
| 방식 | 차단 3건만 **정확히 override** | 그 체인을 끌고 오는 **직접 의존을 상향** |
| 범위 | js-yaml · nanoid | axios · dompurify · vite · esbuild(+vite 중첩 override) |

**둘 다 남겼다.** override 는 해석을 *명시적으로 못박아* 다음 설치에서도 안 흔들리고, 상향은
허용목록의 `review` 지시(axios)와 실제 취약 범위(esbuild 0.27.4)를 근본 해결한다 — 상호배타가 아니다.
충돌은 `overrides` 블록 **양쪽이 각자 append** 한 전형이라 **양쪽 보존**으로 풀었다
(CLAUDE.md 의 머지 충돌 룰과 같다 — 한쪽을 버리면 다른 세션 작업이 사라진다).

> 🧭 **교훈**: 세션이 여러 개 동시에 도는 한, *레포 전체를 막는 환경 문제*는 **동시에 고쳐질 확률이 높다.**
> 착수 전에 `git fetch origin main && git log --oneline -5` 로 남이 이미 손댔는지 볼 것 —
> 이번엔 착수 시점의 main 에 없었고 진행 중에 들어왔다(피할 수 없는 종류였다). 그래도 **푸시 직전 한 번 더**
> 보는 습관이 낭비를 줄인다.

## 무엇이 막혀 있었나

`verify.yml` 의 **`npm audit (high/critical gate)`**(`scripts/check-npm-audit.sh`)가 **모든 PR 에서 빨강**이었다.
`.audit-allowlist.json` 은 이미 적용되고 있었고, 그걸 통과하고 남은 **차단 3건**이 실측으로 이랬다:

```
[high] js-yaml (GHSA-5p4m-2wfm-xmqj) — !!omap 이차 CPU (CVE-2026-59870 미백포트)
[high] nanoid  (GHSA-28wg-ghj8-5hjv) — 음수 size 무한루프
[high] nanoid  (GHSA-2v37-7h3g-55p8) — size 0 무한루프
```

⚠️ **내가 처음에 짐작한 것과 달랐다.** 착수 전엔 axios/esbuild 가 원인일 거라 봤는데, 실제 차단은
**js-yaml·nanoid**(둘 다 빌드 툴체인 transitive)였다. 판정은 짐작이 아니라 게이트 스크립트를 직접
돌려서 나왔다 — 아래 "판정 명령" 참조.

## 무엇을 했나 (`package.json` 만, `src/` 무접촉)

| 항목 | 전 | 후 | 이유 |
|---|---|---|---|
| axios | 1.17.0 | **1.19.0** | 기허용 `GHSA-gcfj-64vw-6mp9` 의 `review` 가 *"설치 가능 환경에서 상향 후 제거"* 를 지시 |
| dompurify | 3.4.2 | **3.4.13** | 안전 패치 상향 |
| vite | ^5.4.3 | **^5.4.21** | 5.4 계열 최신 패치. **major 안 올림**(5→8 은 청크 분할·로딩 잠금 영역 전면 리스크) |
| esbuild (직접 devDep) | 0.27.4 | **0.28.1** | 0.27.4 가 권고 범위 `0.27.3 - 0.28.0` **안**이다. 0.28.1 이 수정본 |
| overrides | — | **`"vite": { "esbuild": "^0.25.12" }`** | vite 5.4 는 `esbuild ^0.21.3`(≤0.24.2 = 취약)을 끌고 온다 |
| overrides | — | `js-yaml@4` · `nanoid@3` | **#1093 에서 온 것 — 지우지 말 것**(위 절) |

결과 해석본: `nanoid 3.3.18` · `js-yaml 4.3.1` · `postcss 8.5.26` · 워커 번들러 `esbuild 0.28.1` ·
vite/vitest/tsx/drizzle-kit 쪽 esbuild `0.25.12`.

### 🪤 함정 — `EOVERRIDE` (다음 세션이 반드시 밟는다)

처음엔 **최상위** override 로 `"esbuild": "^0.25.12"` 를 넣었고 설치가 이렇게 죽었다:

```
npm error code EOVERRIDE
npm error Override for esbuild@0.27.4 conflicts with direct dependency
```

**npm 은 직접 의존성과 모순되는 override 를 거부한다.** 그리고 이 레포는 esbuild 를 *직접* 쓴다
(`scripts/build-worker.js` 가 `_worker.js` 를 굽는다) — 그래서 esbuild 는 transitive 가 아니라 devDep 이다.

⇒ 해법은 **둘을 분리**하는 것: 직접 의존은 최신 수정본(0.28.1)으로 올리고, 취약본을 끌고 오는
**vite 밑에만 중첩 override**(`"vite": { "esbuild": ... }`)를 건다. 이러면 충돌이 없고,
**vite 가 기대하는 API(0.21)에서 덜 멀어진다**(0.25 ≪ 0.28). 우리 워커 번들러만 최신으로 간다.

> ❌ **`npm audit fix --force` 를 쓰지 말 것** — `vite@8.2.1` 로 끌고 간다. 이 레포의 청크 분할
> (`manualChunks`)·로더 연속성·route-chunk-map 은 전부 잠금 영역이라 major 는 별건이다.

## 판정 명령 (되돌려-검증 포함)

```bash
bash scripts/check-npm-audit.sh                    # 후:  ✅ 차단 대상 없음
git stash push -- package.json package-lock.json
bash scripts/check-npm-audit.sh                    # 전:  ❌ 3건 (위 목록)  ← 실제로 빨강을 확인했다
git stash pop
```

## 검증한 것 / 못 한 것

**했다** — `npm ci` 재현 OK · `tsc --noEmit --skipLibCheck` 0 · **vitest 397파일 5,232건 전부 통과** ·
`npm run build`(client+prerender+worker+prepare) 0 · **`audit-gate.sh` ALL GREEN 88**
(여기에 **"크리티컬 청크 구성 동결"·로더 연속성·청크 자가복구**가 포함된다 — vite 상향의 핵심 리스크가
이 셋이라 초록을 확인하고서야 커밋했다).

**못 했다** — 라이브 배포 후 실측. 빌드 산출물이 같은 형태라는 것과 **엣지에서 실제로 뜨는 것**은 다른
문장이다. 머지 후 하드로드 1회(`/` · `/group-buy/{id}`)로 로더가 한 번만 뜨는지 볼 것.

⚠️ `src/worker/generated/route-chunk-map.ts` 는 빌드가 재생성한다(해시만 바뀜). **커밋 대상이 아니다** —
검증 후 `git checkout --` 로 되돌렸다.

## 남은 것 (차단 아님, moderate)

- `@esbuild-kit/core-utils → esbuild 0.18.20`(drizzle-kit 경유) — dev 전용, moderate 라 게이트 무관.
  drizzle-kit 이 `tsx` 로 갈아타면 자연 해소된다.
- `vite <=6.4.2` high 중 `GHSA-fx2h-pf6j-xcff` 는 **이미 허용목록**(dev 서버 전용, 2026-06-22 대표 승인).
  나머지는 게이트에 안 걸린다.
- **허용목록을 손대지 않았다.** `axios` 항목(`GHSA-gcfj-64vw-6mp9`)은 이제 상향으로 근본 해결됐지만,
  등재 해제는 `accepted_by: 대표 승인` 이 붙은 줄을 지우는 일이라 **세션이 대신 결정하지 않는다.**
  다음에 대표가 볼 때 제거 여부를 물을 것.

## 다음 세션 첫 액션

1. 이 PR 머지 → **#1094**(키워드 굶주림 24h 판정 인계)가 같은 게이트에 막혀 있었으니 재시도.
2. YouTube 일일 쿼터 초과(4,601/4,000, 8/7 실측)는 **아직 미결**이다. 하루치 소비 패턴을 먼저 보고
   YT 몫 20→16~17 인하 / search 예산 축소 / 방치 중에서 고를 것 — 지금 고르면 근거 없이 고르는 것이다.
