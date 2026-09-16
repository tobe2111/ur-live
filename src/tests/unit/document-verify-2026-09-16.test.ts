/**
 * 🧾 서류 ↔ 등록 매장 판정 불변식 — `worker/utils/document-verify.ts`.
 *
 * 2026-09-16 (결재 `2026-09-16-ocr-license-automation.md`).
 *
 * ## 이 시험이 지키는 것
 * 결재가 못 박은 안전 레일 둘이 **코드로** 지켜지는지:
 * 1. 자동 승인은 게이트 뒤 — 이 파일의 어떤 함수도 `verified` 를 쓰지 않는다.
 * 2. 자동 반려 없음 — 못 읽은 것이 `mismatch` 로 올라가지 않는다.
 *
 * 그리고 결재가 지목한 **사기 시나리오**가 실제로 `mismatch` 로 잡히는지.
 *
 * ## 이 시험이 못 막는 것
 * - OCR 이 글자를 얼마나 잘 읽는가(모델 품질 — 배포 후 실사진으로 판정할 항목).
 * - 같은 건물 다른 호실의 두 가게(주소만으로는 구분 불가 — 그래서 사람이 상호도 같이 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { judgeDocument } from '@/worker/utils/document-verify'
import type { OcrDocResult } from '@/worker/utils/ocr-license'
import { stripComments } from '../helpers/source-text'

function ocr(p: Partial<OcrDocResult>): OcrDocResult {
  return {
    ok: true, kind: 'business_registration', bizName: null, address: null, ownerName: null,
    bizNumber: null, mgtNo: null, permitDate: null, fill: 1, message: '', ...p,
  }
}

describe('judgeDocument — 사기 시나리오', () => {
  it('🔴 자기 진짜 등록증 + 남의 가게 → mismatch (결재가 지목한 그 구멍)', () => {
    // 사기꾼은 본인 명의 등록증(강북구 소재)을 내고, 강남의 유명 가게를 등록했다
    const r = judgeDocument(
      ocr({ bizName: '김가네상사', address: '서울 강북구 도봉로 100' }),
      { name: '대가방 본점', address: '서울 강남구 봉은사로 333' },
      null,
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.summary).toContain('소재지가 등록 매장과 다릅니다')
  })

  it('정상 — 같은 건물 + 상호 포함 → match', () => {
    const r = judgeDocument(
      ocr({ bizName: '대가방', address: '서울특별시 강남구 봉은사로 333, 2층' }),
      { name: '대가방 본점', address: '서울 강남구 봉은사로 333' },
      null,
    )
    expect(r.verdict).toBe('match')
  })

  it('같은 구인데 건물이 다르면 review — mismatch 로 올리지 않는다', () => {
    const r = judgeDocument(
      ocr({ bizName: '대가방', address: '서울 강남구 봉은사로 555' }),
      { name: '대가방', address: '서울 강남구 봉은사로 333' },
      null,
    )
    expect(r.verdict).toBe('review')
  })
})

describe('judgeDocument — 🛡️ 자동 반려를 만들지 않는다', () => {
  it('OCR 실패는 unreadable — mismatch 가 아니다', () => {
    const r = judgeDocument(
      ocr({ ok: false, fill: 0 }),
      { name: '대가방', address: '서울 강남구 봉은사로 333' },
      null,
    )
    expect(r.verdict).toBe('unreadable')
    expect(r.verdict).not.toBe('mismatch')
  })

  it('주소를 못 읽었으면 unreadable 또는 review — 절대 mismatch 아님', () => {
    const r = judgeDocument(
      ocr({ bizName: '대가방', address: null }),
      { name: '대가방', address: '서울 강남구 봉은사로 333' },
      null,
    )
    expect(['unreadable', 'review']).toContain(r.verdict)
  })

  it('등록 매장 주소가 아직 없으면 mismatch 가 아니다', () => {
    // 매장 주소를 아직 안 채운 사장님을 사기꾼 취급하면 안 된다
    const r = judgeDocument(
      ocr({ bizName: '대가방', address: '서울 강남구 봉은사로 333' }),
      { name: null, address: null },
      null,
    )
    expect(r.verdict).not.toBe('mismatch')
  })
})

describe('원장(localdata) — 없다고 의심하지 않는다', () => {
  it('원장 미발견 문구가 "이상 신호가 아님"을 분명히 말한다', () => {
    const r = judgeDocument(ocr({ bizName: '대가방', address: '서울 강남구 봉은사로 333' }),
      { name: '대가방', address: '서울 강남구 봉은사로 333' }, null)
    expect(r.ledgerNote).toContain('이상 신호가 아닙니다')
  })

  it('원장에서 찾으면 그 사실을 싣는다', () => {
    const r = judgeDocument(ocr({ bizName: '광주식당', address: '서울 종로구 종로 358-11' }),
      { name: '광주식당', address: '서울 종로구 종로 358-11' },
      { mgtNo: '3000000-101-2026-00231', bizName: '광주식당', address: '서울특별시 종로구 종로 358-11', tradeState: '영업/정상', permitDate: '20260803' })
    expect(r.ledger?.mgtNo).toBe('3000000-101-2026-00231')
    expect(r.ledgerNote).toContain('영업/정상')
  })
})

describe('🚧 안전 레일이 소스로 지켜지는가', () => {
  const src = stripComments(readFileSync('src/worker/utils/document-verify.ts', 'utf8'))

  it('이 모듈은 셀러 승인 상태를 절대 쓰지 않는다', () => {
    expect(src).not.toMatch(/business_registration_status\s*=/)
    expect(src).not.toMatch(/UPDATE\s+sellers/i)
  })

  it('원장 조회는 카카오 스크랩 행을 제외한다', () => {
    // kakao_place 행은 mgt_no 가 장소 ID 라 "원장에서 확인됨" 근거가 될 수 없다
    const hits = src.match(/opn_svc_id IN \('general_restaurants','rest_cafes'\)/g) || []
    expect(hits.length).toBe(2)
    expect(src).not.toContain('kakao_place')
  })
})

describe('🚧 셀러 OCR 라우트의 자동 승인이 게이트 뒤에 있는가', () => {
  const src = stripComments(readFileSync('src/features/seller/api/seller-profile.routes.ts', 'utf8'))

  it('verified 로 바꾸는 UPDATE 가 게이트 변수에 묶여 있다', () => {
    // 🩸 2026-09-16 이전엔 `if (cmp.autoVerified)` 하나였다 — 바인딩이 켜지는 순간 승인이 자동으로 나갔다
    expect(src).toMatch(/const\s+autoVerifyOn\s*=\s*await\s+isOcrAutoVerifyEnabled\(/)
    expect(src).toMatch(/const\s+willAutoVerify\s*=\s*autoVerifyOn\s*&&\s*cmp\.autoVerified/)
    expect(src).toMatch(/if\s*\(willAutoVerify\)\s*\{/)
  })

  it('게이트가 꺼져 있으면 화면에 "자동 검증 완료" 라고 말하지 않는다', () => {
    expect(src).toMatch(/autoVerified:\s*willAutoVerify/)
  })
})
