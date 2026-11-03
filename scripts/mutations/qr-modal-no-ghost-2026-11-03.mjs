/** 🩹 QR 창 잔상 (2026-11-03) — 주입 매니페스트. 가드: src/tests/unit/qr-modal-no-ghost-2026-11-03.test.ts */
const TEST = 'src/tests/unit/qr-modal-no-ghost-2026-11-03.test.ts'
export default [
  {
    name: '🩹QR잔상 QR 창이 다시 흐림 판으로 — 이용 안내가 겹쳐 그려진다',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: '<div ref={panelRef} className="ur-glass-solid ur-pop-card',
    replace: '<div ref={panelRef} className="ur-glass ur-pop-card',
    test: TEST,
    why: '대표 *"이용안내 글자 두번 겹치는건 고쳐줘"* — 흐림 판 안 스크롤이 잔상을 남긴다.',
  },
  {
    name: '🩹QR잔상 불투명 판에 흐림이 섞인다',
    file: 'src/index.css',
    find: '.ur-glass-solid { background: var(--surface); box-shadow: var(--pop-shadow); }',
    replace: '.ur-glass-solid { background: var(--surface); box-shadow: var(--pop-shadow); backdrop-filter: blur(24px); }',
    test: TEST,
    why: '흐림이 다시 붙으면 같은 잔상이 돌아온다.',
  },
]
