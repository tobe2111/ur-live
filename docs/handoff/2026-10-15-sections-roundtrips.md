# 2026-10-15 — 홈 "이런 이용권은 어떠세요?" 늦게 뜸 · 첫 접속 느림 — `/api/sections` 직렬 왕복

대표: *"여전히 그리고 첫 접속 시 2~3배 다른 사이트에 비해 느려. 이런 이용권은 어떠세요? 도 너무 늦게 떠"*

## 원인 (실측)
- **D1 = 미국 동부(ENAM), 읽기 복제 꺼짐** — CF API `GET /d1/database/{uuid}` 의 `running_in_region: ENAM`,
  `read_replication.mode: disabled`. 한국 콜로 워커가 캐시를 못 맞으면 질의마다 태평양 왕복(~170ms 추정).
- 홈 HTML 은 `/api/sections` 를 SSR 시드로 **기다린다**(`worker/index.ts` SECTIONS 보조 슬롯, 타임아웃 2000ms).
  위치 쿠키(`ur_loc`)가 있으면 격자별 키라 KV 예열이 없고, 엣지 TTL 120s 라 한국 콜로는 거의 늘 콜드다.
- 그 핸들러가 캐시가 비면 질의를 **한 줄로** 기다렸다 — 50ms/질의 SQLite 위에서 진짜 라우트를 재니
  **새 isolate 17왕복 · 같은 isolate 6왕복**. 170ms 면 2.9초 → 타임아웃 → 시드 빠짐 → 서버 첫 화면이
  섹션을 못 그리고 JS 부팅 뒤(느린 4G 실측 /api/sections 출발 ~4.3s)에야 뜬다. 타임아웃을 안 넘겨도 그만큼 TTFB.
- 미국(IAD) 콜로에서 재면 안 보인다(D1 과 같은 대륙) — 이 환경 실측 IAD 는 정상이었다.

## 수정 (잠금 파일 무접촉)
`sections.routes.ts` · `section-rules.ts` · `section-seed.ts`:
1. `ensureTables`(DDL 6) — 섹션 SELECT 가 **실패할 때만**.
2. 시드 버전 확인 isolate 당 1회(`_seedConfirmed`).
3. 배너·인기 가중치를 처음부터 병렬.
4. 규칙 섹션을 **동시에** 묻는다 — `overfetch`(위 줄들 limit 합)만큼 더 받아 `takeUnclaimed` 로 직렬과
   같은 결과. 정렬 결정성을 위해 `ORDER BY … , p.id DESC` 동률 깨기 추가(동률의 순서가 고정됨 — 유일한 관찰 가능 변화).
- 결과: **17 → 4 왕복(콜드), 6 → 2(웜)**. 가드 `sections-roundtrips-2026-10-15.test.ts` 8건 + 주입 5건(전부 빨간불 확인).

## 다음 세션 첫 액션
1. 배포 후 E4: 한국에서(대표 폰) 위치 잡힌 상태로 홈 하드로드 → "이런 이용권은 어떠세요?" 가 첫 프레임에 있는지.
   이 환경은 IAD 라 못 잰다. 대리 지표: 내일 09:25 KST SLO 회차의 `/` LCP·TTFB p75.
2. 🔴 **근본은 D1 위치다** — 읽기 복제(Sessions API)를 켜면 한국 근처 복제본에서 읽는다. 켜는 것은 플랫폼 쓰기(대표),
   효과를 보려면 코드가 `env.DB.withSession()` 을 써야 한다(안 쓰면 켜도 primary 로 간다). 결재함 후보.
3. `listActiveBanners` 도 isolate 당 ALTER 2회(`ensureBannerColumns`) — 지금은 병렬이라 경로에 안 걸리지만 같은 클래스.

## 틀렸던 판단
- 처음에 "위치 쿠키와 localStorage 가 어긋나 섹션이 교체된다"를 의심했는데 **내 하네스가 쿠키만 심고
  localStorage 를 안 심어서** 생긴 인공물이었다. 둘 다 심으니 교체 없음.
