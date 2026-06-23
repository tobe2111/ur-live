// ============================================================
// Cloudflare Worker — Environment Bindings (Unified)
// All bindings used across worker + feature modules
// ============================================================

import type { D1Database, KVNamespace, DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  // ---- D1 Database ----
  DB: D1Database;

  // ---- KV Namespaces ----
  RATE_LIMIT_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;
  /**
   * 🛡️ 2026-05-23 (Task 2): public API 응답 second-layer cache.
   *   Edge cache 는 PoP 별 격리 — 한국 PoP cache ≠ 일본 PoP cache. KV 는 전역 공유.
   *   PoP cold start 시 D1 hit 대신 KV hit → D1 부하 감소 + region 간 일관성.
   *   미등록 시 publicCache 는 edge cache 만 사용 (기존 동작).
   */
  CACHE_KV?: KVNamespace;

  // ---- Durable Objects ----
  LIVE_STREAM?: DurableObjectNamespace;

  // ---- Toss Payments ----
  TOSS_SECRET_KEY: string;
  TOSS_WEBHOOK_SECRET: string;
  TOSS_CLIENT_KEY: string;

  // ---- Stripe (Global region) ----
  STRIPE_SECRET_KEY?: string;

  // ---- Auth ----
  JWT_SECRET: string;
  // 🛡️ 2026-05-03: Cloudflare Turnstile (CAPTCHA) — 봇/분산 brute-force 방어.
  //   Dashboard → Turnstile → site key 발급. secret 은 server-only.
  //   미설정 시 verifyTurnstile() 가 fail-open (검증 skip).
  TURNSTILE_SECRET?: string;
  // 🛒 2026-06-12: 네이버 검색 오픈API (developers.naver.com — 쇼핑 검색, 일 25,000회 무료).
  //   제조사 상품 등록 시 시중(네이버쇼핑) 최저가 자동 대조. 미설정 시 기능 자동 숨김(fail-soft).
  NAVER_SEARCH_CLIENT_ID?: string;
  NAVER_SEARCH_CLIENT_SECRET?: string;

  // ---- 유캔싸인(UCanSign) 전자계약 (2026-06-22) ----
  //   가입 시 계약서 자동발송. app.ucansign.com 개발자메뉴 → API KEY 발급 + 계약서 템플릿 등록(templateId).
  //   전부 선택 — 미설정 시 sendContractFromTemplate() 가 fail-soft(가입 안 막고 미발송).
  UCANSIGN_API_KEY?: string;
  UCANSIGN_TEMPLATE_ID?: string;            // 공용 폴백 템플릿(유형별 미설정 시)
  UCANSIGN_TEMPLATE_ID_SUPPLIER?: string;   // 🏭 제조사 가입 → 제조사 향 계약서 템플릿
  UCANSIGN_TEMPLATE_ID_DISTRIBUTOR?: string; // 🏪 판매사 가입 → 판매사 향 계약서 템플릿
  UCANSIGN_WEBHOOK_SECRET?: string;   // customValue5 에 심어 webhook 에코값으로 검증
  UCANSIGN_TEST_MODE?: string;        // 'true' 면 테스트발송(포인트 차감 X, 효력 미보장)

  // ---- Firebase ----
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_DATABASE_URL?: string;

  // ---- Kakao ----
  KAKAO_REST_API_KEY?: string;

  // ---- Cafe24 ----
  CAFE24_CLIENT_ID?: string;
  CAFE24_CLIENT_SECRET?: string;
  CAFE24_MALL_ID?: string;
  CAFE24_WEBHOOK_SECRET?: string;

  // ---- Aligo (알림톡) ----
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  ALIMTALK_SENDER_KEY?: string;
  ALIGO_SENDER_KEY?: string;
  ALIGO_SENDER_PHONE?: string;           // 발신번호 (예: 07080420000)
  ALIGO_TPL_ORDER_CONFIRM?: string;      // 주문완료 템플릿 코드
  ALIGO_TPL_SHIPPING_START?: string;     // 배송시작 템플릿 코드
  ALIGO_TPL_ORDER_CANCEL?: string;       // 주문취소 템플릿 코드
  ALIGO_TPL_SAMPLE_APPROVED?: string;    // 샘플 신청 승인 템플릿 코드

  // ---- YouTube ----
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REDIRECT_URI?: string;
  YOUTUBE_API_KEY?: string;  // public videos.list API (no OAuth required)

  // ---- 자체 미디어 서버 (OvenMediaEngine) ----
  // 셀러 브라우저 → 우리 OME → YouTube RTMP 릴레이용.
  // OME 인스턴스: stream.ur-team.com (Oracle Cloud Always Free).
  OME_HOST?: string;            // ex: 'stream.ur-team.com'
  OME_API_TOKEN?: string;       // OME REST API access (push 동적 등록)
  OME_WEBHOOK_SECRET?: string;  // OME → Worker admission webhook HMAC 서명

  // ---- TikTok (2026-04-26 T1 통합) ----
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;

  // ---- Push Notifications ----
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;

  // ---- Email (Resend) ----
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;

  // ---- Monitoring ----
  DISCORD_WEBHOOK_URL?: string;
  SENTRY_DSN?: string;

  // ---- Security ----
  ADMIN_IP_WHITELIST?: string; // comma-separated IPs/CIDRs, e.g. "1.2.3.4,10.0.0.0/8"
  INTERNAL_API_TOKEN?: string; // shared secret for internal-only endpoints (cron, commission calc)
  // 🛡️ 2026-04-22: DB at-rest 암호화용 KEK (Cafe24/Push subscription 토큰 보호)
  // 32자 이상의 random string. Cloudflare Dashboard → Variables and Secrets 에서 설정.
  DATA_ENCRYPTION_KEY?: string;

  // ---- Naver Ad Scraper ----
  // ⚠️ [LEGAL/PIPA] 크롤러로 수집한 이메일/연락처를 마케팅 목적으로 사용하려면
  // 정보주체의 명시적 동의가 선행되어야 합니다(개인정보 보호법 제15·22조).
  // SCRAPER_ENABLED 플래그가 'true'가 아니면 라우트는 503을 반환합니다.
  SCRAPER_ENABLED?: string; // 'true'일 때만 네이버 광고주 크롤러 활성화
  SCRAPER_URL?: string; // 스크래퍼 서버 URL (dev: http://localhost:3456)
  GITHUB_TOKEN?: string; // GitHub workflow dispatch용 (prod에서 스크래퍼 실행)
  GITHUB_REPO?: string;  // owner/repo 형식 (예: tobe2111/ur-live)

  // ---- Naver Search API (식당 이미지 등) ----
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;

  // ---- 전자세금계산서 (Bill36524 / Popbill / 바로빌) ----
  // 🏭 2026-06-09 Wave 3c: 도매 세금계산서 자동발행 stub(admin-tax.routes.issueTaxInvoice).
  //   미설정 시 provider 발행 silent skip(cost-0) — 레코드는 'draft' 로 남아 후속 발행 가능.
  //   실제 국세청(NTS) 발행은 두 값 모두 설정 + 계약 후 활성화.
  TAX_INVOICE_API_KEY?: string;
  TAX_INVOICE_API_URL?: string;
  TAX_INVOICE_SENDER_BIZ_NO?: string; // 플랫폼(공급자) 사업자등록번호 (123-45-67890)

  // ---- App Config ----
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  REGION?: string;

  // ---- Cloudflare Specific ----
  // Note: env.ASSETS is automatically available when [assets] is configured
  // No explicit binding needed in wrangler.toml
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}
