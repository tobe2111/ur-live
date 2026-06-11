# SSR 전면 전환 (옵션 ② — 프레임워크 이전) 마이그레이션 프로그램

> 2026-06-10 사용자 결정: "2번 하자" — 페이지별 패치가 아니라 구조 전환.
> 목표: **모든 사용자 대면 페이지가 전통 쇼핑몰처럼 "접속 즉시 콘텐츠가 보이는" 진짜 서버렌더링(SSR+hydration)**.
> 효과 범위: 홈/교환권/공동구매(동네딜)/링크샵/도매몰/상세 — 전부 한 구조로 해결. 페이지별 SSR 슬롯/placeholder 트릭 졸업.

## 0. 스택 결정 (권고)

**React Router v7 (framework mode, 구 Remix) on Cloudflare Workers** — Next.js 가 아니라 이것인 이유:
1. 현재 코드가 이미 `react-router-dom` v6 — 라우트/컴포넌트 이전 비용 최소 (Next 는 라우팅 모델 전체 재작성).
2. Cloudflare Workers **네이티브 지원** (Next 는 next-on-pages 어댑터 — 제약/사고 표면 큼).
3. 기존 Hono API(`/api/*`) 그대로 둠 — SSR 앱은 "또 하나의 소비자". **Toss/카카오/정산 잠금 파일 무수정.**
4. loader 패턴 = 우리가 이미 만든 "데이터를 화면 전에" 사상의 프레임워크화.

## 1. 지금까지의 최적화는 버려지는가? — 아니다

| 자산 | SSR 전환 후 |
|---|---|
| API 병렬화/엣지캐시/prewarm/D1 인덱스/자가치유 | **100% 그대로 사용** — SSR 서버가 같은 API 를 호출. SSR 에선 API 속도가 오히려 더 중요해짐 |
| 이미지 cfImage/dominant_color | 그대로 |
| 컴포넌트/페이지 UI 코드 | 대부분 이식 (window/localStorage 직접 접근부만 SSR-safe 수정) |
| SPA 전용 글루 (SSR 슬롯 inject / placeholder / idle 워밍) | 자연 졸업 (소량) |

## 2. 단계 (빅뱅 금지 — 기존 사이트 무중단 병행)

### Phase 1 — 파일럿: 공개 리스트 5페이지 (1~2세션)
- 리포 내 `apps/ssr/` 신설 (React Router v7 + CF Workers). 기존 빌드와 완전 분리.
- 이전 대상: `/`(홈) `/vouchers` `/group-buy` `/wholesale` `/u/:handle`(링크샵) — 비로그인 공개 뷰.
- 데이터: 기존 `/api/*` 호출 (worker-to-worker, 같은 엣지 — 빠름).
- 배포: **스테이징 서브도메인** (예: `beta.ur-team.com`) — 본 사이트 무영향. 화면/속도 비교 검증.
- ✅ Phase 1 게이트: 사용자 폰에서 "접속 즉시 보임" 확인 + Lighthouse LCP < 1.5s.

### Phase 2 — 상세/탐색 + 인증 쿠키 통일 (2~4세션)
- 상세 3종(/products /group-buy/:id /wholesale/product), 검색, 장바구니(읽기).
- **⚠️ 핵심 전제 작업**: 셀러/유저 인증 localStorage JWT → **httpOnly 쿠키 병행 발급**.
  서버는 localStorage 를 못 보므로, 이것 없이는 SSR 이 로그인 개인화(도매 등급가/내 잔액)를 못 그림.
  카카오는 이미 세션 쿠키라 OK. 기존 SPA 호환 위해 "쿠키+localStorage 동시 발급" (제거는 컷오버 후).
- 결제 페이지는 마지막(Toss 위젯은 클라 전용 — SSR 필요 없음, 라우트만 이전).

### Phase 3 — 컷오버 (1~2세션)
- 경로별 점진: 기존 worker 가 경로 단위로 SSR 앱 ↔ 기존 SPA 분기 → 페이지씩 전환, 문제 시 즉시 롤백.
- 어드민/셀러/에이전시 대시보드는 **SPA 유지** (로그인 도구 — SSR 무의미, 이전 비용 절약).
- 전 페이지 전환 후: index.html SSR 슬롯/placeholder 글루 제거.

## 3. 불변 조건 (잠금)
- `/api/*` 전체 무수정 원칙 (Toss gateway/confirm, 카카오 OAuth, 정산 — CLAUDE.md 잠금 그대로).
- 컷오버 전까지 live.ur-team.com 은 기존 SPA 그대로 서비스.
- 각 Phase 끝 = 배포 가능 상태 + 사용자 화면 확인 게이트.

## 4. 사용자 액션 (Phase 1 시작 전)
- [ ] Cloudflare 에 스테이징 워커/서브도메인 1개 허용 (예: beta.ur-team.com) — Phase 1 배포처.

## 5. 리스크 정직 고지
- 총 4~8 세션 규모. 그 기간 기능 개발 속도 저하 (병행은 가능하나 분산).
- Phase 2 인증 쿠키 작업이 가장 민감 (이중 로그인/카카오 플로우 재검증 필수).
- 미검증 가정: React Router v7 + 우리 컴포넌트의 SSR-safe 정도 — Phase 1 파일럿이 바로 이걸 검증.
