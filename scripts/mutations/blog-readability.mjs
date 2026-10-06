/**
 * 📝 블로그 커버·가독성 — 주입 매니페스트 (2026-09-24 등록).
 * 가드: src/tests/unit/blog-readability-2026-09-24.test.ts
 *
 * 이 자리의 고약함: 폴백 커버는 **썸네일이 비어 있을 때만** 보인다. 발행 글 5개가 전부 비어
 * 있어서 사실상 목록 전체를 덮고 있었는데, 그게 이모지+그라디언트라 디자인 SSOT 를 정면으로
 * 어기고도 몇 달간 아무도 못 봤다(가드의 이모지 탐지가 `[/re/, '✨']` 배열 모양을 못 읽는다).
 */
export default [
  {
    name: '블로그 커버에 이모지 스티커를 되살린다',
    file: 'src/features/blog/BlogCover.tsx',
    find: "<Icon size={big ? 88 : 40} aria-hidden />",
    replace: "<span>✨</span>",
    test: 'src/tests/unit/blog-readability-2026-09-24.test.ts',
    why:
      '코레일톡 디자인 SSOT 표면 규칙 ⑥ 는 **이모지 0**이다. 게다가 이 폴백은 썸네일이 빈 동안 ' +
      '목록 전체를 덮으므로, 한 곳이 아니라 블로그 전체의 인상이 된다.',
  },
  {
    name: '블로그 커버를 그라디언트로 되돌린다',
    file: 'src/features/blog/BlogCover.tsx',
    find: "className={`${className} relative overflow-hidden flex items-center justify-center`}",
    replace: "className={`${className} relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-rose-100 to-orange-100`}",
    test: 'src/tests/unit/blog-readability-2026-09-24.test.ts',
    why: '같은 SSOT 의 "그라디언트 0". 단색 면 + 아이콘이 우리 표면 문법이다.',
  },
  {
    name: '사진이 있어도 폴백 커버를 그린다',
    file: 'src/features/blog/BlogCover.tsx',
    find: 'if (post.thumbnail_url) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/blog-readability-2026-09-24.test.ts',
    why:
      '폴백은 **사진의 대체재가 아니라 빈자리**다. 어드민에서 사진을 넣었는데도 아이콘 면이 ' +
      '계속 보이면 대표 지적("사진 필요함")이 영원히 안 풀린다.',
  },
  {
    name: '본문 글자를 15px 로 되돌린다',
    file: 'src/features/blog/BlogMarkdown.tsx',
    find: "return <p key={i} className=\"text-[16.5px] text-gray-700 dark:text-gray-200 leading-[1.85] my-3\">",
    replace: "return <p key={i} className=\"text-[15px] text-gray-700 dark:text-gray-200 leading-[1.8] my-3\">",
    test: 'src/tests/unit/blog-readability-2026-09-24.test.ts',
    why:
      '3열 레이아웃에서 본문 칸이 760px 라 15px 한글이면 한 줄 95자다(편한 길이 40~50자). ' +
      '대표가 말한 "너무 가독성이 떨어진다"의 절반이 이것이다.',
  },
  {
    name: '본문 폭 제한을 푼다(글자만 키운 반쪽이 된다)',
    file: 'src/pages/BlogDetailPage.tsx',
    find: '<div className="max-w-[46rem]">',
    replace: '<div>',
    test: 'src/tests/unit/blog-readability-2026-09-24.test.ts',
    why:
      '글자 크기와 폭은 **짝**이다. 폭을 안 묶으면 한 줄이 여전히 길어 키운 효과가 상쇄된다 — ' +
      '가드가 둘을 함께 보는 이유.',
  },
]
