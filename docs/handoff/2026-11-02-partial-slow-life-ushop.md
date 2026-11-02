# 2026-11-02 부분 로딩 느림 — 생활 표 확인 · 유어샵 주인 물결

대표: *"로딩이 긴 것들이 페이지에서 부분적으로 있어. 유어샵 … 마이페이지 … 홈 맨 위 … 생활 카테고리 … 유어쇼츠도 느리더라"*
→ *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"*

## 실측(미국 동부 서버에서 — 한국 체감은 이보다 길다. DB 원본은 ENAM)
| 화면 | 느린 것 | 값 |
|---|---|---|
| 생활 `/life`, `/life/request/*` | `/api/home-service/config` | 서버 시간 1,424ms · 같은 서버 재요청 42ms |
| 유어샵(남이 봄) | `/api/curator/:handle` | 0.13s (엣지 캐시) — 문제 없음 |
| 유어샵(주인이 봄) | 같은 요청, `no-store` + 원본 DB | 코드상 직렬 7물결(로그인 실측 못 함) |
| 홈 맨 위 | 지역 사진 `region-hero/*.webp` | 카드 사진 0.5~0.6s vs 사진 1.26s + 페이드 0.5s (의도된 `lazy`·`fetchPriority=low`) |
| 유어쇼츠 | 우리 API 0.1s | 느린 건 유튜브 재생기(이 환경은 유튜브 차단 — 못 잼) |
| 마이 | 로그인 필요 — 못 잼 | 개인 데이터라 캐시 불가 · 원본 DB |

## 이번에 고친 것
1. **생활 — `ensureHomeServiceTables`**: 서버가 새로 켜질 때마다 DDL 34문장을 하나씩(ALTER 13개는 매번 실패) 보냈다.
   → 표·칸·색인 "다 있나" 를 **batch 1회**로 묻고 다 있으면 건너뜀(`buildSchemaProbe` — `HS_TABLES_SQL` 에서 자동 생성).
   라이브 D1 에 확인 질문 다섯을 읽기로 돌려 전부 통과 확인(표+색인 20/20). 빠지면 종전대로 DDL 전부.
   생활의 **모든** 요청(35곳)이 이 함수를 거치므로 전부 같이 빨라진다.
2. **생활 `/config`** — 엣지 캐시 30초(엣지 90) + 두 읽기 나란히. 운영 중지 스위치는 최대 90초 뒤 반영.
3. **유어샵 주인 보기** — 직렬 7물결 → 3(사용자 → 여섯 읽기 한 물결 → 셀러 페이로드·상품 나란히). 응답 모양 무변경.

가드: `home-service-schema-probe-2026-11-02.test.ts`(진짜 SQLite · 주입 2) · `ushop-owner-waves-2026-11-02.test.ts`(주입 1).
`linkshop-products-seed.test.ts` 한 줄 재조준(동봉은 그대로, 나란히 받도록 바뀐 모양).

## 이어받는 세션의 첫 액션(대표가 이어서 하라고 했을 때)
배포 후:
```bash
UA='Mozilla/5.0 (iPhone)'; for i in 1 2 3; do curl -sS -o /dev/null -A "$UA" -D - https://urdeal.kr/api/home-service/config | grep -i -E 'server-timing|x-cache-status'; done
```
→ 두 번째부터 `x-cache-status: public-HIT`, 첫 번째도 서버 시간이 수백 ms 이하면 E4.

## 이번에 틀렸던 판단
- 처음엔 생활의 원인을 "업체 수 집계 질의" 로 의심했다. `/pros/abc`(질의 없이 표 확인만 하고 404)도 0.45~0.6초가 걸려 표 확인이 원인이었다.
- `npx tsc` 는 기본 힙에서 죽는다(`Aborted`) — `NODE_OPTIONS=--max-old-space-size=8192`.

## 남은 것(대표 판단·별건)
- 마이페이지 칸들: `/api/seller/my-stores/summary` 앞단 `resolveStoreScope` 직렬 + 클라에서 `seller/orders` 가 이 응답을 기다리는 2단. **로그인 실측 후** 손댈 것.
- 홈 맨 위 사진: 우선순위를 올리면 위는 빨라지고 첫 카드 사진이 늦어진다 — 대표 선택.
- 유어쇼츠: 유튜브 재생기 미리 데우기(예: 카드에 손가락이 닿을 때 `preconnect`) — 별건.
