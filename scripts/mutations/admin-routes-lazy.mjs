/** ⚡ 어드민 라우트 표를 어드민 경로에서만 (2026-10-12) — 가드: src/tests/unit/admin-routes-lazy-2026-10-12.test.tsx */
const TEST = 'src/tests/unit/admin-routes-lazy-2026-10-12.test.tsx'
export default [
  {
    name: '⚡ 하위 Routes 가 /admin 접두를 안 뗀다(어드민 전부 404)',
    file: 'src/routes/admin.routes.tsx',
    find: "out.push(cloneElement(r as ReactElement<{ path: string }>, { path: path.slice('/admin'.length) || '/', key: path }))",
    replace: 'out.push(r)',
    test: TEST,
    why: '하위 Routes 는 남은 경로로 맞춘다 — 절대 경로 그대로면 어드민 화면이 하나도 안 뜬다.',
  },
  {
    name: '⚡ 어드민 표가 다시 소비자 라우트 봉투로',
    file: 'vite.config.ts',
    find: "          if (id.includes('/src/routes/admin.routes')) return 'app-routes-admin'\n",
    replace: '',
    test: TEST,
    why: 'app-routes 가 첫 부팅 청크라 모든 첫 방문이 어드민 표 33KB 를 다시 받는다.',
  },
  {
    name: '⚡ 표에 없는 어드민 경로가 빈 화면',
    file: 'src/routes/admin.routes.tsx',
    find: '      <Route path="*" element={<AdminNotFoundPage />} />\n',
    replace: '',
    test: TEST,
    why: '하위 Routes 에 맞는 게 없으면 아무것도 안 그린다 — 404 안내가 사라진다.',
  },
]
