/**
 * 🎬 결제 처리 중 도는 원 — 2026-11-02 시안 6차(대표 "다 넣어줘") · 최적화(대표 "셋 다 해줘").
 *
 * 이용권 상세의 모바일 결제 바(`DealBottomBar`)와 PC 구매 상자(`DealPurchaseBox`)가 같은 CSS 를 각자 들고 있어
 * 상세 청크에 **두 번** 실렸다(빌드 실측). 둘 다 같은 상세 청크에 사는 부품이라 이 파일을 함께 import 해도
 * 새 청크가 생기지 않는다 — 다른 화면의 부품이 이 파일을 import 하면 그 전제가 깨진다(그럴 땐 그 부품에 따로 둘 것).
 */
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-pay', `@keyframes ur-pay-spin { to { transform: rotate(360deg); } }@keyframes ur-pay-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }.ur-pay-busy { display: inline-flex; align-items: center; gap: 8px; animation: ur-pay-in .2s ease-out both; }.ur-pay-spin { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid currentColor; border-top-color: transparent; opacity: .85; animation: ur-pay-spin .7s linear infinite; }@media (prefers-reduced-motion: reduce){.ur-pay-busy,.ur-pay-spin{animation:none!important}}`)
