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
  ALIMTALK_SMS_FAILOVER?: string;        // 'true' 일 때만 알림톡 실패 시 SMS 대체발송(failover) 활성 (기본 OFF — 활성 전 Aligo 콘솔 SMS 발신번호 등록 필요)
  ALIGO_TPL_ORDER_CONFIRM?: string;      // 주문완료 템플릿 코드
  ALIGO_TPL_SHIPPING_START?: string;     // 배송시작 템플릿 코드
  ALIGO_TPL_ORDER_CANCEL?: string;       // 주문취소 템플릿 코드
  ALIGO_TPL_SAMPLE_APPROVED?: string;    // 샘플 신청 승인 템플릿 코드
  ALIGO_BUSINESS_REGISTRATION_VERIFIED?: string; // 사업자등록 승인 알림톡 tpl_code(콘솔 자동부여 시 override)
  ALIGO_BUSINESS_REGISTRATION_REJECTED?: string; // 사업자등록 반려 알림톡 tpl_code(콘솔 자동부여 시 override)
  ADS_ALERT_ALIMTALK_TPL?: string;       // 🎯 유어애즈 광고 알림 알림톡 템플릿 코드(미설정 시 이메일만)

  // ---- YouTube ----
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REDIRECT_URI?: string;
  YOUTUBE_API_KEY?: string;  // public videos.list API (no OAuth required) — 인플루언서 발굴에도 사용
  INFLUENCER_PROVIDER?: string;      // 인스타/틱톡 수집 제공사 이름(apify/ensembledata/modash 등)
  INFLUENCER_PROVIDER_KEY?: string;  // 제공사 API 키 — 없으면 인스타/틱톡 직접 발굴 비활성(유튜브는 무관)

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
  VAPID_SUBJECT?: string;

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

  // 🔒 2026-07-13 (데이터 감사 3단계): PII 컬럼 at-rest 암호화 마스터 스위치.
  //   'true' 일 때만 신규 쓰기가 PII 를 암호화(+blind index) 로 저장. 기본 미설정=OFF=현행 평문(무변화).
  //   ⚠️ 활성화 전 staging 필수: 조회(blind index)·표시(복호화) 배선 검증 후에만 ON.
  PII_ENCRYPTION_ENABLED?: string;
  // blind index(조회용 결정적 HMAC) 전용 키. 미설정 시 DATA_ENCRYPTION_KEY 파생값 사용.
  PII_BLIND_INDEX_KEY?: string;

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

  // ---- 유어애즈(UR Ads) — 네이버 검색광고 API (searchad.naver.com) ----
  //   연관키워드 추천(RelKwdStat)·자동입찰 추정(Estimate)·실적(StatReport) 용. 고정IP 불필요(HMAC 서명 인증).
  //   CUSTOMER_ID = 라이선스 발급 계정(관리/대행 계정 가능, 멀티테넌트 허브). 미설정 시 연관키워드 기능 자동 숨김(fail-soft).
  //   값은 Cloudflare Secrets 에만 — 코드/채팅 노출 금지. 비밀키는 1회만 표시되므로 별도 안전 보관.
  NAVER_SEARCHAD_CUSTOMER_ID?: string;
  NAVER_SEARCHAD_ACCESS_LICENSE?: string;
  NAVER_SEARCHAD_SECRET_KEY?: string;

  // ---- Anthropic (AI 마케터 / AI 리뷰 생성) ----
  //   유어애즈 AI마케터 진단·추천 + admin-review-generator. 미설정 시 해당 기능 자동 비활성(fail-soft).
  ANTHROPIC_API_KEY?: string;

  // ---- 유어애즈 자동입찰 자율 엔진 글로벌 킬스위치 ----
  //   'true' 일 때만 cron 이 활성 규칙의 입찰가를 자동 조정. 미설정/기타값이면 cron 전체 skip(기본 OFF).
  //   ⚠️ 실 계정 1회 검증(estimate 응답·bid PUT 동작) 후에만 'true' 로.
  ADS_AUTOBID_ENABLED?: string;

  // ---- 유어애즈 인플루언서 자동 수집 cron 킬스위치 (2026-07-20, Phase E) ----
  //   'true' 일 때만 ur-ads 일일 cron 이 무료 공식 API(YouTube·네이버)로 카테고리 시드 키워드를
  //   순환 발굴해 공용 풀(ad_influencer_leads.account_id=0)에 누적. 기본 OFF(미설정) = no-op.
  //   공개 데이터·공식 API 만 사용(수집 ≠ 발송 — 마케팅 발송은 정보통신망법상 사전동의 별도).
  ADS_AUTO_COLLECT_ENABLED?: string;
  ADS_AUTOCOLLECT_BATCH?: string; // 1회 실행당 키워드 수(기본 4) — 공유 YouTube 일일 한도 보호용.
  // 🌙 야간 자동 정비(중복통합→연락처 재추출→재분류 / 재보정→재조회) — 기본 ON. 'false' 로만 끔.
  ADS_AUTO_MAINTENANCE_ENABLED?: string;
  // ---- 🤝 B2B 파트너(업체) 자동 수집 (레인 A 네이버 지역검색, 2026-07-21) ----
  ADS_COMPANY_COLLECT_ENABLED?: string; // ur-ads 홀수시 크론 게이트(기본 OFF). 수동 '지금 수집'은 게이트 무관.
  ADS_COMPANY_BATCH?: string;           // 1회 실행당 키워드 수(기본 8).
  ADS_COMPANY_SUBREQUEST_BUDGET?: string; // 1회 실행 외부 fetch 상한(기본 60) — 지역검색+이메일 크롤 합산.
  ADS_ENRICH_BUDGET?: string;             // 연락처 보강 전용 예산(기본 100) — 수집과 분리, 백로그 대량 소진용. 크론 서브요청 1000 한도 내에서 상향 가능.
  ADS_COMPANY_REQUIRE_CONTACT?: string;   // '연락처 필수'(기본 ON) — 전화/이메일 없는 리드는 active=0 보류. 'false' 로 해제.
  // 소스 ① 소상공인 상가정보(data.go.kr 15090955) — tier 2~5 통째 발굴. 기본 OFF, 활용신청+검증 후 ON.
  ADS_STOREINFO_ENABLED?: string;         // ur-ads 짝수시 크론 게이트(기본 OFF). 수동 트리거는 무관.
  ADS_STOREINFO_BATCH?: string;           // 1회 실행당 (업종×지역) 페어 수(기본 3).
  PUBLIC_DATA_SERVICE_KEY?: string;       // data.go.kr 일반 인증키. 미설정 시 NTS_API_KEY(동일 계정 serviceKey) 폴백.
  // 🏪 매장 후보 — 지방행정 인허가정보(store_prospects). 기본 OFF, 활용신청 후 ON.
  ADS_LOCALDATA_ENABLED?: string;         // ur-ads 일1회 크론 게이트(기본 OFF). 수동 트리거는 무관.
  ADS_LOCALDATA_SERVICE_KEY?: string;     // 인허가 전용 인증키. 미설정 시 PUBLIC_DATA_SERVICE_KEY 폴백(같은 계정이면 공유).
  ADS_LOCALDATA_ENDPOINT?: string;        // 공통 베이스 override(기본 https://apis.data.go.kr/1741000). 업종 슬러그는 뒤에 append.
  ADS_LOCALDATA_ENDPOINTS?: string;       // 업종 슬러그→카테고리 JSON 병합(무배포 추가). 예: {"beauty_shops":"미용업","lodging":"숙박업"}
  ADS_LOCALDATA_MAX_PAGES?: string;       // 업종당 페이지 상한(기본 6, 페이지당 500).
  ADS_LOCALDATA_BACKFILL_DAYS?: string;   // 과거 백필 일수(기본 0=OFF, 예: 180) — 시간당 2일씩 역방향 소급 수집(수량 확대).
  NEIS_API_KEY?: string;                  // 🎓 나이스(open.neis.go.kr) 학원·교습소 인증키 — 인허가에 없는 학원 갭 커버.
  ADS_NEIS_ENABLED?: string;              // 학원 매시간 소량 수집 게이트(기본 OFF). 수동 트리거는 무관.
  ADS_HIRA_ENABLED?: string;              // 🏥 심평원 병원정보 매시간 소량 수집 게이트(기본 OFF) — 전화+홈페이지 직접.
  ADS_NARA_VENDOR_ENABLED?: string;       // 📑 나라장터 조달업체(대행사 계열) 일1회 게이트(기본 OFF).
  ADS_NPS_ENABLED?: string;               // 👥 국민연금 사업장 규모 검증(직원수) 일1회 게이트(기본 OFF). 수동 트리거 무관.
  ADS_NARA_VENDOR_OP?: string;            // 오퍼레이션 override(기본 getPrcrmntCorpBasicInfo — 오류 시 무배포 교정).
  ADS_NARA_VENDOR_DAYS?: string;          // 조회 구간 일수(기본 90) — 최근 등록/변경 업체.
  // 🛒 통신판매사업자 · 🏢 공정위 가맹정보 · 📢 공고 스캐너(나라장터+기업마당). 전부 기본 OFF, 키=PUBLIC_DATA_SERVICE_KEY.
  ADS_COMMERCE_OP?: string;               // 통신판매 operation override(기본 getMllBsInfoDetail_3 = MllBsDtl_3Service).
  ADS_COMMERCE_ENABLED?: string;          // 통신판매사업자 크론 게이트. ADS_COMMERCE_ENDPOINT override.
  ADS_COMMERCE_ENDPOINT?: string;
  ADS_FRANCHISE_ENABLED?: string;         // 공정위 가맹정보 크론 게이트. ADS_FRANCHISE_ENDPOINT override.
  ADS_FRANCHISE_ENDPOINT?: string;
  ADS_FRANCHISE_OP?: string;              // 가맹 operation override(기본 getBrandList = FftcBrandRlsInfo2_Service).
  ADS_FRANCHISE_YEAR?: string;            // 브랜드 기준년도(yr) — API 가 필수 요구 시 설정(예: 2024). 미설정 시 생략.
  ADS_NOTICE_ENABLED?: string;            // 공고 스캐너 크론 게이트. ADS_NARA_ENDPOINT / ADS_BIZINFO_ENDPOINT override.
  ADS_NARA_ENDPOINT?: string;
  ADS_BIZINFO_ENDPOINT?: string;

  // ---- 🌐 해외 수출 바이어 자동 수집 (유통스타트 B2B, 2026-07-20) ----
  //   유어딜과 무관 — 유통스타트(도매/수출) 소관. features/supply 자립 엔진(mount-wholesale 마운트 =
  //   소비자 워커 DCE). 한국 상품 사입 해외 수입상·유통사·리테일러를 격리 풀(overseas_buyer_leads)에 매칭 누적.
  //   ⭐ 최대한 무료 — 유료 provider 없음. [PIPA/GDPR/CAN-SPAM] 공개된 *비즈니스* 컨택만 — 수집 ≠ 발송.
  BUYER_AUTO_COLLECT_ENABLED?: string; // 'true' 일 때만 자동/수동 수집 동작(기본 OFF).
  BUYER_AUTOCOLLECT_BATCH?: string;    // 1회 실행당 타깃(카테고리×시장) 수(기본 3).
  BUYER_SUBREQUEST_BUDGET?: string;    // 1회 실행 외부 fetch 총량 상한(기본 60) — subrequest 방어.
  // 무료 피드/오픈API: 대표가 합법 수집분(KOTRA BuyKorea·TradeKorea 구매리드·전시회 공개명단·data.go.kr
  //   무료 serviceKey URL)을 JSON 으로 게시/직결하고 URL 등록. JSON 배열/NDJSON/오픈API 응답 자동 파싱.
  //   미설정이면 수집 no-op(found:0). 임의 스크래핑 없음 — 수집 근거를 대표가 통제.
  BUYER_FEED_URLS?: string;            // 쉼표구분 무료 피드/오픈API URL 목록.
  // 무료 API 키 헤더(예: 미국 ITA api.trade.gov 는 `subscription-key: XXX` 헤더 필요). "이름: 값" 형식,
  //   세미콜론(;)으로 여러 개. 모든 피드 요청에 적용. URL 파라미터로 키를 넣는 API(UN Comtrade)는 불필요.
  BUYER_FEED_HEADER?: string;          // 예: "subscription-key: abc123" 또는 "Authorization: Bearer xxx"
  // ⚠️ [위험] 상세 페이지 서버 자동 수집(대표 명시 "위험 감수하고 하자", 2026-07-21). 로그인 게이트 상세를
  //   대표 세션 쿠키로 서버가 직접 fetch — 각 사이트 약관상 자동수집 금지·계정정지 위험. 기본 OFF(의도적 무장).
  //   방어: 게이트 + 소량 배치 캡 + 요청 간 지연 + 쿠키 미저장(요청당 1회). buyKorea/tradeKorea/EC21/ECPlaza/GoBizKorea 겸용.
  BUYER_AUTO_FETCH_ENABLED?: string;   // 'true' 일 때만 상세 자동 fetch 동작(기본 OFF).
  ADS_YT_PAGES?: string;          // YT 검색 키워드당 페이지 수(기본 1, 1~5) — 깊이 확장(page2=51~100위). 쿼터 여유 시 상향. quotaHit 가드 관리.
  ADS_YT_SEARCH_BUDGET?: string;  // 🎯 YT Search Queries/day 예산(기본 100 — 실측 병목). 구글 콘솔 증설 승인 시 함께 상향.

  // ---- 📊 인플루언서 풀 → 구글 스프레드시트 자동 동기화 (2026-07-21, ur-ads Variables) ----
  //   서비스계정 JWT 직접 호출(제3자 없음). 미설정 시 조용히 skip(fail-soft). 시트는 SA 이메일에 편집자 공유 필수.
  GSHEETS_SA_EMAIL?: string;         // 서비스계정 이메일(...@...iam.gserviceaccount.com)
  GSHEETS_SA_KEY?: string;           // 서비스계정 JSON 의 private_key(PEM, \n 이스케이프 허용) — Secret 타입 권장
  GSHEETS_SHEET_ID?: string;         // 스프레드시트 ID(URL /d/{이것}/edit)
  ADS_SHEETS_SYNC_ENABLED?: string;  // 'true' 면 매시간 cron 이 시트 미러(수동 버튼은 게이트 무관)
  ADS_SUBREQUEST_BUDGET?: string;  // 1회 cron 실행의 외부 fetch 총량 상한(기본 300) — "Too many subrequests" 방어. 소진 시 조기 종료(커서 이어받음).
  ADS_NAVER_EXTRA?: string;        // YT 배정(batch) 위에 추가로 도는 네이버 전용 키워드 수(기본 12 → 틱당 네이버 총 batch+12). 네이버 25k/day 헤드룸 활용. 서브리퀘스트 예산 안에서 클램프(max 40).

  // ---- 유어애즈 AI 콘텐츠 스튜디오 — 미디어 생성(이미지/음성/영상) provider 게이트웨이 ----
  //   전부 외부 유료 API. 킬스위치 ADS_MEDIA_ENABLED='true' + 해당 provider 키가 있어야 동작(둘 다 없으면
  //   NOT_CONFIGURED/DISABLED — 기능 자동 숨김). ⚠️ 이 환경 egress 차단으로 실호출 미검증(docs 기준 배선).
  ADS_MEDIA_ENABLED?: string;          // 'true' 아니면 미디어 생성 전면 OFF(비용 방어)
  OPENAI_API_KEY?: string;             // 이미지 생성(OpenAI Images) — image provider
  ELEVENLABS_API_KEY?: string;         // AI 음성(TTS) — voice provider
  REPLICATE_API_TOKEN?: string;        // 숏폼 영상 생성(Replicate 모델) — video provider
  HEYGEN_API_KEY?: string;             // 아바타 영상(HeyGen) — video(avatar) provider
  ADS_IMAGE_PROVIDER?: string;         // 선택: 'openai'(기본) 등
  ADS_VIDEO_PROVIDER?: string;         // 선택: 'replicate'(기본) | 'heygen'
  // 유어애즈 서비스몰 수기 결제(계좌이체) 안내문 — 예: "국민은행 123-45-678 (주)유어팀". 미설정 시 안내 생략.
  ADS_BANK_INFO?: string;

  // ---- 블로그 AI 홍보 초안 주간 cron 킬스위치 ----
  //   'true' 일 때만 주간 cron 이 홍보 초안(비공개)을 생성. 미설정/기타값이면 skip(기본 OFF).
  //   초안은 항상 관리자 검토 후 발행. ANTHROPIC_API_KEY 필요.
  BLOG_AI_DRAFTS_ENABLED?: string;

  // ---- 소셜 미디어 자동화(유어딜 자체 홍보 — 스레드/인스타/유튜브) ----
  //   전부 기본 OFF. 발행은 [게이트 ON + 연결 계정 + 관리자 승인] 3중 조건. 자동 발행 없음.
  //   설계: docs/design/social-media-automation.md. 공식 API 만 사용(봇/스크래핑 없음).
  SOCIAL_THREADS_ENABLED?: string;      // 'true' 면 스레드 발행 허용
  SOCIAL_INSTAGRAM_ENABLED?: string;    // 'true' 면 인스타 발행 허용
  SOCIAL_YOUTUBE_ENABLED?: string;      // 'true' 면 유튜브 업로드 허용
  SOCIAL_AUTO_DRAFT_ENABLED?: string;   // 'true' 면 주간 초안 cron 동작(비공개 초안만)
  //   예약 발행 — 관리자가 승인+예약(scheduled_at)한 글을 매시간 cron 이 발행. 기본 OFF.
  //   발행은 여전히 플랫폼 게이트+계정+approved 3중 조건 재확인(사람이 승인한 건만).
  SOCIAL_AUTO_PUBLISH_ENABLED?: string;
  //   자격증명(Cloudflare Secrets). Meta(스레드/인스타)·Google(유튜브)은 기존 youtube 기능과 공유.
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  THREADS_APP_ID?: string;
  THREADS_APP_SECRET?: string;
  //   릴스/쇼츠 영상 렌더(스토리보드 → mp4). Worker 는 렌더 불가 → 외부 템플릿 렌더 API 위임.
  //   기본 OFF. 켜려면 SOCIAL_VIDEO_ENABLED='true' + provider 키. (기획/대본은 ANTHROPIC 로 항상 생성 가능)
  SOCIAL_VIDEO_ENABLED?: string;        // 'true' 면 영상 렌더 허용
  SOCIAL_VIDEO_PROVIDER?: string;       // 'creatomate'(기본)
  SOCIAL_VIDEO_RENDER_KEY?: string;     // 렌더 provider API 키
  SOCIAL_VIDEO_TEMPLATE_ID?: string;    // (선택) 디자인된 템플릿 ID — 자막만 주입해 품질↑

  // ---- fee-resolver 그림자 배선 스위치 (상품 소유 모델 새 수수료 규칙) ----
  //   'true' 면 결제 확정 시 새 규칙 분배를 **계산만 해서 order_fee_breakdown 에 기록**(실제 정산 무변경).
  //   목적: 스테이징/운영에서 새 규칙 vs 현행 정산 비교 검증. 검증 후 authoritative 전환은 *별도* 작업.
  //   기본 OFF — 미설정/기타값이면 그림자 기록도 안 함(현행과 100% 동일).
  FEE_RESOLVER_ENABLED?: string;

  // ---- 쇼핑 주문 원장 배선 스위치 (정산 자동화 완성) ----
  //   'true' 면 결제 확정 시 일반 쇼핑 주문 셀러 매출을 이중원장에 net 크레딧 → 주간 자동 payout 포함.
  //   기본 OFF — 미설정/기타값이면 원장 기록 안 함(현행과 100% 동일). staging 검증 후 활성.
  //   이용권/공구 주문은 skip(각자 경로에서 이미 원장 기록). 역전은 order-refund 에 배선(게이트 무관).
  SHOPPING_LEDGER_ENABLED?: string;

  // ---- 인플루언서↔업체 성과기반 매칭 정산 스위치 (2026-07-14) ----
  //   매칭 자체는 **어드민 전용 읽기 도구**(requireAdmin — env 게이트 불필요). 아래는 **정산(머니)** 전용:
  //   MATCHING_SETTLEMENT_ENABLED='true' 면 매칭 성사 수수료 적립(머니 경로) 활성 — #496 규율:
  //   promo 재원(5% 밖), 인플루언서 딜 레일 재사용, staging 축별 실결제 검증 전 미설정 유지.
  //   (라이브 적립 배선은 SSOT 아비터 경유 — 단독 flip 세션. 이 커밋엔 순수 계산·불변식만.)
  MATCHING_SETTLEMENT_ENABLED?: string;

  // ---- 상권 쿠폰 경로 B: 온라인 결제 자동발급 마스터 스위치 (2026-07-13) ----
  //   'true' 면 유어딜 결제 확정 시 참여 매장(district_stores.seller_id 연결)의 auto_issue 캠페인에서
  //   기준액 이상이면 상권 쿠폰 자동 발급(waitUntil 후처리, 완전 fail-soft — 결제 성공 경로 영향 0).
  //   기본 OFF — 미설정/기타값이면 /confirm byte-동일. 캠페인별 auto_issue_enabled + 기간 게이트가 2차.
  //   staging 실결제 검증(계약 후) 전까지 미설정 유지.
  DISTRICT_AUTO_ISSUE_ENABLED?: string;

  // ---- 상권 쿠폰 알림톡 마스터 스위치 (2026-07-13) ----
  //   'true' 면 쿠폰 지급/반려/만료임박 시 알림톡(dispatchNotification) 시도. 기본 OFF — 인앱 알림만(현행 동일).
  //   활성 절차: ① Aligo 콘솔에 district_coupon_issued/rejected/expiring 템플릿 등록·승인
  //             ② 어드민 채널설정(notification_channel_settings)에서 해당 type alimtalk 켜기
  //             ③ env DISTRICT_ALIMTALK_ENABLED=true. (③ OFF 면 ①②와 무관하게 알림톡 미발송.)
  DISTRICT_ALIMTALK_ENABLED?: string;

  // ---- 운영 자동화 백로그 (2026-07-19 — ①일일 다이제스트 ②알림톡 시퀀스 ③CS FAQ 봇) ----
  //   전부 기본 OFF/미설정 = 라이브 무접촉. 어드민 수신처는 platform_settings
  //   `ops_digest_email`/`ops_digest_phone` 키(미설정 = 벨+Discord 만).
  /** 'true' 면 소비자 대상 시퀀스 2종(드랍 D-1 예고·체험단 게시 리마인드) 발송. 기본 OFF. */
  OPS_SEQUENCES_ENABLED?: string;
  /** 'true' + ops_digest_phone 설정 시 일일 다이제스트 알림톡 발송. 기본 OFF(벨/메일만). */
  OPS_DIGEST_ALIMTALK_ENABLED?: string;
  /** 카카오 오픈빌더 스킬(CS FAQ 봇) 공유 시크릿 — 미설정 = 봇 endpoint 404(비활성). */
  KAKAO_SKILL_SECRET?: string;
  /** Aligo 콘솔이 tpl_code 를 자동부여한 경우 override (기본: 문서 코드 그대로). */
  ALIGO_DROP_D1_REMINDER?: string;
  ALIGO_EXPERIENCE_POST_REMINDER?: string;
  ALIGO_OPS_DAILY_DIGEST?: string;

  // ---- 전자세금계산서 (Bill36524 / Popbill / 바로빌) ----
  // 🏭 2026-06-09 Wave 3c: 도매 세금계산서 자동발행 stub(admin-tax.routes.issueTaxInvoice).
  //   미설정 시 provider 발행 silent skip(cost-0) — 레코드는 'draft' 로 남아 후속 발행 가능.
  //   실제 국세청(NTS) 발행은 두 값 모두 설정 + 계약 후 활성화.
  TAX_INVOICE_API_KEY?: string;
  TAX_INVOICE_API_URL?: string;
  TAX_INVOICE_SENDER_BIZ_NO?: string; // 플랫폼(공급자) 사업자등록번호 (123-45-67890)

  // ---- 정산 역발행(매입세금계산서) — 소비자 셀러 정산 (2026-07-01) ----
  //   유어딜(공급받는자)이 사업자 유저 셀러(공급자)에게 지급한 정산액에 대해 매입세금계산서를
  //   역발행(초안 자동작성 → 셀러 승인 → NTS 발행). 카카오 애드핏 = 유니포스트 역발행과 동일 모델.
  //   미설정(기본) → provider='none' → draft 로만 남음(cost-0, 실 발행 없음). tax-invoice-gateway.ts 참조.
  REVERSE_INVOICE_PROVIDER?: string; // 'unipost' | 'stub' | 미설정('none')
  UNIPOST_API_URL?: string;
  UNIPOST_API_KEY?: string;
  UNIPOST_CORP_NUM?: string; // 유어딜(공급받는자) 사업자등록번호. 미설정 시 TAX_INVOICE_SENDER_BIZ_NO fallback.

  // ---- App Config ----
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  REGION?: string;

  // ---- Cloudflare Specific ----
  // Note: env.ASSETS is automatically available when [assets] is configured
  // No explicit binding needed in wrangler.toml
  ASSETS?: { fetch: (req: Request) => Promise<Response> };

  // ---- 🎯 유어애즈 독립 Worker(ur-ads) Service Binding (2026-07-14) ----
  //   설계 SSOT: docs/design/urads-worker-split.md. 메인 Pages(ur-live) → Settings → Functions →
  //   Service bindings 에서 Variable name `ADS` → Service `ur-ads` 로 바인딩(대표 Cloudflare 셋업).
  //   ⚠️ ur-ads 에는 Custom Domain 을 붙이지 않는다(2026-04-22 사고) — 오직 이 바인딩으로만 접근.
  //   미바인딩 시 아래 게이트가 자동 폴백(로컬 마운트가 처리) → 라이브 영향 0.
  ADS?: { fetch: (req: Request) => Promise<Response> };
  // 🔁 ur-ads 자기참조 서비스바인딩(wrangler-ads.toml [[services]] SELF→ur-ads) — YT 예산 버스트 self-chain 용.
  //   각 수집 인보케이션이 다음 인보케이션(fresh 서브리퀘스트 예산)을 던지고 즉시 종료 → 오케스트레이터 시간제한 없이
  //   하루 예산을 백그라운드에서 끝까지 소진. 미바인딩 시 chained=false → 메인 오케스트레이터가 시간예산 내 폴백.
  SELF?: { fetch: (req: Request) => Promise<Response> };
  // 'true' 일 때만 /api/ads/* · /l/* 를 env.ADS(ur-ads)로 위임(프록시). 미설정/기타값 = 메인이 직접 처리(현행 동일).
  //   컷오버: staging 에서 ur-ads 위임 검증 후 이 값을 'true' 로. /api/admin/ads/* 는 항상 메인 유지(메인 admin JWT).
  ADS_WORKER_ENABLED?: string;
}
