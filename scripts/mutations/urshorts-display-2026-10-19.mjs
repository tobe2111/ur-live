/**
 * 🎬 유어쇼츠 보여 주는 규칙 (2026-10-19) — 제목 정리 · 같은 이용권 떨어뜨리기 · 유튜브 제목 줄 잘라 내기 · 넘김 안내.
 * 가드: src/tests/unit/urshorts-display-2026-10-19.test.ts
 */
const TEST = 'src/tests/unit/urshorts-display-2026-10-19.test.ts'
const D = 'src/shared/urshorts-display.ts'
const V = 'src/pages/VideosPage.tsx'

export default [
  {
    name: '🎬 제목 정리가 해시태그를 안 뗀다',
    file: D,
    find: "    .replace(HASHTAG, ' ')\n",
    replace: '',
    test: TEST,
    why: '전체 보기 카드가 다시 #서면맛집 #부산맛집 꼬리표로 세 줄을 먹는다.',
  },
  {
    name: '🎬 같은 이용권 영상 떨어뜨리기를 끈다 (항상 맨 앞 후보)',
    file: D,
    find: 'let at = pending.findIndex((x) => x.product_id == null || !recent.has(x.product_id))',
    replace: 'let at = 0',
    test: TEST,
    why: '라이옥 두 편이 2열 그리드 한 줄에 다시 나란히 서고, 뷰어에서 넘겨도 같은 가게가 또 나온다.',
  },
  {
    name: '🎬 공개 API 가 떨어뜨린 순서를 안 쓴다',
    file: 'src/features/urshorts/api/urshorts.routes.ts',
    find: 'data: spreadSameProduct((results ?? []) as Array<{ product_id?: number | null }>)',
    replace: 'data: results ?? []',
    test: TEST,
    why: '함수가 있어도 응답이 안 지나가면 레일·전체 보기·뷰어 어디에도 효과가 없다(에러 0).',
  },
  {
    name: '🎬 재생기를 위로 안 늘린다 (유튜브 제목 줄이 다시 보인다)',
    file: V,
    find: '          style={{ top: -YT_TITLE_CLIP_PX }}\n',
    replace: '',
    test: TEST,
    why: '뷰어 맨 위에 남의 채널 로고와 끝이 잘린 원제목이 다시 뜬다 — 대표가 스크린샷으로 지적한 그 줄이다.',
  },
  {
    name: '🎬 넘김 안내가 매번 뜬다 (본 적 있음을 안 본다)',
    file: 'src/pages/videos/SwipeHint.tsx',
    find: "try { return localStorage.getItem(SEEN_KEY) !== '1' } catch { return true }",
    replace: 'return true',
    test: TEST,
    why: '한 번이면 안내지만 매번이면 소음이다 — 2026-09-08 "번잡해" 로 걷어 낸 화면에 다시 상시 표시가 생긴다.',
  },
]
