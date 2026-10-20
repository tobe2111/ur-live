/**
 * 🧬 주입 — 마이 하위 화면이 서버가 하는 일과 같은 말을 하는가 (2026-10-19)
 *    가드: src/tests/unit/account-delete-honest-2026-10-19.test.ts
 */
const T = 'src/tests/unit/account-delete-honest-2026-10-19.test.ts'
export default [
  {
    name: '탈퇴정직 — 거짓 약속("모든 혜택이 회복")이 돌아온다',
    file: 'src/pages/AccountDeleteWarningPage.tsx',
    find: "defaultValue: '쿠폰 · 찜한 상품 · 단골 가게 · 알림도 함께 지워져요.'",
    replace: "defaultValue: '30일 내 복원 시 모든 혜택이 회복됩니다.'",
    test: T,
    why: '탈퇴 순간 쿠폰·찜은 삭제되는데 되돌아온다고 약속하는 것은 거짓 안내다.',
  },
  {
    name: '탈퇴정직 — 서버가 찜을 안 지우는데 화면은 지운다고 한다',
    file: 'src/worker/services/delete-account.service.ts',
    find: "await db.prepare('DELETE FROM wishlists WHERE user_id = ?')",
    replace: "await db.prepare('SELECT 1 FROM wishlists WHERE user_id = ?')",
    test: T,
    why: '화면의 "바로 사라져요" 목록과 서버의 실제 삭제가 갈리면 둘 중 하나는 거짓말이다.',
  },
  {
    name: '탈퇴정직 — 받기 전·실패한 잔액을 0 으로 위장한다',
    file: 'src/pages/AccountDeleteWarningPage.tsx',
    find: 'dealKnown ? Math.max(0, Number(balanceQ.data ?? 0)) : null',
    replace: 'Math.max(0, Number(balanceQ.data ?? 0))',
    test: T,
    why: '못 읽은 잔액을 0 으로 보이면 "소멸될 딜이 없어요" 라고 말하고 딜 보유자를 탈퇴시킨다.',
  },
  {
    name: '탈퇴정직 — 잔액을 받기 전에 탈퇴 버튼이 열린다',
    file: 'src/pages/AccountDeleteWarningPage.tsx',
    find: 'const canProceed = agreed && !dealChecking && blockersClear',
    replace: 'const canProceed = agreed && blockersClear',
    test: T,
    why: '캐시 seed(0)로 "소멸될 딜이 없어요" 를 보인 채 탈퇴하면 딜 보유자가 모르고 딜을 잃는다.',
  },
  // ↪ '안 쓴 이용권을 지갑과 다른 기준으로 센다' 는 2026-10-19 결재 뒤 서버 SQL 로 옮겨갔다 —
  //   `account-delete-blockers-2026-10-19.mjs` 의 '쓴 이용권까지 센다' 가 같은 불변식을 실제 SQLite 로 지킨다.
  {
    name: '탈퇴정직 — 복원 문구가 다시 쿠폰·딜이 살아난다고 한다',
    file: 'public/locales/ko/translation.json',
    find: '"restoreWhenRestoreDesc": "구매·이용권 기록과 리뷰가 돌아와요. 딜·쿠폰·찜은 탈퇴할 때 사라져 돌아오지 않아요."',
    replace: '"restoreWhenRestoreDesc": "이전 주문 내역, 쿠폰, 딜 포인트, 위시리스트 등 모든 데이터가 다시 살아나요."',
    test: T,
    why: 'restoreUser 는 users 한 행만 되살린다 — 쿠폰·딜은 탈퇴 때 이미 지워졌다.',
  },
  {
    name: '내리뷰 — 안 쓴 이용권까지 "리뷰를 기다려요" 에 띄운다',
    file: 'src/pages/MyReviewsPage.tsx',
    find: "if (!pid || v.status !== 'used' || Number(v.deal_only) === 1",
    replace: "if (!pid || Number(v.deal_only) === 1",
    test: T,
    why: '서버는 매장에서 쓴 이용권에만 리뷰를 허락한다 — 누르면 "이용권을 사용한 뒤에" 로 막힌다.',
  },
  {
    name: '내리뷰 — 리뷰 쓰기가 없는 앵커로 간다',
    file: 'src/pages/MyReviewsPage.tsx',
    find: "export const PASS_REVIEW_ANCHOR = 'gb-sec-reviews'",
    replace: "export const PASS_REVIEW_ANCHOR = 'review'",
    test: T,
    why: '없는 앵커면 상세 맨 위가 열리고 끝난다(종전 `#review` 가 그랬다).',
  },
  {
    name: '내리뷰 — 해시를 selector 로 쓴다(외부 입력이 querySelector 로)',
    file: 'src/components/ScrollToTop.tsx',
    find: 'const el = document.getElementById(id)',
    replace: 'const el = document.querySelector(hash) as HTMLElement | null',
    test: T,
    why: '주소의 해시는 외부 입력이다 — selector 로 쓰면 이상한 해시가 예외를 던진다.',
  },
  {
    name: 'FAQ — 쇼핑이 숨겨졌는데 배송 질문이 다시 뜬다',
    file: 'src/shared/seo/concept-content.ts',
    find: '? CONCEPT_FAQ_ALL.filter((f) => !SHOPPING_ONLY_FAQ_KEYS.has(f.key))',
    replace: '? CONCEPT_FAQ_ALL.filter(() => true)',
    test: T,
    why: '지금 파는 것엔 배송이 없다 — "택배로 보내 주나?" 로 읽히고 AI 검색에도 그대로 인용된다.',
  },
  {
    name: '지도피커 — 개발자 원인 문장을 손님 화면에 그린다',
    file: 'src/components/KakaoMapPicker.tsx',
    find: "{t('map.picker.loadFailed', { defaultValue: '지도를 불러오지 못했어요' })}",
    replace: "{sdkError}",
    test: T,
    why: '"운영자 환경변수 확인" 은 사장님·손님이 할 수 있는 일이 아니다.',
  },
]
