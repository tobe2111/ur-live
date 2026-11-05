// @vitest-environment jsdom
/**
 * 🗓️ 유어딜 날짜·시간 입력 `<DateInput>` — 기본 `<input type="date|time|datetime-local">` 를 태그 이름만 바꿔 대체한다 (2026-11-05).
 * 기존 핸들러(`(e) => set(e.target.value)`)가 **수정 없이** 돌아야 하고, 값 형식이 기본 입력과 같아야 한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { DateInput } from '@/components/ui/date-input'

afterEach(cleanup)

describe('<DateInput>', () => {
  it('날짜: 고른 값을 YYYY.MM.DD (요일) 로 보여 주고, 날을 고르면 YYYY-MM-DD 로 알린다', () => {
    const onChange = vi.fn()
    render(<DateInput type="date" value="2026-11-05" onChange={(e) => onChange(e.target.value)} aria-label="시작일" />)
    const btn = screen.getByRole('button', { name: '시작일' })
    expect(btn.textContent).toContain('2026.11.05 (목)')
    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('button', { name: '2026-11-20' }))
    expect(onChange).toHaveBeenCalledWith('2026-11-20')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('날짜: min 이전 날은 못 고른다 · 다음 달로 넘어간다', () => {
    render(<DateInput type="date" value="2026-11-05" min="2026-11-10" onChange={() => {}} aria-label="날" />)
    fireEvent.click(screen.getByRole('button', { name: '날' }))
    expect((screen.getByRole('button', { name: '2026-11-09' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByText('2026년 12월')).toBeTruthy()
  })

  it('시간: 시를 고르고 분을 고르면 HH:MM 으로 알린다', () => {
    const onChange = vi.fn()
    render(<DateInput type="time" value="" onChange={(e) => onChange(e.target.value)} aria-label="여는 시간" />)
    fireEvent.click(screen.getByRole('button', { name: '여는 시간' }))
    fireEvent.click(screen.getByRole('button', { name: '09시' }))
    fireEvent.click(screen.getByRole('button', { name: '30분' }))
    expect(onChange).toHaveBeenCalledWith('09:30')
  })

  it('날짜+시간: 날짜를 고르면 시간으로 넘어가고, 값은 YYYY-MM-DDTHH:MM', () => {
    const onChange = vi.fn()
    render(<DateInput type="datetime-local" value="2026-11-05T18:00" onChange={(e) => onChange(e.target.value)} aria-label="마감" />)
    const btn = screen.getByRole('button', { name: '마감' })
    expect(btn.textContent).toContain('2026.11.05 (목) 18:00')
    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('button', { name: '2026-11-07' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '21시' }))
    fireEvent.click(screen.getByRole('button', { name: '00분' }))
    expect(onChange).toHaveBeenCalledWith('2026-11-07T21:00')
  })

  it('disabled 면 안 열린다 · name 이 있으면 폼 제출용 숨은 입력을 둔다', () => {
    const { container } = render(<DateInput type="date" name="d" defaultValue="2026-01-02" disabled aria-label="막힌 날" />)
    fireEvent.click(screen.getByRole('button', { name: '막힌 날' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((container.querySelector('input[type="hidden"][name="d"]') as HTMLInputElement).value).toBe('2026-01-02')
  })
})
