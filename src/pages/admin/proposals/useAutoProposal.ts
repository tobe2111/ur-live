/**
 * 📄 어드민 소개서 — 자동 생성 최신본을 먼저 쓰고, 없으면 저장소의 판으로 내려간다 (2026-11-02)
 *
 * 대표 *"제안서는 계속 자동 업데이트가 안돼"* → *"응 진행해줘. 가장 이상적으로."*
 *
 * 워크플로 `proposals.yml` 이 매일 라이브 숫자로 덱을 다시 만들어 GitHub Release 에 올린다. 이 훅은 워커
 * (`/api/admin/proposals/*`, 어드민 인증)를 거쳐 그 기록(manifest)과 PDF 를 받는다.
 *
 * 🔑 PDF 를 `<iframe src>` 로 바로 열 수 없다 — 어드민 인증이 Bearer 헤더라 iframe 요청에 안 실린다.
 *    그래서 blob 으로 받아 object URL 을 만든다(탭을 바꾸거나 화면을 떠나면 해제한다 — 안 하면 PDF 가 메모리에 쌓인다).
 *
 * 🔴 실패를 숨기지 않는다: 자동 생성본을 못 받으면 `mode: 'fallback'` 이고 화면이 *"저장된 판"* 이라고 말한다.
 *    조용히 옛 PDF 를 보여 주는 것이 이 작업이 고치려던 사고다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export interface ProposalWarning {
  id: string
  decks: string[]
  message: string
}

export interface ProposalManifest {
  builtAt: string
  commit: string
  facts: { measuredAt: string; activeVouchers: number; realStores: number }
  decks: Array<{ name: string; pdf: string; pptx: string; pages: number }>
  warnings: ProposalWarning[]
}

export type AutoState =
  | { mode: 'loading' }
  | { mode: 'auto'; manifest: ProposalManifest }
  | { mode: 'fallback'; reason: string }

/** 자동 생성 기록 — 화면에 한 번. */
export function useProposalManifest(): AutoState {
  const [state, setState] = useState<AutoState>({ mode: 'loading' })
  useEffect(() => {
    let alive = true
    api
      .get('/api/admin/proposals/manifest')
      .then((res) => {
        if (!alive) return
        const m = res.data?.data as ProposalManifest | undefined
        if (res.data?.success && m && Array.isArray(m.decks) && m.decks.length > 0) setState({ mode: 'auto', manifest: m })
        else setState({ mode: 'fallback', reason: '자동 생성본이 아직 없습니다' })
      })
      .catch(() => {
        if (alive) setState({ mode: 'fallback', reason: '자동 생성본을 불러오지 못했습니다' })
      })
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** 덱 이름(`urdeal-…`)의 자동 생성 PDF 를 blob URL 로. 없으면 null(호출부가 저장된 판을 쓴다). */
export function useAutoPdf(name: string, enabled: boolean): { url: string | null; failed: boolean } {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setUrl(null)
    setFailed(false)
    if (!enabled) return
    let alive = true
    let made: string | null = null
    api
      .get(`/api/admin/proposals/file/${name}.pdf`, { responseType: 'blob' })
      .then((res) => {
        if (!alive) return
        made = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        setUrl(made)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [name, enabled])
  return { url, failed }
}

/** `/static/proposals/urdeal-x.pdf` → `urdeal-x` */
export function deckNameOf(staticUrl: string): string {
  return staticUrl.split('/').pop()!.replace(/\.pdf$/, '')
}
