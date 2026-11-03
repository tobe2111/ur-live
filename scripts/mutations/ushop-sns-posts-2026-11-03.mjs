/** 🧬 주입 — 유어샵 SNS 최근 게시물(2026-11-03). 가드: src/tests/unit/ushop-sns-posts-2026-11-03.test.ts */
const TEST = 'src/tests/unit/ushop-sns-posts-2026-11-03.test.ts'
const F = 'src/worker/routes/curator/sns-posts.routes.ts'
export default [
  {
    name: '🖼️ SNS 게시물 — 같은 계정 판정을 뺀다(남의 게시물이 뜬다)',
    file: F,
    find: "const usable = (links ?? []).filter((l) => sameSnsAccount(l.platform === 'instagram' ? user.instagram_url : user.youtube_url, l.username))",
    replace: 'const usable = links ?? []',
    test: TEST,
    why: '이름표 주소와 다른 계정의 게시물이 이 유어샵에 뜬다.',
  },
  {
    name: '🖼️ SNS 게시물 — 캐시를 안 보고 방문마다 외부를 부른다',
    file: F,
    find: 'if (cached && now - Number(cached.fetched_at) < FRESH_MS) {',
    replace: 'if (false) {',
    test: TEST,
    why: '공개 엔드포인트라 방문마다 인스타·유튜브를 두드리면 한도·차단에 걸린다.',
  },
  {
    name: '🖼️ SNS 게시물 — https 검사를 뺀다',
    file: F,
    find: "const okHttps = (u: unknown): string | null => (typeof u === 'string' && /^https:\\/\\//.test(u) ? u : null)",
    replace: "const okHttps = (u: unknown): string | null => (typeof u === 'string' ? u : null)",
    test: TEST,
    why: '`javascript:` 같은 주소가 링크로 들어간다.',
  },
  {
    name: '🖼️ SNS 게시물 — 실패하면 캐시를 안 남긴다(실패할 때마다 다시 두드림)',
    file: F,
    find: '      ).bind(user.id, l.platform, JSON.stringify(got), now).run().catch(() => {})',
    replace: '      ).bind(user.id, l.platform, JSON.stringify(got), now); if (got.length) await DB.prepare("INSERT INTO user_sns_recent_posts x").bind(user.id, l.platform, JSON.stringify(got), now).run().catch(() => {})',
    test: TEST,
    why: '토큰이 만료된 사람의 유어샵은 방문마다 외부 호출이 실패하며 쌓인다.',
  },
  {
    name: '🖼️ SNS 게시물 — 첫 화면에서 바로 받는다(유어샵 첫 화면 파일 수 +1)',
    file: 'src/pages/CuratorPage.tsx',
    find: '<NearViewport>{() => <Suspense fallback={null}><UShopSnsPosts handle={curator.handle} /></Suspense>}</NearViewport>',
    replace: '<Suspense fallback={null}><UShopSnsPosts handle={curator.handle} /></Suspense>',
    test: TEST,
    why: '진열 아래 부품의 코드를 첫 화면에서 받으면 유어샵이 느려진다(surface-chunk-runtime 이 CI 에서 잡은 그대로).',
  },
]
