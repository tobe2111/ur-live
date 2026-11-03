/**
 * 🏠 견적 요청서 — 다음 버튼 · 여러 착공일 · 주소칸 높이 〔2026-11-03 대표〕
 *   *"착공 희망일은 여러개 선택할 수 있게 해줘야지"*
 *   *"휙휙 지나가서 뭘 선택했는지 잘 모르겠어 … 옵션 선택하면 아래에 다음 버튼"*
 *   *"주소입력하는 란 때문에 아래가 안보이고 이동이 안되는"*
 *
 * 지키는 것
 *   ① 선택지를 눌러도 넘어가지 않는다 — 표시만 되고 '다음' 을 눌러야 넘어간다
 *   ② 착공 희망일은 여러 날(최대 5)을 고르고, 서버가 정렬·검증하며 요청 날짜는 가장 늦은 날
 *   ③ 날짜 하나짜리 칸은 종전대로 쉼표를 거절
 *   ④ 주소 검색칸은 고정 60dvh 가 아니라 남은 자리를 채운다
 * 못 보는 것: 실제 폰에서 다음 우편번호 화면이 손가락으로 끝까지 내려가는지(외부 iframe) — 폰으로 본다.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { OptionSheet } from '@/pages/life/request/FieldSheets'
import { DateSheet } from '@/pages/life/request/DateSheet'
import { validateRequest, categoryDef, MAX_MULTI_DATES } from '@/shared/home-service'

const sel = { key: 'work', label: '어떤 공사인가요', type: 'select', required: true, options: ['새로 여는 가게', '부분 리모델링'] } as const

describe('① 선택지는 다음 버튼으로 넘어간다', () => {
  it('누르면 표시만 되고, 다음을 눌러야 onPick', () => {
    const onPick = vi.fn()
    const { getByText } = render(<OptionSheet f={sel as never} value="" onPick={onPick} onClose={() => {}} />)
    const next = getByText('다음') as HTMLButtonElement
    expect(next.disabled).toBe(true)
    fireEvent.click(getByText('부분 리모델링'))
    expect(onPick).not.toHaveBeenCalled()
    expect(getByText('부분 리모델링').closest('button')?.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(next)
    expect(onPick).toHaveBeenCalledWith('부분 리모델링')
  })
})

describe('② 착공 희망일 여러 개', () => {
  it('인테리어 두 요청서의 착공 희망일은 multiple', () => {
    for (const k of ['store_interior', 'home_interior']) {
      const f = categoryDef(k)?.fields.find((x) => x.key === 'date')
      if (!f) continue
      expect(f.label === '착공 희망일' ? f.multiple : true).toBe(true)
    }
  })
  it('달력에서 두 날을 고르면 쉼표로 넘긴다', () => {
    const onDone = vi.fn()
    const f = { key: 'date', label: '착공 희망일', type: 'date', required: true, multiple: true }
    const { getAllByRole, getByText } = render(<DateSheet f={f as never} value="" onDone={onDone} onClose={() => {}} />)
    const days = getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent || '') && !(b as HTMLButtonElement).disabled)
    fireEvent.click(days[days.length - 1]); fireEvent.click(days[days.length - 2])
    fireEvent.click(getByText(/2일 고르고 다음/))
    const v = String(onDone.mock.calls[0][0])
    expect(v.split(', ')).toHaveLength(2)
    expect(v.split(', ')[0] < v.split(', ')[1]).toBe(true)
  })
  it('서버: 정렬·중복 제거 · 가장 늦은 날이 요청 날짜 · 최대 개수', () => {
    const def = categoryDef('store_interior')!
    const base: Record<string, string> = { address: '서울 마포구 서교동', biz: def.fields.find((f) => f.key === 'biz')!.options![0], work: '새로 여는 가게', pyeong: '20', design: '업체와 상의할게요', budget: '상담 후 정할게요' }
    const parse = () => ({ sido: '서울', sigungu: '마포구' })
    const r = validateRequest('store_interior', { ...base, date: '2099-01-12, 2099-01-05, 2099-01-12' }, parse, '2026-11-03')
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.details.date).toBe('2099-01-05, 2099-01-12'); expect(r.value.desiredDate).toBe('2099-01-12') }
    const many = Array.from({ length: MAX_MULTI_DATES + 1 }, (_, i) => `2099-02-${String(i + 1).padStart(2, '0')}`).join(', ')
    expect(validateRequest('store_interior', { ...base, date: many }, parse, '2026-11-03').ok).toBe(false)
    expect(validateRequest('store_interior', { ...base, date: '2099-01-05, 2020-01-01' }, parse, '2026-11-03').ok).toBe(false)
  })
})

describe('③ 날짜 하나짜리 칸은 쉼표 거절', () => {
  it('간판 희망 설치 날짜', () => {
    const def = categoryDef('signage')!
    const df = def.fields.find((f) => f.key === def.dateField)!
    expect(df.multiple).toBeFalsy()
    const input: Record<string, string> = {}
    for (const f of def.fields) if (f.required) input[f.key] = f.type === 'select' ? f.options![0] : f.type === 'number' ? '1' : f.type === 'region' ? '서울 마포구 서교동' : 'x'
    input[def.dateField] = '2099-01-05, 2099-01-06'
    expect(validateRequest('signage', input, () => ({ sido: '서울', sigungu: '마포구' }), '2026-11-03').ok).toBe(false)
  })
})

describe('④ 주소칸 높이', () => {
  it('고정 60dvh 가 아니라 남은 자리', () => {
    const src = readFileSync('src/pages/life/request/AddressSheet.tsx', 'utf8')
    expect(src).not.toMatch(/className="[^"]*h-\[60dvh\]/)
    expect(src).toMatch(/relative h-full min-h-\[320px\] w-full/)
  })
})
