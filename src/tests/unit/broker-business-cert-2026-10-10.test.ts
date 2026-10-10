/**
 * 📄 중개사가 매장을 등록할 때 받는 서류는 매장 등록증이다 (2026-10-10 대표 결재 —
 * docs/decisions/2026-10-06-broker-business-cert.md 안 1).
 *
 * 메인 노출 심사(`approvedSellerProductSql`)는 매장 행(`sellers.status`)을 본다. 서류가 중개사 것이면
 * 심사 근거와 심사 대상이 갈린다 — 에러는 안 나고 판정만 틀린다. 그래서 운영 방식이 '중개·대행' 일 때
 * 화면이 **매장 것**이라고 분명히 말하는지를 고정한다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 중개사가 그래도 자기 등록증을 올리는 경우(사람의 선택) ·
 * 어드민 심사 화면이 그 차이를 보여 주는지 · 중개사 본인 서류 칸(별건, 미구현).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(fs.readFileSync('src/components/seller/StoreRegisterModal.tsx', 'utf8'))

describe('중개 매장 등록 — 서류는 매장 것', () => {
  it('중개 문구가 "매장" 등록증이라고 말하고 중개사 본인 것이 아니라고 밝힌다', () => {
    expect(SRC).toMatch(/title:\s*'이 매장의 사업자등록증을 올려주세요 \(선택\)'/)
    expect(SRC).toMatch(/hint:\s*'중개사님 본인 것이 아니라/)
  })

  it('제목·설명이 운영 방식을 따라 바뀐다(정적 STEPS 를 직접 그리지 않는다)', () => {
    expect(SRC).toMatch(/STEPS\[step\]\.key === 'business' && channel === 'brokered'/)
    expect(SRC).toContain('{stepCopy(step, channel).title}')
    expect(SRC).toContain('{stepCopy(step, channel).hint}')
    expect(SRC).not.toContain('{STEPS[step].title}')
  })

  it('첨부 칸과 사업자번호 칸도 중개일 때 "매장" 이라고 부른다', () => {
    expect(SRC).toMatch(/channel === 'brokered' \? '매장 사업자등록증 사진 첨부'/)
    expect(SRC).toMatch(/channel === 'brokered' \? '매장 사업자번호'/)
  })

  it('직접 운영 문구는 종전 그대로다(사장님 화면 불변)', () => {
    expect(SRC).toContain("title: '사업자등록증을 올려주세요 (선택)'")
  })
})
