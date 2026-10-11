## 2026-10-11 — sitemap 이 사업자등록증을 구글 이미지에 색인 요청하고 있었다

**[E2]** 코드 수정 + 가드 작성·주입 6건 되돌려-검증 완료. **E3(배포) 전이고, 이미 색인된 것은 코드로 못 되돌린다.**

### 무엇을 발견했나 (라이브 실측 2026-10-11)

대표가 *"이용권 사진이 뜨는데 이용권 명칭이 안 뜬다"* 는 구글 패널 스크린샷을 보내 SEO 를 재다가,
`sitemap.xml` 에서 이것을 봤다:

```xml
<loc>https://urdeal.kr/pass/2916</loc>
<image:loc>https://urdeal.kr/api/media/uploads/biz-cert/2026-09/C7QDtf…png</image:loc>
```

- 그 PNG 는 **공개 응답한다** — `http 200 · image/png · 63,765 bytes`(열어 보지 않고 헤더로만 확인).
- `/pass/2916` 는 `robots: index, follow` 다.
- 상품은 **내가 S-BROKER 실결제 테스트용으로 만든 `[테스트] 클로드분식`** 이고, 그 커버로
  사업자등록증이 들어가 있었다. sitemap 은 `products.image_url` 을 **그대로** 실어 보냈다.

⚠️ **특히 나쁜 이유**: 2026-06-11 에 R2 를 공개로 돌리며 biz-cert 의 방어를
**"16자 랜덤키(~95bit)라 추측 불가"** 하나로 뒀다(CLAUDE.md audit log). sitemap 은 그
추측 불가능한 URL 을 **검색엔진에 직접 건네준다** — 유일한 방어의 정면 무효화다.
사업자등록증에는 대표자 성명·사업장 주소·사업자번호가 적혀 있다.

### 무엇을 고쳤나

신규 SSOT `src/shared/seo/indexable-image.ts` — `isIndexableImageUrl(url)`.
`sitemap.routes.ts` 두 자리에 배선:

1. **초크포인트**(`<image:loc>` 를 만드는 유일한 자리) — 출처가 공구든 상품이든 블로그든 셀러든
   전부 여기를 지난다. 마지막 방어선.
2. **공구 분기** — 커버가 비공개면 OG 카드(`/api/og/group-buy/:id`)로 **대체**한다. 그냥 버리면
   그 상품만 사진 없는 sitemap 항목이 된다.

**거부 목록이지 allowlist 가 아니다.** allowlist 면 새 업로드 접두사가 생길 때마다 멀쩡한 상품
사진이 **조용히** 색인에서 빠진다(이 레포가 반복해 당한 "실패가 아니라 부재"). 거부 목록은 반대
방향으로 틀리는데 — 새 비공개 접두사를 놓친다 — 그쪽은 드리프트 검사가 막는다:
**소스에 쓰인 `uploads/<접두사>/` 중 분류 안 된 게 나타나면 빨간불.**

### 가드

`src/tests/unit/sitemap-private-image-2026-10-11.test.ts` 11건
(판정 7 + 배선 3 + 드리프트 1) · `scripts/mutations/sitemap-private-image.mjs` 6건
**전부 되돌려-검증 빨간불 확인**.

🩸 **주입 하나를 다시 겨눴다.** 처음엔 드리프트 검사를 **테스트 자신을 무력화**해서 검증하려 했는데
당연히 초록이 떴다 — **시험은 자기가 꺼진 것을 못 본다.** 진짜 결함 모양
(`uploads/district/` → `uploads/receipt-scan/`, 소스에 새 경로가 생기는 실제 모양)으로 바꾸니 빨간불.

### 이 수정이 **못** 하는 것 (중요)

- **이미 색인된 것은 코드로 못 되돌린다.** sitemap 에서 빼면 앞으로 안 넘어갈 뿐이다.
- sitemap **밖**의 노출은 안 본다 — 그 상품의 JSON-LD `image`, og:image, 상세 화면 커버는 그대로다.
  애초에 서류를 커버로 못 쓰게 하는 것은 **업로드 단**의 일이고 이 PR 범위가 아니다.
- 파일이 정말 사업자등록증인지는 안 본다. **경로로만** 판정한다.

### 대표 판단이 필요한 것 (어드민 쓰기 — 세션이 임의로 안 한다)

1. **상품 2916 내리기** — `PATCH /api/admin/products/2916 {is_active:0}`.
   내리면 sitemap·JSON-LD·og 전부에서 함께 사라진다. (원래 테스트 끝나고 내릴 상품이었다.)
2. **커버 이미지 교체 또는 삭제** — 그 R2 객체(`uploads/biz-cert/2026-09/C7QDtf…png`)가
   공개로 남아 있는 한 URL 을 아는 쪽은 계속 받을 수 있다.
3. **구글 색인 제거 요청** — 이미 수집됐다면 서치콘솔 '삭제 요청'. 세션이 못 한다(대표 계정).

### 다음 세션의 첫 액션

배포 후 `curl -sS https://urdeal.kr/sitemap.xml | grep -c biz-cert` → **0** 이어야 한다.
(수정 전 값은 1. 캐시가 있으므로 sitemap 캐시 TTL 지난 뒤에 볼 것.)
