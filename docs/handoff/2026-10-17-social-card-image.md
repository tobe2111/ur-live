# 2026-10-17 — 인스타 카드 이미지 자동 생성

**무엇**: 인스타 초안의 이미지 칸이 비어 게시가 막혔다(라이브 id 2·5). 대표: *"이미지를 만드는 것까지 해줘야지. 퀄리티는 상당해야해"*.

**한 것**
- `social-image-card.ts` — 1080×1350 카드 HTML(대상별 3테마: 사장님=라이트 / 소개 파트너=딥네이비 / 손님=브랜드 블루).
  제목 + 본문 첫 문장 + 대상별 화면 조각(티켓) + 확정 유달이 + 착지 주소. 숫자·금액을 지어내지 않는다.
- `social-image-render.ts` — Cloudflare Browser Rendering(`BROWSER`)으로 찍어 R2(`MEDIA_BUCKET`, `social/` 접두)에 올리고 `media_url` 세팅.
- 매일 09:00 크론이 인스타 초안에 자동으로 붙인다 · 어드민 `/admin/social` 에 미리보기 + [카드 이미지 만들기/다시 만들기].
- `wrangler-ads.toml` 에 `[browser]` + `MEDIA_BUCKET` 선언(대시보드만 두면 다음 배포가 지운다).
- 유달이 3포즈를 `public/assets/mascot/` 에 사본으로(고정 주소 필요) — 장부에 기록.

**디자인 확인**: 로컬 Playwright 로 같은 HTML 을 렌더해 눈으로 봤다(3테마 · 짧은/긴 제목).

**다음 세션 첫 액션 (E4)**
1. 배포 후 어드민 `/admin/social` 에서 인스타 초안(id 2·5)에 [카드 이미지 만들기] → 미리보기가 뜨는지.
   실패 문구가 `BROWSER` 면 바인딩이 안 붙은 것(배포 로그 확인), `렌더 실패: …` 면 브라우저 쪽.
2. 내일 09:00 크론 뒤 새 인스타 초안에 `media_url` 이 `https://media.ur-team.com/social/card-*.jpg` 로 붙었는지.
3. 그 이미지를 직접 열어 **Pretendard 로 찍혔는지**(시스템 글꼴이면 글꼴 대기가 실패한 것).

**알아둘 것**: 무료 플랜 브라우저는 하루 10분·넘으면 과금이 아니라 실패. 카드 1장 수 초.
R2 고아 정리 크론은 `uploads/` 만 보므로 `social/` 카드는 안 지워진다(가드가 고정).

## 2차 — 대기업 수준으로 다시 (2026-10-17 대표 *"아예 퀄리티 대기업급이어야 하는데"*)

1차 카드를 다시 보니 싸 보이는 원인이 넷이었다:
1. **유달이가 흐렸다** — 확정 포즈(`udal-pose-*.webp`)는 높이 **238px** 뿐인데 카드에 360px 로 키웠다(1.5배).
   ⇒ 원본 해상도 검수를 통과한 **v6 칸**(`poses-2026-10-11/v6-cut-{6,1,2}.png`, 약 480px)으로 교체 →
   `public/assets/mascot/udal-social-{phone,wave,gift}.webp`(가장자리 1px 다듬음 — 파란 바탕에서 밝은 테두리가 보였다). 장부 등록.
   그리는 높이 `MASCOT_DRAW_H = 470` ≤ 원본(테스트가 webp 머리를 읽어 고정).
2. **템플릿 장식** — 장식 원 · 강조 막대 · 기울인 티켓(홈 파기) · 알약 꼬리표 → 전부 뺐다.
3. **한글 제목이 뭉쳤다** — 굵기 800 · 자간 −4.5% → 700 · −3.2%, `keep-all` + `text-wrap:balance`.
4. **하단 조각이 본문을 반복**했다(소개 파트너). 조각은 앱 알림 한 장처럼 평평하게: [아이콘 · 한 줄 · 상태 알약].

구성: 워드마크 + 대상(글자) · 제목 · 보조 한 문장 · 왼쪽 아래 조각 + 주소 · 오른쪽 아래 유달이(바닥 그림자 + 큰 원 하나).
로컬 렌더(1080×1350, Pretendard 로드 확인)로 세 대상 다 눈으로 봤다.

⚠️ 못 본 것: Cloudflare 브라우저에서의 실제 렌더(배포 후 E4) · 인스타 앱에서의 실제 크기.

## 3차 — 라이브 첫 실행이 렌더에서 죽었다 (#1882 머지 `fb58198` 뒤)

`POST /api/admin/social/posts/{2,5}/card-image` → `렌더 실패: browserType.connectOverCDP: [unenv] fs.mkdtemp is not implemented yet!`
원인: `deploy-ads.yml` 이 `wrangler@3` 로 배포하는데, wrangler 가 esbuild 결과물을 **다시 번들**하면서 `node:fs` 를
unenv 껍데기로 바꿔 끼운다(dry-run 산출물에서 `unenv` 86회 실측). 우리 esbuild 번들은 이미 완결이고 외부는 `cloudflare:*` · `node:*` 뿐.
처방: `wrangler-ads.toml` 에 `no_bundle = true` — dry-run 산출물이 `dist-ads/index.js` 와 **바이트 동일**, unenv 0.
로컬 workerd(miniflare, 2025-12-01 + nodejs_compat)로 기동 + `fs.mkdtempSync` 성공 확인(node:http/net/tls/dns 포함 전 모듈 로드).
⚠️ 못 본 것: 프로덕션에서 실제 렌더(배포 후 E4 — 2·5번 초안에 다시 요청).

## 4. E4 라이브 판정 (2026-10-18 06:20 KST)
- #1892 머지(`a72b5478a`) → `Deploy ur-ads Worker` 성공 → 어드민 `POST /api/admin/social/posts/{2,5}/card-image` 둘 다 `success:true`.
- 산출물 `media.ur-team.com/social/card-2-1792271998570.jpg` · `card-5-1792272002943.jpg` — 둘 다 1080×1350, 약 98KB.
- 눈으로 확인: Pretendard 제목·본문, Poppins 워드마크 `urdeal.`, 유달이(손 흔들기 / 엄지+휴대폰) 원본 해상도 이내로 렌더, 소품 카드·URL 줄 정상. unenv `fs.mkdtemp` 오류 재발 없음.
- 남은 일: 초안 발행 자체는 대표 판단(발행 = 결재 C).
