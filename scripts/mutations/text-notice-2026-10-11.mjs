/**
 * 🧬 주입 — **알림은 카톡 알림톡 하나로** (2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?" ·
 *    2026-10-12 발송처 = 네이버 클라우드 SENS, 알리고 제거)
 *
 * 되돌리면 전부 조용하다: 에러도 경고도 없이 알림톡이 안 나가거나 돈이 샌다.
 */
const T = 'src/tests/unit/text-notice-2026-10-11.test.ts'
export default [
  {
    name: '알림 — 승인 안 된 템플릿도 알림톡으로 보낸다',
    file: 'src/lib/text-notice.ts',
    find: '  if (!n.forceAlimtalk && !approved.has(n.tpl)) {',
    replace: '  if (false) {',
    test: T,
    why: '카카오 검수 전 템플릿은 SENS 가 거절한다 — 비용·실패 기록만 쌓인다.',
  },
  {
    name: '알림 — 실패를 재시도 큐에 태운다',
    file: 'src/lib/text-notice.ts',
    find: 'max_retries) VALUES (?, ?, ?, ?, 0)',
    replace: 'max_retries) VALUES (?, ?, ?, ?, 3)',
    test: T,
    why: '거절된 템플릿을 같은 본문으로 3번 더 보내 거절당한다(원인이 안 바뀌었다).',
  },
  {
    name: '알림 — 사장님 판매 알림이 솔라피로 되돌아간다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: "    await sendTextNotice(env, cleanPhone, { tpl: 'seller_voucher_sold', title: '이용권 판매', text: message, sellerId: data.sellerId })\n",
    replace: "    await fetch('https://api.solapi.com/messages/v4/send', { method: 'POST', body: message }).catch(() => {})\n",
    test: T,
    why: '라이브에 솔라피 키가 없다 — 판매 알림이 한 통도 안 나간다.',
  },
  {
    name: '알림 — 알리고로 보내는 코드가 되살아난다',
    file: 'src/lib/system-alimtalk.ts',
    find: "  if (!sensConfigured(e as Record<string, unknown>)) {",
    replace: "  if (e.ALIGO_API_KEY) await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/').catch(() => null)\n  if (!sensConfigured(e as Record<string, unknown>)) {",
    test: T,
    why: '알리고는 서버 고정 IP 없이는 거부한다(-99/-101) — 되살리면 다시 한 통도 안 나간다.',
  },
  {
    name: '로그인 — 채널 추가 동의를 플래그 없이 늘 요청한다',
    file: 'src/features/auth/services/kakao-login-scope.ts',
    find: "  if (env.KAKAO_CHANNEL_ADD_ENABLED === 'true') scopes.push('plusfriends')",
    replace: "  scopes.push('plusfriends')",
    test: T,
    why: '콘솔에 plusfriends 동의항목이 없으면 카카오가 로그인 자체를 거부한다(KOE205).',
  },
  {
    name: '알림 — 발송 시험을 super_admin 아니어도 보낸다',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "    if (admin?.role !== 'super_admin') return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403)\n    const body = await c.req.json<{ user_id?: unknown; tpl?: unknown }>()",
    replace: "    const body = await c.req.json<{ user_id?: unknown; tpl?: unknown }>()",
    test: T,
    why: '조회 권한(viewer·cs) 어드민이 아무 유저에게나 문자를 보낼 수 있게 된다.',
  },
]
