/**
 * 🔔 안 쓸 VAPID 키 요청을 첫 화면에서 받아 오던 것 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/push-vapid-defer-2026-09-15.test.tsx
 *
 * 이 결함은 **에러를 안 낸다** — 요청 하나가 조용히 낭비될 뿐이라 아무도 신고하지 않는다.
 */
const TEST = 'src/tests/unit/push-vapid-defer-2026-09-15.test.tsx'
const PUSH = 'src/components/PushNotificationSetup.tsx'

export default [
  {
    name: '[푸시] 권한 검사를 키 조회 뒤로 되돌린다 (안 쓸 요청이 첫 화면에서 나간다)',
    file: PUSH,
    find: "    if (Notification.permission !== 'granted') return\n\n    // VAPID 키",
    replace: "    // VAPID 키",
    test: TEST,
    why: '권한 default 인 대다수가 매 진입마다 결과를 안 쓰는 요청을 하나씩 보낸다(지연 의도의 절반만 적용된 상태로 회귀).',
  },
  {
    name: '[푸시] granted 인데 키를 아예 안 받는다 (알림 구독 영구 두절)',
    file: PUSH,
    find: '    void resolveVapidKey().then((vapidKey) => {',
    replace: '    void Promise.resolve("").then((vapidKey: string) => {',
    test: TEST,
    why: '자가치유가 죽으면 endpoint 교체·410 이후 어드민 시스템 경보가 조용히 안 온다.',
  },
]
