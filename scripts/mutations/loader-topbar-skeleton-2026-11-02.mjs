/**
 * ⏳ 로딩 화면 = 위쪽 얇은 막대 + 화면 모양 (2026-11-02 대표 확정)
 * 가드: src/tests/unit/loader-topbar-skeleton-2026-11-02.test.ts · scripts/check-loader-continuity.mjs
 */
const TEST = 'src/tests/unit/loader-topbar-skeleton-2026-11-02.test.ts'

export default [
  {
    name: '⏳ 앱 로더가 서버 로더와 다른 글자를 그린다 (교체 순간 튐)',
    file: 'src/components/brand/BrandLoader.tsx',
    find: 'dangerouslySetInnerHTML={{ __html: brandLoaderMarkup(4, shy) }}',
    replace: 'dangerouslySetInnerHTML={{ __html: brandLoaderMarkup(2, shy) }}',
    test: TEST,
    why: '서버가 첫 화면 아래 붙인 로더와 줄 수가 다르면 앱이 이어받는 순간 아래가 출렁인다("로딩 화면 2~3개").',
  },
  {
    name: '⏳ 위쪽 막대가 끝없이 되풀이된다 (기다리는 느낌 재발)',
    file: 'src/shared/brand-loader-markup.ts',
    find: 'cubic-bezier(.08,.8,.2,1) forwards',
    replace: 'cubic-bezier(.08,.8,.2,1) infinite',
    test: TEST,
    why: '되풀이되는 움직임은 끝이 안 보여서 "멈췄다 → 기다린다" 로 읽힌다 — 대표가 바꾼 이유 그 자체.',
  },
  {
    name: '⏳ 로더에 손으로 박은 색 (다크에서 흰 상자)',
    file: 'src/shared/brand-loader-markup.ts',
    find: 'background:var(--rule);border-radius:8px',
    replace: 'background:#EDEFF3;border-radius:8px',
    test: TEST,
    why: '토큰이 아니면 다크 모드에서 화면 모양이 밝은 상자로 뜬다.',
  },
  {
    name: '⏳ 첫 HTML 로더가 SSOT 와 갈린다',
    file: 'index.html',
    find: '<div class="ur-ldr-top" aria-hidden="true"><i></i></div>',
    replace: '<div class="ur-ldr-top" aria-hidden="true"></div>',
    test: TEST,
    why: '세 곳 중 하나만 달라도 교체 순간 막대가 사라졌다 다시 생긴다.',
  },
]
