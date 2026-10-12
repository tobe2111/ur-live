// ✉️ 2026-10-12 메일 네이버 클라우드 SENS 전환 — 대표 "메일, 알림톡 … 최대한 설정하고"
const T = 'src/tests/unit/ncp-sens-mail-2026-10-12.test.ts'
export default [
  {
    name: 'SENS 메일 — 대량·홍보 메일도 SENS 로 보낸다',
    file: 'src/services/email.ts',
    find: '  const sens = params.headers || params.replyTo ? null : await sensMailEnv()',
    replace: '  const sens = await sensMailEnv()',
    test: T,
    why: '수신거부 헤더 없는 홍보·콜드 대량 메일이 네이버 클라우드로 나가 계정 정지 위험.',
  },
  {
    name: 'SENS 메일 — 거절돼도 Resend 로 안 넘긴다',
    file: 'src/services/email.ts',
    find: '    if (r.success || !apiKey) return r',
    replace: '    return r',
    test: T,
    why: '발신 도메인 미등록 같은 설정 실수 하나로 모든 메일이 사라진다(에러 없이).',
  },
  {
    name: 'SENS 메일 — 홍보 표기를 켠 채 보낸다',
    file: 'src/lib/ncp-sens-mail.ts',
    find: '    advertising: false,',
    replace: '    advertising: true,',
    test: T,
    why: '거래성 메일 제목에 (광고)가 붙어 주문·승인 안내가 광고로 읽힌다.',
  },
]
