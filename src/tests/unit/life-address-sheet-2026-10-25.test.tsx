/**
 * 🩸 2026-10-25 대표 신고 "주소 입력하는데 계속 이렇게 떠"(오류 화면, /life/request/signage).
 * 주소 검색창을 붙일 때 React 가 그린 글자를 `innerHTML = ''` 로 지워, 주소를 고르는 순간 시트가 바뀌며
 * React 가 없는 노드를 치우려다 `removeChild` 오류를 냈다. 여기선 진짜로 렌더하고 주소를 골라 본다.
 * ⚠️ 못 보는 것: 실제 다음 우편번호 스크립트(가짜로 대신한다).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { AddressSheet } from '@/pages/life/request/AddressSheet'

describe('주소 시트', () => {
  it('주소를 고르면 상세 주소 단계로 넘어가고 오류가 안 난다', async () => {
    let complete: ((d: Record<string, string>) => void) | null = null
    ;(window as unknown as { daum: unknown }).daum = {
      Postcode: class {
        constructor(o: { oncomplete: (d: Record<string, string>) => void }) { complete = o.oncomplete }
        embed(el: HTMLElement) { const f = document.createElement('iframe'); el.appendChild(f) }
      },
    }
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AddressSheet f={{ key: 'address', label: '가게 주소', type: 'region', required: true }} onDone={() => {}} onClose={() => {}} />)
    await waitFor(() => expect(complete).not.toBeNull())
    act(() => complete!({ sido: '서울', sigungu: '마포구', bname: '망원동', roadAddress: '서울 마포구 망원로 1', jibunAddress: '' }))
    expect(await screen.findByText('상세 주소를 알려 주세요')).toBeTruthy()
    onError.mockRestore()
  })
  it('검색창을 붙이는 칸의 내용을 직접 지우지 않는다', () => {
    const src = readFileSync('src/pages/life/request/AddressSheet.tsx', 'utf8').replace(/\/\/.*$/gm, '')
    expect(src).not.toMatch(/\.innerHTML\s*=/)
  })
})

describe('PC 상단 "생활" 버튼', () => {
  it('홈 목록 필터가 아니라 생활 서비스 페이지로 간다(대표 "왜 여기로 이동되지?")', () => {
    const nav = readFileSync('src/components/main/DesktopTopNav.tsx', 'utf8')
    expect(nav).toContain("navigate(isLife ? '/life'")
    expect(nav).toContain("const isLife = key === 'home_voucher'")
  })
})
