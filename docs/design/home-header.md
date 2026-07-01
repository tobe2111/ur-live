# 홈 상단 헤더 (검색 + 위치) — 2026-07-01 대표 시안

## 시안 구조
메인 홈(`/`) 상단에 2행 헤더:

**1행**: `[원형 로고]` · `[검색 입력 바 "우선입장을 검색해 보세요!"]` · `[시계/기록 아이콘 ●]` · `[알림 벨 ●]`
**2행**: `[📍 영등포/여의도/강서 ⌄]` (좌) ······ `[⊕ 현재 위치로]` (우)

- 검색 바 = 입력형 pill(탭 → `/search`), placeholder "우선입장을 검색해 보세요!" (우선입장=추첨 응모).
- 우측 아이콘 2개: 기록(최근) + 알림(미읽음 빨강 점).
- 위치: 지역 라벨(저장된 '내 동네') + 현재 위치(GPS) → `/api/region/resolve` → `/group-buy?gucode=…`.

## 현재 → 시안 차이
| | 현재 | 시안 |
|---|---|---|
| 검색 | 아이콘 버튼만 | **입력형 검색 바**(placeholder) |
| 위치 | 없음 | **지역 선택 + 현재위치 행** |
| 로고 | UrDealLogo(가로) | 원형 마크 |

## 구현 todo
- [x] `HomeTopHeader` 컴포넌트(2행, 테마 대응, sticky)
- [x] 검색 pill → `/search`, 벨 → `/notifications`(미읽음 점), 기록 → `/browse`
- [x] 위치: localStorage `ur_home_region` + GPS(`/api/region/resolve`) → `/group-buy`
- [x] MainHomePage 기존 sticky 헤더를 교체(가시성 `md:hidden lg:block` 유지)

## ✅ 구현 완료
- commit: (아래 커밋에서 기록)
