# 2026-08-27 — 홈 "섹션이 안 보인다 / 로딩이 매우 느려" 규명과 수리

## 다음 세션의 첫 액션

배포 후 **라이브에서** 아래 넷을 재라. 이 컨테이너는 CPU 스로틀이라 **절대 ms 를 믿지 말 것** —
비교는 같은 방법으로 잰 기준선(아래 "기준선")과만 하라.

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'

# (a) 캐시 컬럼 드리프트가 실제로 풀렸는가 — 이게 가장 명확한 판정이다
curl -sS "https://urdeal.kr/api/group-buy/products?status=active" -H "User-Agent: $UA" \
 | python3 -c "import sys,json;d=json.load(sys.stdin);ps=d.get('data') or []
print('dominant_color 키 존재:', 'dominant_color' in (ps[0] if ps else {}))
print('값 보유:', sum(1 for p in ps if p.get('dominant_color')), '/', len(ps))"
#   → 키 존재 True 면 ② 수리가 배포됐다. 값 보유는 **cron 이 한 바퀴 돈 뒤에야** 오른다(5분).
#     값이 0 이어도 키가 있으면 정상 — 그 다음 방문자부터 카드가 canvas 를 안 돈다.

# (b) 섹션 패널이 뜨는 시각 (기준선 PC 2,975ms)
#   Playwright: waitUntil:'commit' 후 40ms 폴링으로 document.querySelectorAll('.ur-home-panel').length > 0
```

기준선 (2026-08-27 수리 **전**, 이 컨테이너에서 잰 값 — 절대치가 아니라 **비교용**):

| 항목 | 값 |
|---|---|
| TTFB | 574ms |
| FCP | 1,112ms |
| DOMContentLoaded | 1,315ms |
| **JS 다운로드 완료** | ~1,300ms |
| **앱의 첫 XHR** | **2,488ms** ← 이 사이 1,165ms 가 순수 JS 실행 |
| **섹션 패널 표시** | **2,975ms** (PC 1440) / 3,845ms (모바일 390) |
| JS 총량 | 63파일 562KB |

## 이번에 틀렸던 판단 — **여기가 제일 중요하다**

### 1. "섹션이 안 보인다" 를 **데이터 문제로 오진**했다

PR #1227 을 만들 때 나는 *"SECTIONS 시드에 전역 KV 층이 없고 타임아웃이 1500ms 라 콜드 콜로에서
시드가 빈다"* 고 판단했다. **그 수리 자체는 옳다**(콜드 콜로 보호는 실제로 없었다). 하지만
**대표가 본 증상의 원인은 그게 아니었다.** 라이브를 직접 재 보니:

- `__SSR_INITIAL_SECTIONS__` 는 **5회 연속 curl 에서 전부** 실려 있었고 내용도 정상(2섹션 × 4상품)
- `/api/sections` 도 200 에 데이터 정상
- 그런데 **패널은 2,975ms 에야 떴다**

⇒ 시드가 아무리 빨라도 **React 가 마운트해야 그릴 수 있다.** 마운트가 2.5초면 시드는 의미가 없다.

**교훈**: "화면에 안 보인다"의 원인 후보에 **부팅 JS** 를 항상 넣어라. 데이터 계층만 파면
멀쩡한 데이터를 확인하고 "문제 없음"으로 결론 낸다.

### 2. 스캐너를 짜 놓고 **깨뜨려 보지 않을 뻔했다**

dep 없는 layout-reading effect 를 찾는 스캐너를 짜서 "0건, 깨끗함"을 얻었다. 그런데
**수리 전 코드에 돌려 봤더니 그것도 0건**이었다 — 스캐너가 고장나 있었다.
원인: 레이아웃 읽기가 effect 본문이 아니라 **헬퍼 함수 안**에 있었다(`syncCatArrow`).
한 단계 따라가도록 고치니 수리 전 1건 / 수리 후 0건으로 제대로 갈렸다.

### 3. 커밋 안 한 수정을 `git checkout --` 로 **날렸다**

되돌려-검증을 하면서 각 주입 뒤 `git checkout -- <file>` 로 복원했는데, 그 수정들이 **아직
커밋 전**이라 HEAD 로 되돌아가며 **내 수리가 통째로 사라졌다**. 실패 개수가 1,2,3,4,5,6 으로
단조 증가하는 게 그 신호였다. **되돌려-검증은 반드시 커밋 뒤에 하라.**

### 4. 청크 분석에서 **정적 import 추적기를 믿을 뻔했다** (이전 세션 기록 유지)

`app-components` 의 "미사용" 35개 목록이 `ui/button`·`ui/card` 를 포함했다 — `export … from`
재수출을 놓친 오탐이었다. 청크 결정은 **번들러의 실제 그래프**(sourcemap + manifest)로만.

### 5. `--only` 가 **0건을 돌고 초록**을 찍었다

`check-guard-mutations --only "a|b|c"` 로 불렀는데 이 필터는 **정규식이 아니라 부분일치**다.
0건이 매칭됐는데도 "521개 주입 전부 빨간불 확인" 이 떴다. 이 레포가 반복해 당한
"검사가 실패할 수 없음"을 **하필 그 검사기 자신이** 하고 있었다 → 0건 매칭이면 exit 1 로 고쳤다.

## 완료분

| 무엇 | 커밋 |
|---|---|
| 홈 부팅 JS 3건 + 가드 6건 | `6c7a564` |
| 주입 매니페스트 3건 + `--only` 0건 실패 | 이 커밋 |
| (선행) 히어로 출처 규칙 · 카드 preload · SECTIONS 시드 3층 | PR #1227 |

### 수리 3건

1. **`DesktopTopNav`** — 의존성 배열 **없는** `useEffect` 가 렌더마다 `scrollWidth`/`clientWidth`/
   `scrollLeft` 를 읽어 **강제 동기 레이아웃**을 돌고 resize 리스너를 해제+재등록했다.
   부팅 중엔 i18n·인증·쿼리가 차례로 도착하며 렌더가 수십 번 난다. CPU 프로파일 **self 1,108ms**
   — 홈에서 가장 비싼 JS 였다.
   → `useCallback` 고정 + 리스너 1회 + `ResizeObserver`(폭이 실제 변할 때만 재측정).
   ⚠️ dep 없는 effect 의 **원래 목적**은 "i18n 라벨이 늦게 도착해 칩이 넓어지는 것"을 잡는 것이었다.
     그래서 그냥 `[]` 로 바꾸면 기능이 죽는다 — `ResizeObserver` 가 그 자리를 정확히 대신한다.

2. **`group-buy-feed-cache`** — `dominant_color` 가 2026-05-28 에 라이브 `buildCols` 에만 들어가고
   materialized COLS 에는 **3개월간 없었다**. 홈 기본 피드는 이 캐시가 서빙하므로
   **그 값이 소비자에게 한 번도 간 적이 없다**(라이브 실측: 응답 50건 전부 키 자체 부재).
   이 짝은 **이미 두 번 갈렸다**(`images` 는 08-19 에 수습). → 캐시에도 추가 + graceful 재시도.

3. **`GroupBuyFeedCard`** — ② 탓에 카드가 매번 canvas 로 대표색을 다시 뽑았다. `getImageData` 는
   GPU→CPU 리드백인데 그게 사진 `onLoad` 안, 즉 **첫 화면 그리는 한복판에서 동기로** 돌았다
   (self 166ms). → 이미 색이 있으면 건너뛰고, 뽑을 때도 `requestIdleCallback` 으로 미룬다.
   **기능은 불변** — 색은 여전히 뽑히고 서버에도 보고된다.

## 남은 것 (착수 안 함)

### B. `app-components` 166KB / 58모듈

더 쪼개려면 **번들러의 실제 module→chunk 그래프**(sourcemap + manifest)가 필요하다.
정적 import 추적기로 하지 말 것(위 교훈 4).

### C. `beacon.min.js`(Cloudflare Web Analytics)가 604ms 에 시작해 **696ms** 를 쓴다

우리 코드가 아니라 CF 가 주입한다. 끄고 싶으면 **대시보드**에서 대표가 직접(세션은 플랫폼 쓰기 금지).

### D. `locale-ko` 86KB 가 1,193ms 에 크리티컬 패스로 들어온다

첫 화면에 실제로 쓰는 키만 남기는 것을 검토할 만하다(현재 `i18n-critical.ts` 가 일부만 커버).

## ✅ 처리됨 — 맨 위 카드 prefetch idle 미루기 (대표 승인 "한가할 때로 미루기")

실측(PC 1440): `/api/banners` ×3 · `/api/group-buy/products/{id}` **×6**(맨 위 카드 prefetch)
· `/api/sections` · `/api/fcfs/active` · `/api/promo-bar` — 전부 2,488~2,491ms 에 몰렸다.
prefetch 6개가 **화면에 필요한 4개와 대역을 다퉜다.** → `requestIdleCallback` 으로 미룸.

⚠️ **제거가 아니다.** 잠금표가 지키는 성질은 "카드 클릭 시 fetch 워터폴이 안 난다" 이고,
사용자가 카드를 읽고 누르기까지 최소 1~2초라 미뤄도 그건 유지된다. 화면 밖 카드의
IntersectionObserver(`rootMargin:'100px'`)는 손대지 않았다.

🧪 이 가드를 처음 짰을 때 **prefetch 를 통째로 비워도 초록**이 떴다 — 1,400자 슬라이스 안에
아래 observer 가지의 같은 호출이 들어와서다. `const run = () => {...}` 정의로 앵커해 교정했고,
되돌려-검증 4방향(즉시발사 회귀 / prefetch 제거 / chunk prefetch 만 제거 / rootMargin 200px)
전부 빨강을 확인했다.

## 대표 판단 대기

- **히어로 배너**: `/admin/banners` 에 사진을 올리면 데모 폴백보다 **항상 우선**한다.
  지금은 `?type=hero` 가 0건이라 데모 사진 폴백이 뜬다.
- 위 **A**(카드 prefetch 6개를 idle 로 미룰지) — 잠금 항목이라 손대기 전에 확인 권장.
