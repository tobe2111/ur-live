import { describe, it, expect } from 'vitest'
import {
  maskCounterpartName,
  threadBelongsToMe,
} from '@/features/supply/api/wholesale-chat.routes'

/**
 * 🛡️ 2026-06-09 도매 채팅 신원 마스킹 + IDOR 소유권 술어 — 보안 불변식 고정.
 *
 * 핵심 불변식:
 *   1. distributor(유통사) 뷰는 절대 제조사(supplier) 이름을 못 봄 — '제조사' 고정 라벨.
 *   2. supplier(제조사) 뷰는 유통사 이름을 정상 노출 (or fallback `유통사 #<id>`).
 *   3. threadBelongsToMe — 내 id 와 역할에 맞는 컬럼 검사 (IDOR 소유권 술어).
 *      - 다른 유통사·제조사의 스레드 id 로 접근 → false (권한 없음).
 *      - 역할 전환 공격(같은 id 로 다른 role 가장) → false.
 *
 * 순수 함수만 테스트(DB 불필요). maskCounterpartName / threadBelongsToMe 는
 * wholesale-chat.routes.ts 에 @internal export 로 노출.
 */

// ────────────────────────────────────────────────────────────────────────────
// maskCounterpartName — 역할별 상대방 이름 마스킹
// ────────────────────────────────────────────────────────────────────────────
describe('maskCounterpartName — 상대방 이름 마스킹', () => {
  // ── distributor(유통사) 뷰: 항상 '제조사' 고정 ──────────────────────────────
  describe('distributor 뷰 (신원 비공개 모델)', () => {
    it('supplier business_name 이 있어도 제조사 고정 라벨 반환', () => {
      expect(maskCounterpartName('distributor', '삼성전자 식품부', 99)).toBe('제조사')
    })

    it('business_name 이 null 이어도 제조사 고정 라벨 반환', () => {
      expect(maskCounterpartName('distributor', null, 99)).toBe('제조사')
    })

    it('business_name 이 undefined 이어도 제조사 고정 라벨 반환', () => {
      expect(maskCounterpartName('distributor', undefined, 99)).toBe('제조사')
    })

    it('business_name 이 빈 문자열이어도 제조사 고정 라벨 반환', () => {
      expect(maskCounterpartName('distributor', '', 99)).toBe('제조사')
    })

    it('counterpartId 값에 무관하게 항상 제조사 (id=1 경계)', () => {
      expect(maskCounterpartName('distributor', '어떤이름', 1)).toBe('제조사')
    })

    it('제조사 라벨에 절대 business_name 문자열 포함 안 됨', () => {
      const result = maskCounterpartName('distributor', '비밀제조사명', 42)
      expect(result).not.toContain('비밀제조사명')
      expect(result).toBe('제조사')
    })
  })

  // ── supplier(제조사) 뷰: 유통사 이름 실제 노출 ─────────────────────────────
  describe('supplier 뷰 (유통사 이름 노출)', () => {
    it('유통사 이름 있음 → 실제 이름 반환', () => {
      expect(maskCounterpartName('supplier', '유통스타트 식품팀', 7)).toBe('유통스타트 식품팀')
    })

    it('유통사 이름 null → 유통사 #<id> fallback', () => {
      expect(maskCounterpartName('supplier', null, 7)).toBe('유통사 #7')
    })

    it('유통사 이름 undefined → 유통사 #<id> fallback', () => {
      expect(maskCounterpartName('supplier', undefined, 7)).toBe('유통사 #7')
    })

    it('유통사 이름 빈 문자열 → 유통사 #<id> fallback', () => {
      expect(maskCounterpartName('supplier', '', 7)).toBe('유통사 #7')
    })

    it('fallback id 가 counterpartId 값과 일치', () => {
      expect(maskCounterpartName('supplier', null, 123)).toBe('유통사 #123')
      expect(maskCounterpartName('supplier', '', 999)).toBe('유통사 #999')
    })

    it('supplier 뷰 결과는 결코 제조사 고정 라벨 아님', () => {
      const result = maskCounterpartName('supplier', '실제유통사', 5)
      expect(result).not.toBe('제조사')
    })
  })

  // ── 비대칭성 보장: distributor/supplier 같은 입력에서 다른 결과 ─────────────
  describe('비대칭 마스킹 — 역할별 다른 결과', () => {
    it('같은 name + id 라도 역할에 따라 결과 다름', () => {
      const name = '테스트회사'
      const id = 42
      const distResult = maskCounterpartName('distributor', name, id)
      const supResult = maskCounterpartName('supplier', name, id)
      expect(distResult).toBe('제조사')
      expect(supResult).toBe('테스트회사')
      expect(distResult).not.toBe(supResult)
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// threadBelongsToMe — IDOR 소유권 술어
// ────────────────────────────────────────────────────────────────────────────
describe('threadBelongsToMe — 소유권/IDOR 술어', () => {
  // ── distributor 소유권 ─────────────────────────────────────────────────────
  describe('distributor 역할', () => {
    it('distributor_seller_id 가 내 id 와 일치 → true (본인 스레드)', () => {
      expect(threadBelongsToMe(
        { distributor_seller_id: 10, supplier_id: 20 },
        { role: 'distributor', id: 10 },
      )).toBe(true)
    })

    it('distributor_seller_id 가 다른 유통사 → false (IDOR 차단)', () => {
      expect(threadBelongsToMe(
        { distributor_seller_id: 99, supplier_id: 20 },
        { role: 'distributor', id: 10 },
      )).toBe(false)
    })

    it('supplier_id 가 내 id 와 일치해도 distributor 역할이면 false (역할 전환 공격 차단)', () => {
      // distributor 가 자신의 id=20 을 supplier_id 와 같은 스레드에서 supplier 권한 시도
      expect(threadBelongsToMe(
        { distributor_seller_id: 10, supplier_id: 20 },
        { role: 'distributor', id: 20 }, // id=20 이지만 distributor 역할 → distributor_seller_id=20 검사
      )).toBe(false)
    })

    it('distributor_seller_id=0 / id=0 경계값 — 일치해도 실제 0은 유효하지 않음이 전제(술어 자체는 같으면 true)', () => {
      // 술어는 값 비교만(유효성 검증은 라우트 레이어). 0===0 → true.
      expect(threadBelongsToMe(
        { distributor_seller_id: 0, supplier_id: 0 },
        { role: 'distributor', id: 0 },
      )).toBe(true)
    })
  })

  // ── supplier 소유권 ────────────────────────────────────────────────────────
  describe('supplier 역할', () => {
    it('supplier_id 가 내 id 와 일치 → true (본인 스레드)', () => {
      expect(threadBelongsToMe(
        { distributor_seller_id: 10, supplier_id: 20 },
        { role: 'supplier', id: 20 },
      )).toBe(true)
    })

    it('supplier_id 가 다른 제조사 → false (IDOR 차단)', () => {
      expect(threadBelongsToMe(
        { distributor_seller_id: 10, supplier_id: 77 },
        { role: 'supplier', id: 20 },
      )).toBe(false)
    })

    it('distributor_seller_id 가 내 id 와 일치해도 supplier 역할이면 false (역할 전환 공격 차단)', () => {
      // 공격자가 supplier 역할로 distributor_seller_id=10 인 스레드에 id=10 으로 접근 시도
      expect(threadBelongsToMe(
        { distributor_seller_id: 10, supplier_id: 20 },
        { role: 'supplier', id: 10 }, // id=10 이지만 supplier 역할 → supplier_id=10 검사
      )).toBe(false)
    })
  })

  // ── 교차 소유권 시나리오 ─────────────────────────────────────────────────────
  describe('교차 소유권 / 다중 스레드 구분', () => {
    it('두 개의 다른 스레드: 본인 스레드만 true', () => {
      const myThread = { distributor_seller_id: 5, supplier_id: 50 }
      const otherThread = { distributor_seller_id: 6, supplier_id: 60 }
      const me = { role: 'distributor' as const, id: 5 }
      expect(threadBelongsToMe(myThread, me)).toBe(true)
      expect(threadBelongsToMe(otherThread, me)).toBe(false)
    })

    it('공급자 입장에서 두 개의 다른 스레드: 본인 스레드만 true', () => {
      const myThread = { distributor_seller_id: 5, supplier_id: 50 }
      const otherThread = { distributor_seller_id: 5, supplier_id: 51 }
      const me = { role: 'supplier' as const, id: 50 }
      expect(threadBelongsToMe(myThread, me)).toBe(true)
      expect(threadBelongsToMe(otherThread, me)).toBe(false)
    })

    it('distributor id=10 이 supplier id=10 과 같은 숫자여도 역할로 구분', () => {
      const thread = { distributor_seller_id: 10, supplier_id: 10 }
      expect(threadBelongsToMe(thread, { role: 'distributor', id: 10 })).toBe(true)
      expect(threadBelongsToMe(thread, { role: 'supplier', id: 10 })).toBe(true)
      // 다른 id 는 역할 무관하게 false
      expect(threadBelongsToMe(thread, { role: 'distributor', id: 99 })).toBe(false)
      expect(threadBelongsToMe(thread, { role: 'supplier', id: 99 })).toBe(false)
    })
  })
})
