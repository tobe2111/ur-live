# 2026-10-26 생활 업체 등록(/life/pro) 로딩

대표: *"https://urdeal.kr/life/pro 이 페이지 로딩이 상대적으로 많이 길어"* (생활 = 이사·청소·간판·인테리어)

## 다음 세션의 첫 액션
배포 후 라이브 판정(E4):
```bash
# 아이폰 UA 로 /life/pro 하드로드 → lz-gbDetail-*.js 요청이 0 인지, LifeProPage 가 modulepreload 에 있는지
curl -sS -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' https://urdeal.kr/life/pro | grep -o 'LifeProPage-[^"]*\.js' | head -1
```
브라우저로 로딩 화면(유달이) 지속 시간이 종전 2.7~4.2초에서 줄었는지 확인(느린 4G·CPU 4배 기준).

## 원인 · 처방
1. 생활 페이지가 하드로드 미리받기·부팅 준비 표면에 없었다 → `route-surface` 에 `life`·`lifePro`, `PRELOAD_ONLY_ROUTES` 등재, App.tsx `lazyPage` + `registerBootPage`.
2. `ProCredits` 가 `lib/toss-key-type` 을 정적 import → 이용권 상세 묶음(66KB raw) 끌림 → 충전 버튼 누를 때 `await import`.

## 이번에 틀렸던 판단
- `check-surface-budgets --rebaseline` 은 **모든 화면을 로컬 측정값으로 다시 쓴다**(+0.3KB 드리프트). 새 표면만 손으로 넣었다.
- 처음엔 "앱으로 바꿀까"를 물어보셨는데, 원인은 웹/앱이 아니라 코드 묶음 배치였다(앱으로 바꿔도 같은 코드를 받는다).

## 남은 것
- 같은 정적 import 가 `PointsChargePage`(충전 종료)·`SellerAlimtalkPage`(셀러 대시보드)에도 있다 — 범위 밖.
- 로그인한 사장님은 `/api/home-service/pro/me` 응답을 기다리는 로딩이 한 번 더 있다(데이터 대기, 별건).
