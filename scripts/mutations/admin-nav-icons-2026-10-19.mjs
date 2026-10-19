// 🪶 2026-10-19 — 어드민 메뉴가 손님 화면 봉투의 아이콘을 다시 쓰는 방향.
const T = 'src/tests/unit/admin-nav-icons-2026-10-19.test.ts'
export default [
  {
    name: '[admin-nav-icons] 메뉴가 Wrench 를 다시 쓴다',
    file: 'src/components/admin/admin-nav-config.ts',
    find: "label: '환경 준비상태', icon: Gauge",
    replace: "label: '환경 준비상태', icon: Wrench",
    test: T,
    why: '어드민 첫 화면이 교환권 봉투와 그 연쇄(홈·쇼핑·유어샵)를 다시 받는다 — 에러 0.',
  },
  {
    name: '[admin-nav-icons] import 에 MapPin 이 되살아난다',
    file: 'src/components/admin/admin-nav-config.ts',
    find: '  RotateCcw, Upload, Scale,',
    replace: '  RotateCcw, Upload, MapPin, Scale,',
    test: T,
    why: 'import 만 남아도 묶음기는 그 봉투를 첫 화면에 넣는다.',
  },
  {
    name: '[admin-nav-icons] 대시보드 홈이 Play 를 다시 import 한다',
    file: 'src/pages/AdminPage.tsx',
    find: '  Users, Package, TrendingUp, CheckCircle,',
    replace: '  Users, Play, Package, TrendingUp, CheckCircle,',
    test: T,
    why: '쓰지도 않는 Play 한 줄이 쇼츠 봉투를 끈다.',
  },
  {
    name: '[admin-nav-icons] 메뉴 항목을 지워서 통과시킨다',
    file: 'src/components/admin/admin-nav-config.ts',
    find: "{ path: '/admin/login-history',",
    replace: "{ path: '/admin/login-historyX',",
    test: T,
    why: '아이콘을 고치는 대신 메뉴를 지우는 쪽은 기능을 잃는다.',
  },
]
