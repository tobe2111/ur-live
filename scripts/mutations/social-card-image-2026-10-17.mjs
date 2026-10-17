/**
 * 🖼️ 소셜 카드 이미지(2026-10-17) — 주입 매니페스트.
 * 가드: src/tests/unit/social-card-image-2026-10-17.test.ts
 */
const TEST = 'src/tests/unit/social-card-image-2026-10-17.test.ts'

export default [
  {
    name: '🖼️ 카드가 초안 글자를 탈출하지 않는다',
    file: 'src/features/social-media/api/social-image-card.ts',
    find: '<h1>${escHtml(head)}</h1>',
    replace: '<h1>${head}</h1>',
    test: TEST,
    why: 'LLM 이 쓴 제목이 마크업이 되어 카드가 깨지거나 외부 자원을 끌어온다.',
  },
  {
    name: '🖼️ 빈 렌더 결과를 그대로 붙인다',
    file: 'src/features/social-media/api/social-image-render.ts',
    find: 'if (!bytes || bytes.byteLength < 1000)',
    replace: 'if (!bytes)',
    test: TEST,
    why: '빈 그림이 인스타 게시물로 나간다.',
  },
  {
    name: '🖼️ 발행된 게시물의 이미지를 바꾼다',
    file: 'src/features/social-media/api/social-image-render.ts',
    find: "if (post.status === 'published') return { ok: false, error: '이미 발행된 게시물입니다' }",
    replace: '',
    test: TEST,
    why: '이미 나간 게시물과 어드민 기록의 그림이 달라진다.',
  },
  {
    name: '🖼️ 크론이 인스타 초안에 카드를 안 붙인다',
    file: 'src/worker/cron/social-draft.ts',
    find: "if (platform === 'instagram') {",
    replace: "if (false) {",
    test: TEST,
    why: '인스타 초안이 다시 이미지 없이 쌓여 게시가 막힌다.',
  },
  {
    name: '🖼️ 카드 키를 고아 정리가 보는 uploads/ 접두에 둔다',
    file: 'src/features/social-media/api/social-image-render.ts',
    find: 'return `social/card-${postId}-${now}.jpg`',
    replace: 'return `uploads/card-${postId}-${now}.jpg`',
    test: TEST,
    why: 'R2 고아 정리 크론이 DB 참조 없는 카드로 보고 지운다.',
  },
  {
    name: '🖼️ 유달이를 원본보다 크게 그린다',
    file: 'src/features/social-media/api/social-image-card.ts',
    find: 'export const MASCOT_DRAW_H = 470',
    replace: 'export const MASCOT_DRAW_H = 620',
    test: TEST,
    why: '480px 원본을 키우면 털과 수염이 뭉개져 카드가 싸 보인다(1차 카드의 실패).',
  },
  {
    name: '🖼️ 하단 조각을 다시 기울인다',
    file: 'src/features/social-media/api/social-image-card.ts',
    find: '.prop{background:${P.white};',
    replace: '.prop{transform:rotate(-3deg);background:${P.white};',
    test: TEST,
    why: '기울인 티켓은 템플릿 장식으로 읽힌다.',
  },
  {
    name: '🖼️ 한글 제목이 글자 중간에서 끊긴다',
    file: 'src/features/social-media/api/social-image-card.ts',
    find: 'letter-spacing:-0.032em;word-break:keep-all;',
    replace: 'letter-spacing:-0.032em;',
    test: TEST,
    why: '"이용권" 이 "이용 / 권" 으로 갈린다.',
  },
]
