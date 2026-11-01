/**
 * 🧬 주입 — 유어샵 SNS 칸은 그 플랫폼 주소·아이디만 (2026-10-26 대표)
 *    가드: src/tests/unit/ushop-sns-link-guard-2026-10-26.test.ts
 */
const T = 'src/tests/unit/ushop-sns-link-guard-2026-10-26.test.ts'
const L = 'src/shared/sns-link.ts'
export default [
  {
    name: '유어샵SNS — 호스트 검사를 없앤다(아무 사이트나 인스타그램 이름표)',
    file: L,
    find: "  if (!SNS_HOSTS[platform].some((h) => host === h || host.endsWith(`.${h}`))) return { kind: 'bad' }\n",
    replace: '',
    test: T,
    why: '인스타그램 칸에 도박·피싱 주소를 넣으면 이름표를 누른 손님이 그 사이트로 간다.',
  },
  {
    name: '유어샵SNS — 꼬리 위장을 통과시킨다(endsWith 점 없이)',
    file: L,
    find: 'host.endsWith(`.${h}`)',
    replace: 'host.endsWith(h)',
    test: T,
    why: '`evilinstagram.com` 이 인스타그램으로 통과한다.',
  },
  {
    name: '유어샵SNS — 서버가 옛 "https 면 통과" 로 돌아간다',
    file: 'src/worker/routes/curator.routes.ts',
    find: "if (v && snsLinkStatus(platform, v).kind !== 'ok')",
    replace: "if (v && !/^https?:\\/\\//i.test(v) && snsLinkStatus(platform, v).kind !== 'ok')",
    test: T,
    why: '화면은 막아도 API 를 직접 부르면 아무 주소나 저장된다.',
  },
]
