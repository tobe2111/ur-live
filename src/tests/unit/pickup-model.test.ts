/**
 * 📦 **픽업 정보 모델** 불변식 〔세션 ④-a〕
 *
 * ## 🔴 왜 이 값들이 지금 중요한가
 * `storage`(보관구분)는 **세션 ④-b 에서 돈을 가른다** — 냉장/냉동은 미수령 시 환불 불가,
 * 실온은 일정 기간 후 부분환불. 그 분기가 **이 파일이 뱉는 값을 그대로 읽는다.**
 *
 * ⇒ 값 집합이 흔들리면(문자열이 늘거나 표기가 달라지면) **환불 판정이 흔들린다.**
 *   지금 `'cold' | 'room'` 두 개로 고정하고, **모르는 값은 `null`** 로 떨군다 —
 *   ④-b 는 `null` 을 보수적으로 처리하면 되지만, `'chilled'` 같은 낯선 값을 받으면 **조용히 오분류**한다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - ④-b 의 환불 분기 자체(그건 그 세션의 머니 테스트 몫)
 *   - 운영자가 보관구분을 **잘못 고르는 것**(사람의 판단)
 *   - 법무 확인 전 임시 고지 문구의 **법적 적합성**(X4c 대기)
 */
import { describe, it, expect } from 'vitest'
import {
  parsePickup, pickupToMeta, validatePickup, isEmptyPickup,
  STORAGE_LABEL, STORAGE_NOTICE, PICKUP_META_KEYS,
} from '@/shared/pickup'

describe('🔴 보관구분 — 모르는 값은 추측하지 않는다', () => {
  it('알려진 값만 통과', () => {
    expect(parsePickup({ pickup_storage: 'cold' }).storage).toBe('cold')
    expect(parsePickup({ pickup_storage: 'room' }).storage).toBe('room')
    expect(parsePickup({ pickup_storage: 'COLD' }).storage).toBe('cold')   // 대소문자 무시
  })

  it('🔴 낯선 값은 null — 조용한 오분류를 막는다', () => {
    // `'chilled'` 를 `cold` 로 넘겨짚으면 ④-b 가 "환불 불가"로 잘못 판정할 수 있다.
    for (const v of ['chilled', 'frozen', 'ROOM_TEMP', '냉장', '', '  ', undefined]) {
      expect(parsePickup({ pickup_storage: v as string }).storage).toBeNull()
    }
  })

  it('라벨·고지가 두 값 **모두**에 있다 — 빠지면 화면이 빈다', () => {
    for (const k of ['cold', 'room'] as const) {
      expect(STORAGE_LABEL[k]).toBeTruthy()
      expect(STORAGE_NOTICE[k]).toBeTruthy()
    }
    // 값 집합이 늘면 여기서 먼저 걸린다 — 그때 ④-b 환불 분기도 함께 고쳐야 한다.
    expect(Object.keys(STORAGE_LABEL).sort()).toEqual(['cold', 'room'])
  })
})

describe('저장·복원', () => {
  it('왕복해도 값이 보존된다', () => {
    const p = { date: '2026-08-10', place: '동네상회 1층', storage: 'cold' as const }
    expect(parsePickup(pickupToMeta(p))).toEqual(p)
  })

  it('🔴 null 은 빈 문자열로 내려 **기존 값을 지운다**', () => {
    // 키를 아예 빼면 옛 값이 남아 "지웠는데 그대로"가 된다(gb 세션의 off 청소와 같은 방침).
    const meta = pickupToMeta({ date: null, place: null, storage: null })
    expect(meta[PICKUP_META_KEYS.date]).toBe('')
    expect(meta[PICKUP_META_KEYS.storage]).toBe('')
  })

  it('빈 상태를 알아본다 — 화면이 빈 껍데기를 안 그리게', () => {
    expect(isEmptyPickup(parsePickup(null))).toBe(true)
    expect(isEmptyPickup({ date: '2026-08-10', place: null, storage: null })).toBe(false)
  })
})

describe('🔴 픽업일은 공구 마감 이후여야 한다', () => {
  const deadline = '2026-08-10T10:00:00Z'

  it('마감 전 픽업일은 거부 — 안 끝난 공구를 받으러 오라는 말이 된다', () => {
    const v = validatePickup({ date: '2026-08-01', place: null, storage: 'room' }, deadline)
    expect(v.ok).toBe(false)
  })

  it('마감 이후는 통과', () => {
    expect(validatePickup({ date: '2026-08-15', place: null, storage: 'room' }, deadline).ok).toBe(true)
  })

  it('마감 당일은 통과 — 실제로 흔한 운영이다', () => {
    expect(validatePickup({ date: '2026-08-10T18:00:00Z', place: null, storage: 'cold' }, deadline).ok).toBe(true)
  })

  it('마감을 모르면 그 검사만 건너뛴다 — 저장 자체를 막지 않는다', () => {
    expect(validatePickup({ date: '2026-08-01', place: null, storage: 'room' }).ok).toBe(true)
  })

  it('형식이 틀리면 거부', () => {
    expect(validatePickup({ date: '내일', place: null, storage: null }).ok).toBe(false)
  })
})
