/**
 * 🤖 2026-11-03 — 카카오 CS 봇 AI 의도 분류 + FAQ 메뉴 이름의 주입.
 * 가드: `src/tests/unit/cs-bot-ai-2026-11-03.test.ts`
 */
const C = 'src/worker/utils/cs-ai-classify.ts'
const H = 'src/worker/routes/kakao-skill-webhook.routes.ts'
const F = 'src/features/cs/api/cs-faq.ts'
const T = 'src/tests/unit/cs-bot-ai-2026-11-03.test.ts'

export default [
  {
    name: '🤖 CS AI — 허용 목록 밖의 출력도 받는다',
    file: C,
    find: 'return allowed.includes(t) ? t : null',
    replace: 'return t || null',
    test: T,
    why: '손님 말 속 주입이나 모델의 잡문이 id 자리에 들어온다 — FAQ 원문만 나간다는 전제가 깨진다.',
  },
  {
    name: '🤖 CS AI — 게이트가 키 하나만 본다',
    file: C,
    find: "return env?.KAKAO_BOT_AI_ENABLED === 'true' && !!env?.ANTHROPIC_API_KEY",
    replace: 'return !!env?.ANTHROPIC_API_KEY',
    test: T,
    why: '블로그용 키가 이미 있으면 대표가 켜지 않았는데도 봇이 AI 를 부른다(비용·라이브 접촉).',
  },
  {
    name: '🤖 CS AI — 웹훅이 분류기를 안 부른다',
    file: H,
    find: 'if (hit) return c.json(await done(skillResponse(hit.answer)))',
    replace: '',
    test: T,
    why: '켜도 아무 일도 안 일어난다 — 손님은 계속 폴백만 받는다.',
  },
  {
    name: '🤖 CS AI — 키워드로 답한 말에도 AI 를 부른다',
    file: H,
    find: '    if (matched) return c.json(skillResponse(matched.answer))\n',
    replace: '',
    test: T,
    why: '모든 말에 AI 호출 — 비용과 지연이 늘고 키워드 답이 AI 판단에 밀린다.',
  },
  {
    name: '🤖 CS FAQ — 화면에 없는 메뉴 이름으로 안내한다',
    file: F,
    find: "'2) 하단 [마이] → [이용권]에서 구매한 이용권 선택\\n' +",
    replace: "'2) 하단 [마이] → [내 지갑]에서 구매한 이용권 선택\\n' +",
    test: T,
    why: '손님이 없는 메뉴를 찾아 헤맨다(2026-11-03 실제로 그랬다).',
  },
]
