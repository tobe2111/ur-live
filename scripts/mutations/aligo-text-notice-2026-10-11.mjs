/**
 * 🧬 주입 — **알림은 알리고 하나로** (2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?")
 *
 * 되돌리면 전부 조용하다: 에러도 경고도 없이 문자·알림톡이 안 나간다. 라이브에서 실제로 그랬다
 * (솔라피 키 부재로 건너뜀 · 알리고 옛 주소가 HTML 반환 · 성공 기록 0건).
 */
const T = 'src/tests/unit/aligo-text-notice-2026-10-11.test.ts'
export default [
  {
    name: '알리고 — 알림톡을 옛 주소(HTML 을 돌려주던 admin/api)로 보낸다',
    file: 'src/lib/aligo.ts',
    find: "export const ALIGO_KAKAO_BASE = 'https://kakaoapi.aligo.in/akv10'",
    replace: "export const ALIGO_KAKAO_BASE = 'https://smartsms.aligo.in/admin/api/akv10'",
    test: T,
    why: '그 주소는 HTML 페이지를 돌려준다 — 라이브 실패 원문 "Unexpected token <", 성공 0건.',
  },
  {
    name: '알리고 — 알림톡에 발신번호(sender)를 싣지 않는다',
    file: 'src/lib/aligo.ts',
    find: '      sender: sender || undefined,\n',
    replace: '',
    test: T,
    why: '알리고 알림톡의 필수값 — 빠지면 요청 자체가 거부된다.',
  },
  {
    name: '알리고 — 빈 code 를 성공으로 읽는다',
    file: 'src/lib/aligo.ts',
    find: "  if (code !== undefined && code !== null && String(code).trim() !== '') return Number(code) === 0",
    replace: '  if (code !== undefined && code !== null) return Number(code) === 0',
    test: T,
    why: "Number('') 은 0 — 깨진 응답이 '보냄' 으로 기록된다.",
  },
  {
    name: '알리고 — 발신번호 env 를 _PHONE 만 읽는다(라이브 이름은 ALIGO_SENDER)',
    file: 'src/lib/aligo.ts',
    find: "  const direct = String(e.ALIGO_SENDER_PHONE ?? e.ALIGO_SENDER ?? '')",
    replace: "  const direct = String(e.ALIGO_SENDER_PHONE ?? '')",
    test: T,
    why: '라이브엔 ALIGO_SENDER 만 있다 — 발신번호가 비어 문자가 한 통도 안 나간다.',
  },
  {
    name: '알림 — 승인 안 된 템플릿도 알림톡으로 보낸다',
    file: 'src/lib/text-notice.ts',
    find: '  const useAlimtalk = !!senderKey && (await approvedTemplates(db)).has(n.tpl)',
    replace: '  const useAlimtalk = !!senderKey',
    test: T,
    why: '카카오 검수 전 템플릿은 알리고가 거부한다 — 문자 대체도 안 걸린다(요청 단계 거부).',
  },
  {
    name: '알림 — 알림톡에 문자 대체(failover)를 안 건다',
    file: 'src/lib/text-notice.ts',
    find: '      failoverText: { title: n.title, text: n.text },\n',
    replace: '',
    test: T,
    why: '카카오톡이 없거나 차단한 사람에게 알림이 아예 안 간다.',
  },
  {
    name: '알림 — 문자 실패를 재시도 큐에 태운다',
    file: 'src/lib/text-notice.ts',
    find: 'max_retries) VALUES (?, ?, ?, ?, 0)',
    replace: 'max_retries) VALUES (?, ?, ?, ?, 3)',
    test: T,
    why: '재시도 cron 은 알림톡 템플릿으로 다시 보낸다 — 문자 건을 승인 안 된 템플릿으로 3번 더 거부당한다.',
  },
  {
    name: '알림 — 사장님 판매 알림이 솔라피로 되돌아간다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: "    await sendTextNotice(env, cleanPhone, { tpl: 'seller_voucher_sold', title: '이용권 판매', text: message })\n",
    replace: "    await fetch('https://api.solapi.com/messages/v4/send', { method: 'POST', body: message }).catch(() => {})\n",
    test: T,
    why: '라이브에 솔라피 키가 없다 — 판매 문자가 한 통도 안 나간다.',
  },
  {
    name: '로그인 — 채널 추가 동의를 플래그 없이 늘 요청한다',
    file: 'src/features/auth/services/kakao-login-scope.ts',
    find: "  if (env.KAKAO_CHANNEL_ADD_ENABLED === 'true') scopes.push('plusfriends')",
    replace: "  scopes.push('plusfriends')",
    test: T,
    why: '콘솔에 plusfriends 동의항목이 없으면 카카오가 로그인 자체를 거부한다(KOE205).',
  },
]
