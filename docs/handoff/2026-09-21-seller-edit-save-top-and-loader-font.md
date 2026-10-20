# 2026-09-21 — 셀러 상품편집 저장 버튼 위치 + 로더 워드마크가 안 보이던 것

대표 지시 두 줄이 이 세션의 전부다.

> *"셀러대시보드에서 로더가 문제 있는거야."*
> *"https://urdeal.kr/seller/products 에서 변경사항 저장 버튼은 하단이 아닌 위에다가 둬줘"*

---

## 1. 저장 버튼을 페이지 헤더로

**무엇이 불편했나.** 이용권 편집 폼은 길다(기본정보 · 이미지 · 매장정보 · 이용권 조건 · 옵션).
한 칸만 고치고 저장하려 해도 **끝까지 스크롤**해야 했다.

**어떻게 옮겼나 — 저장 경로를 둘로 만들지 않고.**
헤더는 `<form>` 의 형제라 `type="submit"` 만으로는 그 폼을 제출하지 못한다. 그래서 **HTML `form` 속성**으로 묶었다:

```tsx
const EDIT_FORM_ID = 'seller-product-edit-form'
<Button type="submit" form={EDIT_FORM_ID} disabled={submitting}>…</Button>
<form id={EDIT_FORM_ID} onSubmit={handleSubmit}>
```

브라우저가 그 폼을 제출하므로 `handleSubmit` · `required` 검증 · `submitting` 비활성이
**하단 버튼이던 시절과 완전히 같다.** 하단 제출 블록(취소 + 저장)은 삭제했다.

🔴 **`onClick={handleSubmit}` 을 달면 안 된다** — 그 순간 폼 검증을 건너뛰는 **두 번째 저장 경로**가 생기고,
빈 칸인 채로 저장이 날아가 서버가 거절해도 셀러는 이유를 모른다. 가드가 이걸 금지한다.

파일: `src/pages/SellerProductEditPage.tsx` 595 → **590**줄(동결 이내).

---

## 2. 로더에 `urdeal` 글자가 안 보이던 것 — 색이 아니라 **폰트**였다

**결정적 단서는 점의 위치였다.** 대표 스크린샷에 브랜드 점 하나만 있었는데,
이미지 폭 1915 의 중앙은 957 인데 점은 **~1026(+69px)**. 글자가 아예 없었다면 점이 가운데 왔을 것이다.
⇒ **글자가 자리는 차지하는데 안 칠해진** 상태 = 웹폰트를 기다리는 동안의 투명 구간(FOIT).
(오프라인 하네스로 같은 마크업 재현: 워드마크가 레이아웃을 차지할 때 오프셋 **+59px**.)

**처방(대표 승인 "단어 하나 교체")**: `index.html` 의 구글 폰트 주소 `display=swap` → `optional`.
`swap` 은 블록 구간 동안 글자를 안 그린다(그 구간이 하필 로더가 떠 있는 순간과 겹친다).
`optional` 은 제때 안 오면 기다리지 않고 폴백으로 **바로** 그린다.
이 레포는 본문 폰트(Pretendard)에 **이미 같은 처방**을 쓰고 있다 — 이제 두 폰트가 같은 규칙이다.

`index.html` 은 잠금 파일이라 `CLAUDE.md` 로딩 audit log 에 `[UNLOCK_LOADING]` 항목을 남겼다.

---

## 🩸 이번에 내가 틀린 판단 둘 (다음 세션이 같은 길로 가지 말 것)

1. **"밝은 표면에 다크 워드마크(`forceLight` 미전달)"** — 틀렸다.
   `/seller/*` 는 `isDashboardLoaderSurface` 가 잡아 `DashboardLoader`(forceLight)로 가고
   글자는 잉크색(`#16181C`)이라 배경(`#F4F5F7`)과 대비가 충분하다. **색 문제가 아니었다.**
2. **"`isDashboardLoaderSurface` 가 `agency` 를 빠뜨렸다"** — 틀렸다.
   에이전시는 2026-09-04 완전 일몰이라 `/agency/**` 라우트가 **없다**. 정규식에 없는 게 정상이고,
   **고치지 않았다.** CLAUDE.md 에 남아 있는 옛 문장(`/seller|/admin|/agency|/ads`)을 보고 오판했다.

> 🧭 교훈: **문서 문자열을 현재 라우트의 증거로 쓰지 말 것.** `App.tsx` 를 먼저 확인했으면 30초였다.

---

## 다음 세션의 첫 액션

1. **배포 후 로더 판정(E4)** — 셀러 대시보드 **콜드** 진입에서 로더에 `urdeal` 글자가 보이는지.
   (같은 폭 스크린샷이면 점이 **정중앙 근처**로 오는지로도 판정된다.)
2. **대표 화면 확인 필요**(세션은 401 인증벽을 못 넘는다): `/seller/products/2915` 편집 →
   열림 · **위쪽** 저장 버튼으로 저장 · 삭제.

## 남은 결정/대기

- **딜 조절 게이트** `voucher_partial_deal_enabled` 는 아직 OFF — `STAGING_CHECKLIST.md` **S13**(특히 S13-3) 선행.
- `payment_status` 가 `'pending'` 인 채 `status='PAID'` 인 것 — 머니 경로라 **단독 세션**.
- `delivery_kind` 죽은 컬럼(무해, 미결정).
