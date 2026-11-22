/** 되돌려-검증 주입 — 앱 뜨기 전 누른 것 대신 눌러 주기 (2026-11-22). 가드: early-tap-replay-2026-11-22.test.ts */
const T = 'src/tests/unit/early-tap-replay-2026-11-22.test.ts'
const B = 'src/lib/boot-first-screen.ts'
export default [
  { name: 'earlytap: 부팅 스크립트가 자리를 안 적는다', file: 'src/worker/utils/css-first-boot.ts',
    find: "window.__urTap={x:e.clientX,y:e.clientY,t:Date.now(),sy:window.scrollY}", replace: "void 0", test: T, why: '앱 뜨기 전 누른 것이 다시 사라진다.' },
  { name: 'earlytap: 링크 클릭도 적는다', file: 'src/worker/utils/css-first-boot.ts',
    find: "&&!t.closest('a'))window.__urTap", replace: ")window.__urTap", test: T, why: '이미 이동한 링크를 한 번 더 누른다.' },
  { name: 'earlytap: 오래된 누름도 실행', file: B,
    find: "now - tap.t > EARLY_TAP_MAX_AGE_MS || ", replace: "", test: T, why: '한참 전에 누른 것이 뒤늦게 튀어나온다.' },
  { name: 'earlytap: 화면을 내렸어도 실행', file: B,
    find: " || Math.abs(window.scrollY - tap.sy) > 4", replace: "", test: T, why: '다른 자리의 버튼을 누른다.' },
  { name: 'earlytap: 두 번 실행', file: B,
    find: "    w.__urTap = null\n", replace: "", test: T, why: '크게 보기가 두 번 열리거나 닫힌다.' },
  { name: 'earlytap: 버튼 아닌 것도 누른다', file: B,
    find: "?.closest?.('button,[role=\"button\"]') as HTMLElement | null", replace: " as HTMLElement | null", test: T, why: '글자·빈 곳을 눌러 엉뚱한 동작이 난다.' },
  { name: 'earlytap: 폴백이 도로 붙인 동안에도 실행', file: B,
    find: "      if (node.isConnected) return\n", replace: "", test: T, why: '교체 전에 서버 화면의 죽은 버튼을 누르고 기록을 지운다.' },
]
