/**
 * 📄 중개 매장 등록 서류 = 매장 등록증 (2026-10-10 대표 결재 안 1)
 * 가드: src/tests/unit/broker-business-cert-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/broker-business-cert-2026-10-10.test.ts'
const FILE = 'src/components/seller/StoreRegisterModal.tsx'

export default [
  {
    name: '📄 중개 매장 등록 제목이 다시 정적 STEPS 를 그린다(중개사가 자기 등록증을 올린다)',
    file: FILE,
    find: '{stepCopy(step, channel).title}',
    replace: '{STEPS[step].title}',
    test: TEST,
    why: '운영 방식과 무관한 같은 문구면 중개사는 자기 등록증을 올리고, 매장 기준 심사와 서류가 갈린다.',
  },
  {
    name: '📄 중개 분기 조건이 사라진다(중개 문구가 영영 안 뜬다)',
    file: FILE,
    find: "STEPS[step].key === 'business' && channel === 'brokered'",
    replace: "STEPS[step].key === 'business' && channel === 'never'",
    test: TEST,
    why: '문구 상수는 남아 있어도 조건이 깨지면 화면에 안 뜬다 — 상수 존재만 보는 시험은 헛돈다.',
  },
]
