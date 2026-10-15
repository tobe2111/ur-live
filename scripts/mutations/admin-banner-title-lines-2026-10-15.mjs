const T = 'src/tests/unit/admin-banner-title-lines-2026-10-15.test.ts'
export default [
  {
    name: '어드민 배너 제목 칸이 다시 한 줄 input 이 된다 (2026-10-15)',
    file: 'src/pages/AdminBannersPage.tsx',
    find: '<textarea rows={2} value={formData.title}',
    replace: '<input type="text" value={formData.title}',
    test: T,
    why: 'Enter 를 칠 수 없어 대표가 배너 줄 띄어쓰기를 어드민에서 정할 수 없다',
  },
  {
    name: '배너 제목 세 번째 줄이 그대로 남아 화면에서 잘린다 (2026-10-15)',
    file: 'src/shared/banner-title.ts',
    find: '  if (lines.length <= BANNER_TITLE_MAX_LINES) return lines.join',
    replace: '  if (true) return lines.join',
    test: T,
    why: '배너는 line-clamp-2 라 세 번째 줄 글자가 조용히 사라진다',
  },
]
