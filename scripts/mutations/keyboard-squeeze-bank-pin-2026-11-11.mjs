/**
 * 🧬 주입 — 키보드 압박 · 등록 계좌 PIN (2026-11-11)
 *    가드: src/tests/unit/keyboard-squeeze-and-bank-pin-2026-11-11.test.ts
 *    대표: "검색창 때문에 화면이 제대로 안보이는 문제 해결해줘" · "이 에러는 뭐지?"(계좌 변경은 PIN 인증이 필요합니다)
 */
const T = 'src/tests/unit/keyboard-squeeze-and-bank-pin-2026-11-11.test.ts'
export default [
  {
    name: '입력 중에도 장식을 안 접는다',
    file: 'src/index.css',
    find: '  .ur-kb-scope:has(input:focus, textarea:focus) .ur-kb-hide { display: none; }\n',
    replace: '',
    test: T,
    why: '키보드가 열리면 가게 검색 결과가 한 줄도 안 보인다(대표 신고 화면).',
  },
  {
    name: '등록 계좌가 PIN 요구에서 멈춘다',
    file: 'src/pages/store-new/StoreBankPage.tsx',
    find: '        setPinFor(seat)\n        return\n',
    replace: '',
    test: T,
    why: '새 사장님이 "계좌 변경은 PIN 인증이 필요합니다" 토스트만 보고 판매 준비를 못 끝낸다.',
  },
]
