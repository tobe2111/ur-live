/**
 * 🔀 AI 검색·인용 크롤러 분리 (2026-10-11) — 주입 매니페스트.
 *
 * 가드: src/tests/unit/content-protection.test.ts
 * 지키는 불변식은 **비대칭**이다 — robots 는 페이지를 허용, 헤더는 API 를 차단.
 * 한쪽만 보면 둘 다 "맞춰 주고" 싶어지므로 양방향으로 심는다.
 */
const TEST = 'src/tests/unit/content-protection.test.ts'

export default [
  {
    name: '🔀 AI 검색 크롤러를 robots 가 다시 막는다 (인용 유입을 스스로 끊는다)',
    file: 'public/robots.txt',
    find: 'User-agent: GPTBot\n',
    replace: 'User-agent: GPTBot\nUser-agent: OAI-SearchBot\n',
    test: TEST,
    why: 'OAI-SearchBot 은 robots 를 지킨다 — 막으면 ChatGPT 답변에서 우리가 사라진다. 그런데 화면도 빌드도 안 깨진다.',
  },
  {
    name: '🔀 Perplexity 도 robots 차단으로 되돌아간다',
    file: 'public/robots.txt',
    find: 'User-agent: ClaudeBot\n',
    replace: 'User-agent: ClaudeBot\nUser-agent: PerplexityBot\nUser-agent: Perplexity-User\n',
    test: TEST,
    why: '2026-08-22 에 한 덩어리로 막혔던 그 상태로 조용히 복귀하는 경로.',
  },
  {
    name: '🔀 "robots 와 목록을 맞춘다" 며 검색 봇을 헤더 차단에서 뺀다 (가격표 API 가 열린다)',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /OAI-SearchBot/i,\n',
    replace: '',
    test: TEST,
    why: '비대칭이 의도임을 모르면 정확히 이 방향으로 "정리" 하게 된다 — 공개 JSON 벌크 수확이 풀린다.',
  },
  {
    name: '🔀 Claude-SearchBot 이 헤더 차단에서 빠진다',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /Claude-SearchBot/i,\n',
    replace: '',
    test: TEST,
    why: '다섯 중 하나만 새도 그 봇으로 API 를 긁을 수 있다.',
  },
  {
    name: '🔀 학습 크롤러까지 robots 차단에서 빠진다 (분리가 전면 해제로 번짐)',
    file: 'public/robots.txt',
    find: 'User-agent: GPTBot\n',
    replace: '',
    test: TEST,
    why: '"AI 봇을 허용했다" 로 뭉개면 학습 데이터셋 수확까지 열린다 — 대표가 막으라고 한 쪽이다.',
  },
  {
    name: '🔀 `*` 그룹이 어드민을 안 막는다 (검색 봇 폴백이 비공개로 샌다)',
    file: 'public/robots.txt',
    find: 'Disallow: /admin\n',
    replace: '',
    test: TEST,
    why: '다섯을 `*` 로 떨어뜨린 처방의 안전성이 전부 그 그룹의 Disallow 에 달려 있다.',
  },
]
