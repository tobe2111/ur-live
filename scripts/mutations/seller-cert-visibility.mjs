/**
 * 🧾 등록증 가시성 (2026-09-20) 되돌려-검증 주입. 가드: src/tests/unit/seller-cert-visibility-2026-09-20.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/seller-cert-visibility-2026-09-20.test.ts'

export default [
  {
    name: '🧾등록증가시성 매장 등록이 컬럼에 안 적는다 (meta 에만 → 어드민·OCR 서류 없음)',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: "    await c.env.DB.prepare(\"UPDATE sellers SET business_registration_image_url = ? WHERE id = ? AND COALESCE(business_registration_image_url, '') = ''\").bind(certUrl, newSellerId).run().catch(() => null)\n",
    replace: '',
    test: TEST,
    why: '09-16 "사진을 받아 사람이 심사" 가 이 경로에서 비어 있던 실사고(E5 에서 발견). 에러 0.',
  },
  {
    name: '🧾등록증가시성 OCR 이 컬럼만 읽는다 (폴백 제거)',
    file: 'src/features/admin/api/admin-seller-ocr.routes.ts',
    find: "    url = (await resolveSellerCertUrl(c.env.DB, sellerId, row.business_registration_image_url)) || ''",
    replace: "    url = (row.business_registration_image_url || '').trim()",
    test: TEST,
    why: '이전 행(meta 에만 있는 매장)에서 OCR 이 "제출된 이미지가 없습니다" 로 헛돈다.',
  },
  {
    name: '🧾등록증가시성 폴백이 meta 를 안 본다 (컬럼 없으면 null)',
    file: 'src/worker/utils/seller-cert-url.ts',
    find: '      if (v) out.set(id, v)',
    replace: '      void v',
    test: TEST,
    why: '폴백 함수가 이름만 폴백이고 실제로는 컬럼만 돌려주면 세 읽기 자리가 전부 조용히 옛 동작으로 돌아간다.',
  },
  {
    name: '🧾등록증가시성 셀러 배너 근거가 컬럼만 본다 (등록증 냈는데 "사본이 아직 없어요")',
    file: 'src/features/auth/api/seller.routes.ts',
    find: "      has_business_cert: !!(await import('../../../worker/utils/seller-cert-url').then(m => m.resolveSellerCertUrl(c.env.DB, sellerId, row?.business_registration_image_url)).catch(() => row?.business_registration_image_url || null)),",
    replace: '      has_business_cert: !!row?.business_registration_image_url,',
    test: TEST,
    why: 'E5 브라우저 실측: 등록증을 첨부해 등록한 매장인데 대시보드 상단이 "서류 올리기" 를 요구했다.',
  },
  {
    name: '🧾등록증가시성 라이선스 동의가 요청 본문의 임의 모델로 간다',
    file: 'src/features/admin/api/admin-seller-ocr.routes.ts',
    find: "    const res = await c.env.AI.run(OCR_MODEL, { prompt: 'agree' })",
    replace: "    const res = await c.env.AI.run(String((await c.req.json<{ model?: string }>().catch(() => ({}))).model || OCR_MODEL), { prompt: 'agree' })",
    test: TEST,
    why: '동의는 계정 단위 라이선스 수락이다 — 어드민 화면 한 번에 아무 모델이나 수락되면 안 된다.',
  },
]
