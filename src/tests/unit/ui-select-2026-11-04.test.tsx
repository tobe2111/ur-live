// @vitest-environment jsdom
/**
 * 🪟 유어딜 선택창 `<Select>` — 기본 `<select>` 를 태그 이름만 바꿔 대체한다 (2026-11-04).
 * 기존 핸들러(`(e) => set(e.target.value)`)가 **수정 없이** 돌아야 한다 — 81파일을 그 전제로 바꿨다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { Select } from '@/components/ui/select'

afterEach(cleanup)

describe('<Select>', () => {
  it('고른 값의 글을 보여 주고, 누르면 목록이 뜨고, 고르면 e.target.value 로 알린다', () => {
    const onChange = vi.fn()
    render(
      <Select value="b" onChange={(e) => onChange(e.target.value)} aria-label="은행">
        <option value="">선택</option>
        <option value="a">국민</option>
        <option value="b">신한</option>
      </Select>,
    )
    const btn = screen.getByRole('combobox', { name: '은행' })
    expect(btn.textContent).toContain('신한')
    fireEvent.click(btn)
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeTruthy()
    fireEvent.click(screen.getByText('국민'))
    expect(onChange).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('같은 값을 다시 고르면 onChange 를 부르지 않는다 · 배열·Fragment·optgroup 자식을 납작하게 읽는다', () => {
    const onChange = vi.fn()
    const list = ['x', 'y']
    render(
      <Select value="y" onChange={onChange} aria-label="고르기">
        <>
          <optgroup label="그룹">{list.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}</optgroup>
        </>
      </Select>,
    )
    fireEvent.click(screen.getByRole('combobox', { name: '고르기' }))
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('option')[1].querySelector('button')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('숫자 value 도 문자열로 맞춰 고른 것을 찾는다 · disabled 면 안 열린다', () => {
    render(
      <Select value={2} onChange={() => {}} aria-label="밴드" disabled>
        <option value={1}>하나</option>
        <option value={2}>둘</option>
      </Select>,
    )
    const btn = screen.getByRole('combobox', { name: '밴드' })
    expect(btn.textContent).toContain('둘')
    fireEvent.click(btn)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('name 이 있으면 폼 제출용 숨은 입력을 둔다', () => {
    const { container } = render(
      <Select name="bank" defaultValue="a" aria-label="은행">
        <option value="a">국민</option>
      </Select>,
    )
    const hidden = container.querySelector('input[type="hidden"][name="bank"]') as HTMLInputElement
    expect(hidden?.value).toBe('a')
  })
})
