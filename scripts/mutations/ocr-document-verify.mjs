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
const PERMIT = 'src/tests/unit/food-permit-2026-09-16.test.ts'
const RETRY = 'src/tests/unit/ocr-empty-retry-2026-09-21.test.ts'

export default [
  {
    name: '🔁 OCR 빈 응답 재시도가 사라진다 (2026-09-21 이전 상태 — 5회 중 2회 unreadable)',
    file: 'src/worker/utils/ocr-license.ts',
    find: '  for (let attempt = 0; attempt < OCR_EMPTY_RETRIES + 1 && !text; attempt += 1) {',
    replace: '  for (let attempt = 0; attempt < 1 && !text; attempt += 1) {',
    test: RETRY,
    why: '빈 응답은 예외가 아니라 조용한 실패다. 한 번에 끝내면 게이트가 켜진 뒤 정상 서류가 자동 승인 후보에서 소리 없이 빠진다.',
  },
  {
    name: '🔁 OCR 이 예외에도 재시도한다 (5016·쿼터를 두 번 두드린다)',
    file: 'src/worker/utils/ocr-license.ts',
    find: "      return emptyResult(kind, `읽기 실패: ${String((err as Error)?.message || '').slice(0, 80)}`)",
    replace: "      if (attempt >= OCR_EMPTY_RETRIES) return emptyResult(kind, `읽기 실패: ${String((err as Error)?.message || '').slice(0, 80)}`)\n      continue",
    test: RETRY,
    why: '라이선스 미동의·쿼터 초과는 다시 물어도 같은 답이다 — 재시도는 빈 응답에만 허용된다.',
  },
  {
    name: '🇰🇷 도로명 숫자 띄어쓰기 흡수가 사라진다 (`가리내 10길` → 도로명 `10길`)',
    file: 'src/shared/korean-address.ts',
    find: "  s = s.replace(/([가-힣]+)(?<!구|군|시|읍|면|동|리)\\s+(\\d+(?:번)?(?:길|로))(?=\\s|$)/g, '$1$2')",
    replace: '  s = s',
    test: ADDR,
    why: 'S-OCR 라이브 실측에서 모델이 도로명 숫자를 띄어 썼다. 이 한 줄이 없으면 같은 건물이 near 로 떨어져 정상 사장님이 사람 확인 큐에 남는다.',
  },
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
  {
    name: '🍽️ 영업신고증 업로드가 원본을 올린다 (413 재발)',
    file: 'src/components/seller/FoodPermitUpload.tsx',
    find: "      fd.append('file', prepared)",
    replace: "      fd.append('file', file)",
    test: PERMIT,
    why: '폰 사진은 서버 상한을 쉽게 넘는다. 2026-09-15 에 등록증 두 문을 고쳤는데 세 번째 문을 같은 결함으로 새로 내면 아무 소용이 없다.',
  },
  {
    name: '🍽️ 영업신고증 URL 로 아무 주소나 받는다 (SSRF)',
    file: 'src/features/seller/api/seller-profile/business-info.ts',
    find: "    if (raw && !/^\\/api\\/media\\/[A-Za-z0-9/_.\\-]+$/.test(raw)) {",
    replace: "    if (false) {",
    test: PERMIT,
    why: '이 값은 어드민 OCR 라우트가 **서버에서 fetch** 한다 — 셀러가 넣은 주소를 우리 워커가 대신 두드리게 된다. 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🍽️ 영업신고증 저장을 운영자(중개사)도 할 수 있다',
    file: 'src/features/seller/api/seller-profile/business-info.ts',
    find: "    if (!actor.isOwner) return c.json({ success: false, error: `영업신고증은 ${OWNER_ONLY_MESSAGE}` }, 403);",
    replace: "    if (false) return c.json({ success: false, error: 'x' }, 403);",
    test: PERMIT,
    why: '명의를 증명하는 서류를 대신 운영하는 사람이 갈아끼울 수 있으면, 심사 대상이 조용히 바뀐다(사업자 정보와 같은 레일).',
  },
  {
    name: '🍽️ 운영자 마스킹에서 서류 사진만 빠진다',
    file: 'src/features/seller/api/seller-profile/business-info.ts',
    // ⚠️ 마스킹 블록이 둘이라(행 있음 / 시드) 앞줄까지 붙여 자리를 고정한다
    find: "      const b = businessInfo as Record<string, unknown>;\n      b.business_number = maskBusinessNumber(b.business_number);\n      b.ceo_name = maskName(b.ceo_name);\n      for (const k of ['postal_code', 'address', 'address_detail', 'phone', 'email', 'food_permit_url']) b[k] = null;",
    replace: "      const b = businessInfo as Record<string, unknown>;\n      b.business_number = maskBusinessNumber(b.business_number);\n      b.ceo_name = maskName(b.ceo_name);\n      for (const k of ['postal_code', 'address', 'address_detail', 'phone', 'email']) b[k] = null;",
    test: PERMIT,
    why: '주소·연락처는 가리면서 그게 전부 찍힌 사진 한 장을 그대로 주면 마스킹이 무의미하다. 한 필드만 빠져도 그 길로 샌다.',
  },
  {
    name: '📄 대시보드 등록증이 다시 "5MB 넘으면 거절" 로 돌아간다',
    file: 'src/pages/SellerBusinessInfoPage.tsx',
    find: "      const prepared = await compressForDocument(file).catch(() => file)",
    replace: "      const prepared = file\n      if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 이미지만 가능합니다'); return }",
    test: PERMIT,
    why: '2026-09-15 수리가 가입 폼만 덮고 대시보드를 비켜갔다 — 사장님이 폰으로 찍은 등록증을 제출할 방법이 없어진다.',
  },
  {
    name: '🍽️ 어드민 OCR 이 영업신고증도 sellers 컬럼에서 읽는다',
    file: 'src/features/admin/api/admin-seller-ocr.routes.ts',
    find: "  if (kind === 'business_license') {",
    replace: '  if (false) {',
    test: PERMIT,
    why: '저장 자리가 다르다(seller_meta). 잘못 읽으면 영업신고증을 눌러도 등록증을 읽고, 화면엔 "영업신고증" 이라고 적힌다 — 가장 나쁜 종류의 조용한 오판이다.',
  },
  {
    name: '🔍 어드민 화면이 OCR 패널을 안 부른다 (축 전체가 죽은 코드가 된다)',
    file: 'src/pages/AdminBusinessVerificationPage.tsx',
    find: '                    <OcrComparePanel sellerId={s.id} permitUrl={s.food_permit_url} />',
    replace: '                    {false && <OcrComparePanel sellerId={s.id} />}',
    test: PERMIT,
    why: '2026-09-16 실제로 이 상태였다 — 라우트·판정·대조를 다 만들고 버튼만 없었다. 에러도 안 나고 테스트도 통과하고 아무도 안 쓴다("코드에 있다 ≠ 살아 있다").',
  },
  {
    name: '🔍 OCR 패널이 못 읽은 서류를 빨강으로 칠한다',
    file: 'src/pages/admin/business-verification/OcrComparePanel.tsx',
    find: "  unreadable: { label: '못 읽음', cls: 'bg-gray-100 text-gray-600' },",
    replace: "  unreadable: { label: '못 읽음', cls: 'bg-tone-bad-bg text-tone-bad' },",
    test: PERMIT,
    why: '사진이 흐린 정상 사장님이 화면에서 "빨강" 으로 보이면 운영자가 반려한다 — 결재 §안전 레일 ② 가 금지한 자동 반려를 사람 손으로 하게 만드는 UI.',
  },
  {
    name: '🔍 영업신고증 버튼이 서류 없어도 뜬다',
    file: 'src/pages/admin/business-verification/OcrComparePanel.tsx',
    // ⚠️ 같은 게이트가 둘(버튼·보기 링크)이라 버튼 쪽으로 좁힌다 — 앵커가 모호하면 러너가 멈춘다
    find: "        {permitUrl && (\n          <button type=\"button\" onClick={() => run('business_license')} disabled={!!busy}",
    replace: "        {true && (\n          <button type=\"button\" onClick={() => run('business_license')} disabled={!!busy}",
    test: PERMIT,
    why: '없는 서류에 버튼이 보이면 눌러 보고 400 을 받는다. 안내가 아니라 소음이고, 운영자는 "고장났나" 로 읽는다.',
  },
]
