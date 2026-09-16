/**
 * 🔍 서류 OCR 대조 (2026-09-16, 결재 `2026-09-16-ocr-license-automation.md`) — 주입 매니페스트.
 *
 * 가드: src/tests/unit/document-verify-2026-09-16.test.ts
 *       src/tests/unit/korean-address-2026-09-16.test.ts
 *
 * 여기서 지키는 것은 **결재가 못 박은 안전 레일 둘**이다 —
 * ① 자동 승인은 게이트 뒤 · ② 자동 반려는 하지 않는다.
 * 둘 다 "깨져도 에러가 안 나는" 종류라, 깨뜨려 보지 않으면 가드가 헛도는지 알 수 없다.
 */
const DOC = 'src/tests/unit/document-verify-2026-09-16.test.ts'
const ADDR = 'src/tests/unit/korean-address-2026-09-16.test.ts'

export default [
  {
    name: '🔍 셀러 OCR 라우트의 자동 승인이 게이트 밖으로 나온다 (2026-09-16 이전 상태)',
    file: 'src/features/seller/api/seller-profile.routes.ts',
    find: '    const willAutoVerify = autoVerifyOn && cmp.autoVerified;',
    replace: '    const willAutoVerify = cmp.autoVerified;',
    test: DOC,
    why: '이 한 줄이 2026-05-27~2026-09-16 의 실제 상태였다. AI 바인딩이 켜지는 순간 승인이 게이트 없이 자동으로 나간다 — 에러도 안 나고 아무도 모른다.',
  },
  {
    name: '🔍 못 읽은 서류가 mismatch 로 올라간다 (자동 반려의 씨앗)',
    file: 'src/worker/utils/document-verify.ts',
    find: "  if (!ocr.ok || (!ocr.bizName && !ocr.address)) verdict = 'unreadable'",
    replace: "  if (!ocr.ok || (!ocr.bizName && !ocr.address)) verdict = 'mismatch'",
    test: DOC,
    why: 'OCR 실패를 "의심스럽다" 로 바꾸면 사진이 흐린 정상 사장님이 반려된다 — 틀린 반려는 되돌릴 방법이 없다(결재 §안전 레일 ②).',
  },
  {
    name: '🔍 원장 조회가 카카오 스크랩 행까지 긁는다',
    file: 'src/worker/utils/document-verify.ts',
    find: "          WHERE opn_svc_id IN ('general_restaurants','rest_cafes') AND mgt_no = ?",
    replace: '          WHERE mgt_no = ?',
    test: DOC,
    why: 'kakao_place 96,832행은 스크랩이라 mgt_no 가 장소 ID 다. 그걸 "인허가 원장에서 확인됨" 으로 보여 주면 없는 근거를 만들어 내는 것이다.',
  },
  {
    name: '🔍 대조 모듈이 셀러 승인 상태를 직접 쓴다',
    file: 'src/worker/utils/document-verify.ts',
    find: '  const result = judgeDocument(ocr, store, ledger)',
    replace: "  const result = judgeDocument(ocr, store, ledger)\n  if (result.verdict === 'match') await DB.prepare(`UPDATE sellers SET business_registration_status = 'verified' WHERE id = ?`).bind(sellerId).run().catch(() => null)",
    test: DOC,
    why: '판정 모듈이 승인까지 해 버리면 게이트를 우회한다 — 결재가 금지한 바로 그 형태다.',
  },
  {
    name: '🇰🇷 주소 파서가 도로명 안 숫자를 건물번호로 집는다',
    file: 'src/shared/korean-address.ts',
    find: "  const roadAt = road ? rest.indexOf(road) : -1\n  const after = roadAt >= 0 ? rest.slice(roadAt + 1) : rest\n  const buildingRaw = after.find((p) => /^\\d+(-\\d+)?[,]?$/.test(p)) || null",
    replace: "  const buildingRaw = (rest.join(' ').match(/\\d+(-\\d+)?/) || [null])[0]",
    test: ADDR,
    why: '`논현로94길 15` 에서 94 를 건물번호로 읽으면 전혀 다른 건물이 "같은 건물" 이 된다. ⚠️ 방어가 둘이라(도로명 뒤만 보기 + 앵커된 정규식) 하나만 지우면 재현이 안 된다 — 순진한 구현으로 통째 교체해야 실제 결함이 된다(2026-09-16 주입 러너가 첫 판을 헛돈다고 잡았다).',
  },
  {
    name: '🇰🇷 상호 정규화가 지점명을 지운다',
    file: 'src/shared/korean-address.ts',
    find: "    .replace(/\\((주|유|합|재|사)\\)/g, ' ')",
    replace: "    .replace(/\\((주|유|합|재|사)\\)/g, ' ')\n    .replace(/\\s*\\S*점$/g, ' ')",
    test: ADDR,
    why: '`스타벅스 역삼점` 과 `스타벅스 강남점` 은 다른 가게다. 지점명을 지우면 남의 지점 서류가 통과한다.',
  },
  {
    name: '🇰🇷 한쪽을 못 읽었는데 differ 로 단정한다',
    file: 'src/shared/korean-address.ts',
    find: "    return { verdict: 'unknown', reason: '시·군·구를 읽지 못했습니다', a, b }",
    replace: "    return { verdict: 'differ', reason: '시·군·구를 읽지 못했습니다', a, b }",
    test: ADDR,
    why: 'OCR 이 못 읽은 것을 "주소가 다르다" 로 바꾸면 그 길로 자동 반려가 흘러든다.',
  },
]
