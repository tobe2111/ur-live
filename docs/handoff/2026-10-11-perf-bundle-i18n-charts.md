# 성능 묶음 — 로딩 2건 · Sentry 슬림 · 번역 분리 · 예열 정합 · SVG 차트 · 대시보드→마이 (2026-10-11)

서비스: 🎟️ 유어딜(소비자 성능) + 셀러/어드민 대시보드 · 머니 경로 없음
대표: *"전체적으로 페이지들 로딩 속도 개선 및 최적화할 것 있나?"* → *"둘 다 진행"* → *"Shrink large lazy chunks … 여기에서 진행"* → *"다 해줘"* → *"셀러 대시보드를 없애는 것을 목표로"*

## 다음 세션의 첫 액션
1. 이 묶음의 draft PR(지정 브랜치 `claude/influencer-proposal-03yqmh`) CI 상태 확인 — #1698(에이전시 2단계, 머지 `a53e4f7b9`) 위에 새로 올렸다.
2. 배포 뒤 E4: 콜드 상세 `Server-Timing` 에 `kv;` 없음 · `curl -sI https://urdeal.kr/map` → `X-SSR-Status: MAP:*` ·
   손님 화면이 `locale-ko-*` 만 받고 `locale-ko-dash-*` 는 안 받는지(브라우저 네트워크) · 어드민 매출 분석 차트가 그려지는지.
3. 셀러 대시보드 제거 로드맵 `docs/design/seller-dashboard-removal-2026-10-11.md` 2단계(에이전시 콘솔에서 매장 판매 화면을 시트로)부터 — 1단계 분류는 끝났고 "18개 미커버" 는 탭 형제를 빠뜨린 오집계였다(9개는 이미 마이 색인에 있다).

## 완료분 (실측)
| 항목 | 효과 |
|---|---|
| SSR KV 읽기를 워밍 키로 한정 | 콜드 상세·유어샵 ~100 ms 헛대기 제거 |
| 지도 `/map` 첫 화면 시드 + 청크 병렬화 | 하드로드 한 왕복 제거 |
| Sentry 쓰는 함수 6개만 | sentry 청크 431 → 129 KB |
| 번역 손님용/대시보드용 분리 | 손님 언어 파일 ko 300 → 105 KB(gzip 92 → 33) |
| 예열 주소 = 화면 주소 | 칩 4종·홈 피드 기본 요청이 실제로 데워진다 |
| 차트 SVG(recharts 제거) | charts 청크 388 → 7.7 KB |
| 카카오 사장님 `/seller` → 마이 | 에이전시 좌석·마이 없는 계정·시트 안은 그대로 |
| 번들 예산 | raw 7.68 → **7.01 MB** · gzip 2.46 → **2.26 MB**(처음으로 두 번 하향) |

## 이번에 틀렸던 판단 / 발견
- **#1698 이 누수 수정 전엔 홈을 크래시시켰다**(`app-seller-components` 의 로드 순서 TDZ — `Cannot access 'R' before initialization`).
  CI 의 surface-role-leak 가 잡았고 #1698 에 `shared/agency-seat-token.ts` 로 고쳤다. 교훈: 소비자 화면이 셀러 청크를 끌고 오면
  용량만이 아니라 **순환 청크 초기화 순서**로 화면이 죽을 수 있다.
- 처음 하네스에서 모든 화면이 "68자"로 떠서 키 노출이 0 이라고 믿을 뻔했다 — 실은 에러 화면이었다. 측정값 0 은 측정 실패를 먼저 의심.
- 번들 예산 스크립트가 언어 청크를 "가장 큰 하나"만 세면 분리 뒤 대시보드 사용자(둘 다 받음)를 과소 측정한다 → 쪽마다 하나씩 세게 고침.
- 차트 축 글자: 가운데 정렬은 끝이 잘리고, 끝만 붙이면 이웃과 겹쳤다 — 글자 폭 기준 간격이 답이었다(두 번 고침).

## 남은 결정
- 없음(대시보드 제거는 대표 지시로 진행 중).

## ✅ 머지·배포 · E4 (2026-10-12)
- PR #1713 머지 `20cf8a3a2` · Deploy to Cloudflare Pages / worker / ads / wholesale 전부 success.
- 라이브 실측(iPhone UA):
  - `/map` → `X-SSR-Status: MAP:kv-hit` · `__SSR_INITIAL_MAP__` 실재 — 지도 시드 동작.
  - `/pass/2919` → `DETAIL:self-fetch-hit`, `Server-Timing: edge;dur=8, self;dur=366` — **`kv;` 항목 없음** = 상세는 KV 를 안 기다린다(의도).
  - `/map` 의 `kv;dur=112` 는 정상 — 지도 시드 키는 cron 이 쓰는 목록(`SSR_KV_PATHS`)에 있다.
- ⚠️ **못 잰 것**: "손님 화면이 `locale-ko-dash` 를 내려받지 않는다". 홈 청크에 `locale-ko-dash-*.js` 이름은 들어 있지만
  이는 동적 import 표라 정상이고, 실제 요청 여부는 브라우저로 봐야 한다 — 이 환경의 헤드리스가 프록시에서
  `ERR_TOO_MANY_RETRIES` 로 막혀 판정 못 했다. 다음 세션: 일반 브라우저 개발자도구 Network 에서 `/` 진입 시 `locale-ko-dash` 0건 확인.
