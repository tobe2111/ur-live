/**
 * 🔍 가입 앞문 — 등록증 사진 자동 채움(시안 ⑤) + 제출 전 확인(시안 ④).
 *
 * 2026-09-16, 대표 참고 시안 5장 중 ④⑤ (*"이 5장 거의 우리도 같게 하게끔 참고해"*).
 *
 * ## 이 시험이 지키는 불변식
 * 1. **읽기는 추출만 한다** — 업로드 라우트가 승인·반려·DB 쓰기를 하지 않는다(결재 §안전 레일).
 * 2. **읽기 실패가 업로드 실패가 되면 안 된다** — OCR 은 통째로 try 안이고 실패는 `ocr: null`.
 * 3. **AI 바인딩이 없으면 조용히 건너뛴다** — Pages preview 엔 바인딩이 없다(env.ts 실측).
 * 4. **opt-in 이다** — `ocr=1` 을 안 보내면 추론이 안 돈다(도매·제조 가입은 비용 0).
 * 5. **빈 칸에만 채운다** — 사장님이 친 값을 모델이 덮지 않는다.
 * 6. **제출 전에 글자로 한 번 더 보여 준다** — 사진에서 채운 칸을 사장님이 한 번도 안 읽었을 수 있다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 모델이 **잘못 읽는 것**. 정확도는 여기서 못 잰다(그래서 ⑤·⑥ 이 있다 — 사람이 확인한다).
 * - 실제 브라우저 동작. jsdom 은 파일 업로드·`ai.run` 을 돌리지 않는다 ⇒ 소스 계약으로 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const UPLOAD = stripComments(readFileSync('src/features/upload/api/upload.routes.ts', 'utf-8'))
const CERT = stripComments(readFileSync('src/components/BusinessCertUpload.tsx', 'utf-8'))
const PAGE = stripComments(readFileSync('src/pages/SellerRegisterSupplierPage.tsx', 'utf-8'))
const SHEET = stripComments(readFileSync('src/pages/seller-register/ReviewSheet.tsx', 'utf-8'))
const SHARED = readFileSync('src/shared/ocr-prefill.ts', 'utf-8')

/** `business-cert` 핸들러 본문만 — 다른 라우트의 코드가 섞여 통과하는 일이 없게 앵커로 자른다. */
function certHandler(): string {
  const i = UPLOAD.indexOf("'/upload/business-cert'")
  expect(i, 'business-cert 라우트가 사라졌다 — 이 시험의 앵커가 낡았다').toBeGreaterThan(0)
  const j = UPLOAD.indexOf("uploadRoutes.get('/media/", i)
  expect(j, '다음 라우트 앵커를 못 찾았다').toBeGreaterThan(i)
  return UPLOAD.slice(i, j)
}

describe('가입 앞문 등록증 읽기 — 서버', () => {
  it('① 추출만 한다 — 승인·상태 변경·셀러 UPDATE 가 없다', () => {
    const h = certHandler()
    expect(h).not.toMatch(/UPDATE\s+sellers/i)
    expect(h).not.toContain('business_registration_status')
    expect(h).not.toContain('verifyAndStoreDocument')
    expect(h).not.toContain('isOcrAutoVerifyEnabled')
  })

  it('② 읽기 실패가 업로드를 실패시키지 않는다 — ocrDocument 호출이 try/catch 안', () => {
    const h = certHandler()
    const k = h.indexOf('ocrDocument')
    expect(k, 'OCR 호출이 사라졌다').toBeGreaterThan(0)
    // 호출 앞의 가장 가까운 `try {` 가 그 뒤의 `catch` 로 닫히는지 — 빈 catch 여도 된다(무시가 의도)
    const before = h.slice(0, k)
    expect(before.lastIndexOf('try {'), 'ocrDocument 가 try 밖에 있다').toBeGreaterThan(0)
    expect(h.slice(k)).toMatch(/catch\s*\{/)
  })

  it('③ AI 바인딩이 없으면 아예 안 부른다', () => {
    expect(certHandler()).toContain('c.env.AI')
    // 바인딩 선언 자체가 optional 이어야 preview 에서 타입이 아니라 런타임에 터지지 않는다
    expect(UPLOAD).toMatch(/AI\?:\s*\{\s*run:/)
  })

  it('④ opt-in — ocr=1 을 안 보내면 추론이 안 돈다', () => {
    expect(certHandler()).toMatch(/formData\.get\('ocr'\)[^\n]*===\s*'1'/)
  })

  it('⑤ 바이트를 fetch 하지 않는다 — URL 을 받아 대신 불러 주는 SSRF 표면 0', () => {
    const h = certHandler()
    expect(h).not.toMatch(/\bfetch\s*\(/)
    expect(h).toContain('new Uint8Array(buffer)')
  })

  it('⑥ 남용 한도가 이 라우트에 이미 걸려 있다', () => {
    expect(UPLOAD).toMatch(/'\/upload\/business-cert'[\s\S]{0,200}rateLimit\(\{[^}]*action:\s*'biz-cert-upload'/)
  })

  it('⑦ 모양은 shared 한 곳에서만 정의된다 — 화면이 워커 라우트를 import 하지 않는다', () => {
    expect(SHARED).toContain('export interface OcrPrefill')
    expect(CERT).toContain("from '@/shared/ocr-prefill'")
    expect(CERT).not.toContain('upload.routes')
  })
})

describe('가입 앞문 등록증 읽기 — 화면', () => {
  it('⑧ 업로드 부품은 onRead 를 받을 때만 ocr=1 을 붙인다', () => {
    expect(CERT).toMatch(/if\s*\(onRead\)\s*fd\.append\('ocr',\s*'1'\)/)
  })

  it('⑨ 가입 화면이 그 콜백을 실제로 배선했다', () => {
    expect(PAGE).toContain('onRead={applyOcr}')
  })

  it('⑩ 빈 칸에만 채운다 — 사장님이 친 값을 덮지 않는다', () => {
    const i = PAGE.indexOf('function applyOcr')
    expect(i).toBeGreaterThan(0)
    const body = PAGE.slice(i, PAGE.indexOf('function review', i))
    // 이미 값이 있으면 그대로 돌아가는 가드
    expect(body).toMatch(/if\s*\(!v\s*\|\|\s*String\(next\[k\]\)\.trim\(\)\)\s*return/)
  })

  it('⑪ 사진에서 채운 칸은 확인을 요청한다 — 그리고 손대면 딱지가 떨어진다', () => {
    expect(PAGE).toContain("t('seller.signup.fromPhoto'")
    expect(PAGE).toContain('setAutoFilled')
    // set() 안에서 해당 키를 집합에서 뺀다
    const i = PAGE.indexOf('const set = <K extends keyof SignupForm>')
    expect(i).toBeGreaterThan(0)
    expect(PAGE.slice(i, i + 700)).toContain('next.delete(k)')
  })

  it('⑫ 개업일은 YYYYMMDD → YYYY-MM-DD 로 바꿔 넣는다 (input[type=date] 가 받는 유일한 모양)', () => {
    const i = PAGE.indexOf('function applyOcr')
    const body = PAGE.slice(i, PAGE.indexOf('function review', i))
    expect(body).toContain('.slice(0, 4)')
    expect(body).toContain('.slice(4, 6)')
    expect(body).toContain('.slice(6, 8)')
  })
})

describe('제출 전 확인 (시안 ④)', () => {
  it('⑬ 제출 버튼은 바로 안 보낸다 — 확인을 먼저 연다', () => {
    expect(PAGE).toContain('onClick={review}')
    expect(PAGE).not.toContain('onClick={submit}')
    expect(PAGE).toContain('setReviewOpen(true)')
    expect(PAGE).toContain('onConfirm={submit}')
  })

  it('⑭ 검사(필수칸·약관)를 건너뛰지 않는다 — 시트 열기 전에 통과해야 한다', () => {
    const i = PAGE.indexOf('function review()')
    expect(i).toBeGreaterThan(0)
    const body = PAGE.slice(i, PAGE.indexOf('async function submit', i))
    expect(body).toContain('validateSignup(form)')
    expect(body).toContain('termsAgreed')
    // 시트 열기는 그 두 가드보다 **뒤**여야 한다
    expect(body.indexOf('setReviewOpen(true)')).toBeGreaterThan(body.indexOf('termsAgreed'))
  })

  it('⑮ 시트가 제출될 값을 글자로 보여 준다', () => {
    for (const label of ['사업자번호', '대표자명', '개업일', '가게명', '연락처', '매장 주소']) {
      expect(PAGE, `확인 시트에 ${label} 이 없다`).toContain(`label: '${label}'`)
    }
  })

  it('⑯ 시트는 네비 위로 뜬다 — 표준 z 스케일만 쓴다', () => {
    expect(SHEET).toContain('Z.SHEET_BODY')
    expect(SHEET).not.toMatch(/z-\[\d+\]/)
  })

  it('⑰ 색 정보상자·이모지 0 — 티켓 규칙 ⑥', () => {
    expect(SHEET).not.toMatch(/bg-(amber|emerald|red|blue|green|yellow)-\d{2,3}/)
    // eslint-disable-next-line no-misleading-character-class
    expect(SHEET).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })
})
