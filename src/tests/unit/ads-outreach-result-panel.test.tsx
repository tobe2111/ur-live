/**
 * 📬 **발송 결과 붙여넣기 화면** — 2026-08-04 대표 *"①부터 진행해줘"*.
 *
 * ## 이 테스트가 지키는 것
 * 엔드포인트(#1049)는 이미 있었는데 **화면이 없어서** 라이브 `email_status` 가 0건이었다.
 * 즉 이 기능의 실패 모드는 "서버가 틀린다"가 아니라 **"사람이 못 넣는다"** 이고, 그래서
 * 여기서 잠그는 것도 서버 계약이 아니라 **화면의 세 가지 성질**이다:
 *
 *   ① **인식 건수가 서버와 같은 파서에서 나온다** — 화면이 "인식 3건"이라 해놓고 서버가 다르게 세면
 *      그 숫자는 거짓말이다. 두 벌을 두면 반드시 갈라진다(이 레포가 반복해 경고하는 클래스).
 *   ② **결과가 화면에 남는다** — 특히 `미매칭`. 토스트로 흘리면 절반만 먹힌 업로드를 "성공"으로 읽는다.
 *   ③ **500 상한을 클라가 나눠 보낸다** — 대표가 파일을 쪼갤 이유가 없다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 대표의 메일 도구가 실제로 뱉는 파일. 열 순서는 파서 쪽에서
 *   느슨하게 받도록 했지만(`ads-outreach-status-ingest.test.ts`), 첫 업로드에서 `무시` 가 크면
 *   그 화면에 뜨는 "무시된 줄"을 보고 파서를 맞춰야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const post = vi.fn()
vi.mock('@/lib/api', () => ({ default: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import OutreachResultPanel from '@/pages/admin/influencer-pool/OutreachResultPanel'
import { OUTREACH_INGEST_MAX } from '@/features/marketing/api/outreach-status-ingest'

const SRC = readFileSync(join(process.cwd(), 'src/pages/admin/influencer-pool/OutreachResultPanel.tsx'), 'utf8')
const PAGE = readFileSync(join(process.cwd(), 'src/pages/admin/AdminInfluencerPoolPage.tsx'), 'utf8')

function openPanel() {
  const r = render(<OutreachResultPanel />)
  fireEvent.click(r.getByText('📬 발송 결과 반영'))
  return r
}
const paste = (r: ReturnType<typeof render>, text: string) =>
  fireEvent.change(r.container.querySelector('textarea')!, { target: { value: text } })

beforeEach(() => { post.mockReset() })

describe('① 인식 건수는 서버와 같은 파서에서 나온다', () => {
  it('🔒 붙여넣으면 인식 건수와 상태별 내역이 즉시 보인다', () => {
    const r = openPanel()
    paste(r, 'email,status\na@b.com,replied\nc@d.com,bounced\ne@f.com,bounced')
    expect(r.getByText('3').textContent).toBe('3')          // 인식 3행
    expect(r.getByText(/회신 1/)).toBeTruthy()
    expect(r.getByText(/반송 2/)).toBeTruthy()
  })

  it('🔒 파서를 여기서 다시 짜지 않는다 — 두 벌은 갈라진다', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*parseOutreachCsv[^}]*\}\s*from\s*'@\/features\/marketing\/api\/outreach-status-ingest'/)
  })

  it('🔒 형식이 안 맞으면 무시된 줄의 **실물**을 보여준다 — 그게 곧 진단이다', () => {
    const r = openPanel()
    paste(r, 'a@b.com,replied\n이건_형식이_다름')
    expect(r.getByText(/무시 1행/)).toBeTruthy()
    expect(r.getByText('이건_형식이_다름')).toBeTruthy()
  })
})

describe('② 결과는 화면에 남는다 — 미매칭은 조용한 0건과 구분이 안 된다', () => {
  it('🔒 적용·미매칭이 렌더된다(토스트로만 흘리지 않는다)', async () => {
    post.mockResolvedValue({ data: { success: true, applied: 2, unmatched: 1 } })
    const r = openPanel()
    paste(r, 'a@b.com,replied\nghost@x.com,bounced')
    fireEvent.click(r.getByText('2행 반영'))
    await waitFor(() => expect(r.getByText(/반영 완료/)).toBeTruthy())
    const box = r.getByText(/반영 완료/).parentElement!
    expect(box.textContent).toMatch(/적용\s*2/)
    expect(box.textContent).toMatch(/미매칭\s*1/)
  })

  it('🔒 서버가 실패를 돌려주면 그 사유가 화면에 남는다(성공으로 위장 금지)', async () => {
    post.mockResolvedValue({ data: { success: false, error: '반영 실패: 테이블 없음' } })
    const r = openPanel()
    paste(r, 'a@b.com,replied')
    fireEvent.click(r.getByText('1행 반영'))
    await waitFor(() => expect(r.getByText(/반영 실패: 테이블 없음/)).toBeTruthy())
  })
})

describe('③ 상한·배선', () => {
  it('🔒 500 을 넘으면 클라가 나눠 보낸다 — 대표가 파일을 쪼갤 이유가 없다', async () => {
    post.mockResolvedValue({ data: { success: true, applied: 1, unmatched: 0 } })
    const n = OUTREACH_INGEST_MAX + 3
    const r = openPanel()
    paste(r, Array.from({ length: n }, (_, i) => `u${i}@x.com,sent`).join('\n'))
    fireEvent.click(r.getByText(`${n.toLocaleString()}행 반영`))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(post.mock.calls[0][0]).toBe('/api/admin/ads/outreach/status')
    expect((post.mock.calls[0][1] as { items: unknown[] }).items).toHaveLength(OUTREACH_INGEST_MAX)
    expect((post.mock.calls[1][1] as { items: unknown[] }).items).toHaveLength(3)
  })

  it('🔒 페이지에 실제로 붙어 있다 — 화면이 없어서 0건이었던 게 이 기능의 실패 모드다', () => {
    expect(PAGE).toMatch(/import OutreachResultPanel from '\.\/influencer-pool\/OutreachResultPanel'/)
    // ⚠️ **"파일에 이름이 있는가"로 물으면 안 된다** — 주입 검증이 이걸 잡았다: `{false && <OutreachResultPanel />}`
    //   로 바꿔도 문자열은 그대로라 초록불이 떴다(이 레포가 잠금표에서 겪은 *"주석에만 남아도 통과"* 와 같은 함정).
    //   ⇒ **그 줄 자체**를 보고, 조건 게이트 없이 렌더되는지 확인한다. 배선이 지워지면 줄이 없어 undefined 로 빨간불.
    const line = PAGE.split('\n').find(l => l.includes('<OutreachResultPanel'))
    expect(line, '<OutreachResultPanel /> 렌더 줄이 페이지에서 사라졌다').toBeTruthy()
    expect(line).toMatch(/^\s*<OutreachResultPanel\s*\/>/)
  })

  it('🔒 어드민은 라이트 고정 — dark: variant 금지', () => {
    expect(SRC.match(/\bdark:/g)).toBeNull()
  })
})
