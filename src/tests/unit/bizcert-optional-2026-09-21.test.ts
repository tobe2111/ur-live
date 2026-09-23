/**
 * 📄 사업자등록증 **선택** 전환 + 📩 사장님 통보 링크 둘 (2026-09-21 대표 확정).
 *
 * ## 이 시험이 **재는 것**
 *  - 배지 판정(`sellerCertView`)의 **실제 동작** — 상태가 비어 있을 때 파일 유무로 갈리는가.
 *  - 통보 문구·버튼이 대시보드와 되찾기를 **둘 다**, **순서대로** 담는가.
 *  - 앞문(위저드)·서버가 서류 없이도 통과시키되 **모양 검사는 남겼는가**.
 *
 * ## 이 시험이 **못 재는 것**(가드를 과신하지 말 것)
 *  - 서류가 **진짜인지**. 파일이 있다는 사실만 안다.
 *  - 선택으로 바꾼 뒤 **승인 큐가 감당 가능한지** — 그건 라이브에서 며칠 봐야 안다(E4~E5).
 *  - 알림톡 버튼이 카카오에서 **실제로 그려지는지**. 템플릿 검수를 통과해야 알 수 있다.
 *  - `/seller/waiting` 이 세션 없는 사람을 어디로 보내는지(현재 `/seller/login` — 알려진 한계).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sellerCertView, SELLER_CERT_LABEL } from '@/shared/seller-cert-badge'
import {
  ownerNoticeMessage, ownerNoticeButtonsJson,
  OWNER_NOTICE_DASHBOARD_URL, OWNER_NOTICE_CLAIM_URL,
} from '@/worker/utils/store-owner-notice'
import { stripComments } from '../helpers/source-text'

const MODAL = 'src/components/seller/StoreRegisterModal.tsx'
const ROUTE = 'src/features/seller/api/seller-stores.routes.ts'
const ADMIN = 'src/pages/AdminSellerApprovalPage.tsx'
const modal = stripComments(readFileSync(MODAL, 'utf8'))
const route = stripComments(readFileSync(ROUTE, 'utf8'))
const admin = stripComments(readFileSync(ADMIN, 'utf8'))

describe('🧾 등록증 배지 — 어드민이 "서류 없음" 을 구분한다', () => {
  it('상태가 비어 있으면 **파일 유무**로 갈린다', () => {
    expect(sellerCertView(null, '/api/media/uploads/biz-cert/x.jpg')).toBe('submitted')
    expect(sellerCertView(null, null)).toBe('missing')
    expect(sellerCertView('', '')).toBe('missing')
    expect(sellerCertView(undefined, '   ')).toBe('missing')
  })

  it('명시된 상태는 파일 유무보다 우선한다 (심사 결과를 덮지 않는다)', () => {
    expect(sellerCertView('verified', null)).toBe('verified')
    expect(sellerCertView('rejected', '/api/media/uploads/biz-cert/x.jpg')).toBe('rejected')
    expect(sellerCertView('pending', null)).toBe('pending')
  })

  it('다섯 상태에 라벨이 전부 있다 (하나라도 비면 화면에 undefined 가 찍힌다)', () => {
    for (const v of ['verified', 'pending', 'submitted', 'rejected', 'missing'] as const) {
      expect(SELLER_CERT_LABEL[v], v).toBeTruthy()
    }
    expect(SELLER_CERT_LABEL.missing).toContain('없음')
    expect(SELLER_CERT_LABEL.submitted).toContain('미검증')
  })

  it('어드민 목록이 이 함수를 쓴다 (JSX 삼항으로 되돌아가면 동작 시험을 못 한다)', () => {
    expect(admin).toMatch(/sellerCertView\(s\.business_registration_status, s\.business_registration_image_url\)/)
    expect(admin).toMatch(/SELLER_CERT_LABEL\[bizView\]/)
  })
})

describe('📄 앞문 — 등록증 없이도 등록된다', () => {
  it('마지막 단계가 등록증으로 막지 않는다', () => {
    expect(modal).not.toMatch(/사업자등록증 사진을 첨부해주세요/)
  })

  it('제출 가드에서도 등록증이 빠졌다', () => {
    expect(modal).toMatch(/if \(!picked \|\| !channel \|\| !managerOk \|\| submitting\) return/)
    expect(modal).not.toMatch(/!certOk \|\| submitting/)
  })

  it('제목이 선택임을 대놓고 말한다 (당근 원칙 ② — 안 쓰면 못 넘어가나 고민하지 않게)', () => {
    expect(modal).toMatch(/사업자등록증을 올려주세요 \(선택\)/)
  })

  it('건너뛸 때의 **대가**를 숨기지 않는다 (승인 전 미노출)', () => {
    expect(modal).toMatch(/승인 전까지는 메인에 노출되지 않고/)
  })
})

describe('🔒 서버 — 비어도 받지만 모양은 검사한다', () => {
  it('빈 값만 통과시키고, 값이 있으면 우리 업로드 경로여야 한다', () => {
    // 이 조건이 `if (!/^\/api\/media/.test(certUrl))` 로 되돌아가면 서류 없는 등록이 다시 막히고,
    // 조건 자체가 사라지면 임의 URL 을 심사 자료로 들이밀 수 있다. 둘 다 잡는다.
    expect(route).toMatch(/if \(certUrl && !\/\^\\\/api\\\/media\\\/uploads\\\/biz-cert\\\/\/\.test\(certUrl\)\)/)
  })

  it('빈 등록증을 meta·컬럼에 쓰지 않는다', () => {
    expect(route).toMatch(/\.\.\.\(certUrl \? \{ business_cert_url: certUrl \} : \{\}\)/)
    expect(route).toMatch(/if \(certUrl\) await c\.env\.DB\.prepare\("UPDATE sellers SET business_registration_image_url/)
  })
})

describe('📩 사장님 통보 — 링크 둘, 순서가 의미다', () => {
  it('문구에 대시보드와 되찾기가 **둘 다** 있다', () => {
    const m = ownerNoticeMessage('홍대돈까스')
    expect(m).toContain('홍대돈까스')
    expect(m).toContain(OWNER_NOTICE_DASHBOARD_URL)
    expect(m).toContain(OWNER_NOTICE_CLAIM_URL)
  })

  it('대시보드가 먼저다 — 수신자 대부분은 방금 등록한 본인이다', () => {
    const m = ownerNoticeMessage('가게')
    expect(m.indexOf(OWNER_NOTICE_DASHBOARD_URL)).toBeLessThan(m.indexOf(OWNER_NOTICE_CLAIM_URL))
  })

  it('대시보드 주소는 `/seller` 가 아니라 `/seller/waiting` 이다', () => {
    // `/seller` 로 바로 보내면 requireSeller 가 이메일·비번 로그인으로 튕긴다(카카오 가입자에겐 낯선 화면).
    expect(OWNER_NOTICE_DASHBOARD_URL).toMatch(/\/seller\/waiting$/)
    expect(OWNER_NOTICE_DASHBOARD_URL).not.toMatch(/\/seller$/)
  })

  it('버튼이 정확히 둘이고, 순서와 종류가 맞다', () => {
    const b = JSON.parse(ownerNoticeButtonsJson()) as { button: Array<{ name: string; type: string; url_mobile: string }> }
    expect(b.button.length).toBe(2)
    expect(b.button[0].url_mobile).toBe(OWNER_NOTICE_DASHBOARD_URL)
    expect(b.button[1].url_mobile).toBe(OWNER_NOTICE_CLAIM_URL)
    for (const btn of b.button) {
      expect(btn.type, '웹링크(WL)가 아니면 카카오가 다른 동작을 한다').toBe('WL')
      expect(btn.name.length, '버튼 이름이 비어 있다').toBeGreaterThan(0)
    }
  })

  it('발송기에 버튼을 실제로 넘긴다 (문구만 맞고 버튼이 빠지면 눌 곳이 없다)', () => {
    const util = stripComments(readFileSync('src/worker/utils/store-owner-notice.ts', 'utf8'))
    expect(util).toMatch(/button_1: ownerNoticeButtonsJson\(\)/)
  })
})
