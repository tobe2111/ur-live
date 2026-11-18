/** 🖱️ 2026-11-18 대표 "오른쪽 마우스 금지" — 가드: src/tests/unit/content-protection.test.ts */
const TEST = 'src/tests/unit/content-protection.test.ts'
const FILE = 'src/lib/image-protect.ts'
export default [
  {
    name: '[copy-deterrent] 입력 칸에서도 우클릭을 막는다',
    file: FILE,
    find: '    if (isEditable(el)) return false\n    el = el.parentElement\n  }\n  return true\n',
    replace: '    el = el.parentElement\n  }\n  return true\n',
    test: TEST,
    why: '주소·쿠폰코드 입력 칸에서 붙여넣기 메뉴가 사라진다.',
  },
  {
    name: '[copy-deterrent] 대시보드에서도 우클릭을 막는다',
    file: FILE,
    find: 'export function shouldBlockContextMenu(pathname: string, target: Element | null): boolean {\n  if (isExemptPath(pathname)) return false\n',
    replace: 'export function shouldBlockContextMenu(pathname: string, target: Element | null): boolean {\n',
    test: TEST,
    why: '운영자가 상품 사진을 저장·교체하지 못한다.',
  },
  {
    name: '[copy-deterrent] 우클릭 차단이 빠진다',
    file: FILE,
    find: '      if (!shouldBlockContextMenu(location.pathname, e.target as Element)) return\n      e.preventDefault()\n',
    replace: '      if (!shouldBlockContextMenu(location.pathname, e.target as Element)) return\n',
    test: TEST,
    why: '대표가 지시한 우클릭 금지가 조용히 사라진다.',
  },
  {
    name: '[copy-deterrent] 복사(Ctrl+C)까지 막는다',
    file: FILE,
    find: "  if (!e.shiftKey && !e.altKey && (k === 'u' || k === 's')) return true\n",
    replace: "  if (!e.shiftKey && !e.altKey && (k === 'u' || k === 's' || k === 'c')) return true\n",
    test: TEST,
    why: '손님이 매장 주소·전화번호를 복사하지 못한다.',
  },
  {
    name: '[copy-deterrent] 소스 보기 단축키가 열린다',
    file: FILE,
    find: "  if (!e.shiftKey && !e.altKey && (k === 'u' || k === 's')) return true\n",
    replace: "  if (!e.shiftKey && !e.altKey && (k === 's')) return true\n",
    test: TEST,
    why: 'Ctrl+U 로 소스가 바로 열린다.',
  },
  {
    name: '[copy-deterrent] 단축키 차단이 대시보드까지 건다',
    file: FILE,
    find: "    (e) => {\n      if (isExemptPath(location.pathname)) return\n      if (!isBlockedShortcut(e)) return\n",
    replace: "    (e) => {\n      if (!isBlockedShortcut(e)) return\n",
    test: TEST,
    why: '운영자·개발자가 대시보드에서 개발자도구를 못 연다.',
  },
]
