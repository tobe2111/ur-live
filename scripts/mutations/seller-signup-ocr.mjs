/**
 * 🔍 주입 — 가입 앞문 등록증 자동 채움(시안 ⑤) + 제출 전 확인(시안 ④).
 *
 * 2026-09-16. `src/tests/unit/seller-signup-ocr-2026-09-16.test.ts` 가 **실패할 수 있는지** 확인한다.
 * 이 레포가 반복해 당한 사고는 "검사가 실패한다" 가 아니라 **"검사가 실패할 수 없다"** 였다.
 */
const TEST = 'src/tests/unit/seller-signup-ocr-2026-09-16.test.ts'
const UPLOAD = 'src/features/upload/api/upload.routes.ts'
const CERT = 'src/components/BusinessCertUpload.tsx'
const PAGE = 'src/pages/SellerRegisterSupplierPage.tsx'
const SHEET = 'src/pages/seller-register/ReviewSheet.tsx'

export default [
  {
    name: '가입OCR — opt-in 을 없애 모든 업로드가 추론을 태운다',
    file: UPLOAD,
    find: "if (String(formData.get('ocr') || '') === '1' && c.env.AI) {",
    replace: 'if (c.env.AI) {',
    test: TEST,
    why: '도매·제조 가입까지 추론 비용을 태운다. 비용은 조용히 늘고 아무도 모른다.',
  },
  {
    name: '가입OCR — AI 바인딩 검사 제거(프리뷰에서 런타임 폭발)',
    file: UPLOAD,
    find: "AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }",
    replace: 'AI: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }',
    test: TEST,
    why: 'Pages preview 엔 AI 바인딩이 없다 — 필수로 만들면 타입은 통과하고 런타임에 터진다.',
  },
  {
    name: '가입OCR — 읽기 실패를 업로드 실패로 승격',
    file: UPLOAD,
    find: "      } catch { /* 못 읽었을 뿐이다 — 업로드는 성공이다 */ }",
    replace: '      }',
    test: TEST,
    why: '사진은 이미 R2 에 들어갔는데 응답이 실패가 된다 — 사장님은 다시 찍는다.',
  },
  {
    name: '가입OCR — 업로드 라우트가 셀러 상태를 스스로 바꾼다',
    file: UPLOAD,
    find: "    return c.json({ success: true, data: { key, url, size: file.size, mime: detected, ocr } })",
    replace: "    if (ocr) await c.env.DB.prepare('UPDATE sellers SET business_registration_status = ? WHERE id = ?').bind('verified', 1).run()\n    return c.json({ success: true, data: { key, url, size: file.size, mime: detected, ocr } })",
    test: TEST,
    why: '결재 §안전 레일 ① 위반 — 추출이 승인으로 넘어간다(게이트 밖 자동 승인).',
  },
  {
    name: '가입OCR — 부품이 항상 ocr=1 을 붙인다',
    file: CERT,
    find: "      if (onRead) fd.append('ocr', '1')",
    replace: "      fd.append('ocr', '1')",
    test: TEST,
    why: 'onRead 를 안 준 호출부(도매·제조)까지 추론을 태운다.',
  },
  {
    name: '가입OCR — 사장님이 친 값을 모델이 덮어쓴다',
    file: PAGE,
    find: "        if (!v || String(next[k]).trim()) return",
    replace: '        if (!v) return',
    test: TEST,
    why: '모델이 잘못 읽는 순간 사장님이 고쳐 놓은 값을 되돌린다 — 그리고 아무도 모른다.',
  },
  {
    name: '가입OCR — 손대도 사진 딱지가 안 떨어진다',
    file: PAGE,
    find: "      const next = new Set(prev); next.delete(k); return next",
    replace: '      return prev',
    test: TEST,
    why: '사장님이 직접 고친 칸에도 계속 "사진에서 읽었어요" 가 붙는다 — 확인 요청이 무의미해진다.',
  },
  {
    name: '가입OCR — 확인 시트를 건너뛰고 바로 제출',
    file: PAGE,
    find: "          <button onClick={review} disabled={loading}",
    replace: '          <button onClick={submit} disabled={loading}',
    test: TEST,
    why: '시안 ④ 가 사라진다 — OCR 이 잘못 읽은 값을 확인 없이 보낸다.',
  },
  {
    name: '가입OCR — 확인 시트가 검사보다 먼저 열린다',
    file: PAGE,
    find: "    setReviewOpen(true)\n  }\n\n  async function submit() {",
    replace: "  }\n\n  async function submit() {\n    setReviewOpen(true)",
    test: TEST,
    why: '필수칸·약관 검사를 통과하지 않은 채 시트가 열린다.',
  },
  {
    name: '가입OCR — 시트가 표준 z 스케일을 벗어난다',
    file: SHEET,
    find: 'style={{ zIndex: Z.SHEET_BODY }}',
    replace: 'style={{ zIndex: 100 }}',
    test: TEST,
    why: '하단 네비(z-9999)가 시트를 덮는다 — 이 레포가 여러 번 당한 클래스.',
  },
]
