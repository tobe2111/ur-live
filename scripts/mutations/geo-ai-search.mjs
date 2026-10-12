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
  // ── 🔀 2026-10-12: 형제 비대칭 셋 + 재조준한 '검색엔진 금지' 가드 ──
  {
    name: '🔀 MistralAI-User 가 수확 목록에서 빠진다 (형제는 403 인데 이것만 열린다)',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /MistralAI-User/i,',
    replace: '',
    test: 'src/tests/unit/content-protection.test.ts',
    why:
      '라이브 실측에서 바로 이 상태였다 — `ChatGPT-User`·`Perplexity-User` 는 403 인데 ' +
      '`MistralAI-User` 만 API 200. 같은 종류인데 목록에 없으면 가격표가 그쪽으로만 열린다.',
  },
  {
    name: '🔀 YouBot 이 수확 목록에서 빠진다',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /YouBot/i,',
    replace: '',
    test: 'src/tests/unit/content-protection.test.ts',
    why: '`OAI-SearchBot` 과 같은 AI 답변용 색인인데 혼자 열려 있던 자리다.',
  },
  {
    name: '🔀 수확 가드를 HTML 라우트에도 붙인다 (AI 검색봇이 페이지를 못 받는다)',
    file: 'src/worker/index.ts',
    find: "app.use('/api/sections', contentScrapeGuard);",
    replace: "app.use('/api/sections', contentScrapeGuard);\napp.use('/pass/*', contentScrapeGuard);",
    test: 'src/tests/unit/content-protection.test.ts',
    why:
      '비대칭의 전제는 "HTML 은 준다" 다. HTML 경로에 한 줄이라도 붙으면 ChatGPT·Perplexity 가 ' +
      '페이지를 못 받아 **인용 유입이 통째로** 끊기는데, 사람 브라우저는 멀쩡해서 아무도 모른다.',
  },
  {
    name: '🔀 Googlebot 을 수확 목록에 넣는다 (재조준한 가드가 여전히 잡는가)',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /GPTBot/i,',
    replace: '  /GPTBot/i,\n  /Googlebot/i,',
    test: 'src/tests/unit/content-protection.test.ts',
    why:
      '그 가드를 원문 검사 → 주석 제거본으로 재조준했다(설명 주석이 거짓 빨간불을 냈다). ' +
      '**느슨해진 게 아님**을 이 주입이 증명한다 — 실제로 넣으면 색인이 막히고 가드가 잡는다.',
  },
  {
    name: '🔀 LEGIT 의 /Applebot/i 를 좁혀 Applebot-Extended 를 "살린다"',
    file: 'src/worker/middleware/bot-detection.ts',
    find: '  /Applebot/i,',
    replace: '  /Applebot-Extended-only-never-matches/i,',
    test: 'src/tests/unit/content-protection.test.ts',
    why:
      '수확 목록의 `Applebot-Extended` 가 도달하지 않는 것을 보고 "고치려는" 유혹. 애플은 그 토큰을 ' +
      'robots 전용으로 쓰고 UA 는 늘 `Applebot` 이라 얻는 것은 0 이고, **애플 검색 색인(Siri·Spotlight)이 ' +
      '통째로 막힌다.**',
  },
  {
    name: '🔀 Google-Extended 가 robots 차단으로 되살아난다 (제미나이 인용이 끊긴다)',
    file: 'public/robots.txt',
    find: 'User-agent: Applebot-Extended',
    replace: 'User-agent: Google-Extended\nDisallow: /\n\nUser-agent: Applebot-Extended',
    test: 'src/tests/unit/content-protection.test.ts',
    why:
      '2026-10-12 대표 승인으로 **일부러 뺀** 줄이다. 구글은 그 토큰이 학습과 그라운딩을 한 덩어리로 ' +
      '묶어서, 막는 동안 제미나이가 우리를 근거로 쓸 수 없었다. "AI 학습은 다 막자" 며 되돌리기 쉽다.',
  },
]
