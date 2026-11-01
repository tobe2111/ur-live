/**
 * 🖼️ 2026-11-01 상품 사진 크기별 저장 — 이미 올라간 사진을 **이 브라우저가** 세 크기로 줄여 R2 에 넣는다.
 *   (대표 *"응 잠금 해제해줄게 진행해줘"* — Cloudflare 변환 한도를 영원히 0 으로.)
 *
 * 한 장씩: 원본을 같은 출처(`/api/media/*`)로 받는다 → 캔버스로 1280·640·320 → 한 크기씩 store →
 *   commit 이 셋 다 있는지 확인한 뒤에만 상품 주소를 바꾼다. 실패한 사진은 건너뛰고 목록에 남긴다
 *   (주소가 그대로라 화면은 종전대로 뜬다 — 다음에 다시 누르면 다시 시도한다).
 * 탭을 닫으면 멈춘다. 다시 열고 누르면 남은 것부터 이어서 한다.
 */
import { useRef, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/utils/format'
import { makeSizedVariants } from '@/lib/image-sized'
import { SIZED_WIDTHS } from '@/shared/sized-image'

type Pending = { urls: string[]; remaining: number }

async function migrateOne(url: string): Promise<void> {
  const r = await fetch(url, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`원본 ${r.status}`)
  const v = await makeSizedVariants(await r.blob())
  if (!v) throw new Error('줄이기 실패')
  for (const w of [...SIZED_WIDTHS].reverse()) {
    const blob = v.files.get(w)
    if (!blob) throw new Error(`w${w} 없음`)
    const fd = new FormData()
    fd.append('file', new File([blob], `w${w}.${v.ext}`, { type: blob.type }))
    fd.append('width', String(w))
    fd.append('old', url)
    const s = await api.post('/api/admin/image-sizing/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (!s.data?.success) throw new Error(s.data?.error || `w${w} 저장 실패`)
  }
  const c = await api.post('/api/admin/image-sizing/commit', { old: url, ext: v.ext })
  if (!c.data?.success) throw new Error(c.data?.error || '주소 교체 실패')
}

export default function AdminImageSizingPage() {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [failed, setFailed] = useState<Array<{ url: string; why: string }>>([])
  const stop = useRef(false)

  async function run() {
    setRunning(true); stop.current = false
    const skip = new Set<string>()
    try {
      for (;;) {
        if (stop.current) break
        const r = await api.get<{ success: boolean; data?: Pending }>('/api/admin/image-sizing/pending', { params: { limit: 50 } })
        const p = r.data?.data
        if (!p) throw new Error('목록 실패')
        setRemaining(p.remaining)
        const todo = p.urls.filter((u) => !skip.has(u))
        if (todo.length === 0) break
        for (const url of todo) {
          if (stop.current) break
          try { await migrateOne(url); setDone((n) => n + 1); setRemaining((n) => (n == null ? n : Math.max(0, n - 1))) }
          catch (e) { skip.add(url); setFailed((f) => [...f, { url, why: (e as Error).message }]) }
        }
      }
    } catch (e) {
      setFailed((f) => [...f, { url: '(목록)', why: (e as Error).message }])
    } finally { setRunning(false) }
  }

  return (
    <AdminLayout title="사진 크기별 저장">
      <DashboardPageHeader title="상품 사진 크기별 저장" subtitle="이미 올라간 상품 사진을 세 크기로 줄여 저장합니다. 끝나면 사진 변환 한도를 쓰지 않습니다." />
      <div className="bg-white rounded-xl p-5 space-y-4 max-w-2xl">
        <p className="text-[13px] text-gray-600">이 브라우저가 사진을 한 장씩 줄여 올립니다. 탭을 닫으면 멈추고, 다시 누르면 남은 것부터 이어서 합니다.</p>
        <div className="flex gap-6 text-[15px]">
          <span>남은 사진 <b>{remaining == null ? '—' : formatNumber(remaining)}</b></span>
          <span>옮김 <b>{formatNumber(done)}</b></span>
          <span>실패 <b>{formatNumber(failed.length)}</b></span>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={running}>{running ? '옮기는 중…' : '시작'}</Button>
          {running && <Button variant="outline" onClick={() => { stop.current = true }}>멈추기</Button>}
        </div>
        {failed.length > 0 && (
          <ul className="text-[12px] text-gray-500 space-y-1 max-h-60 overflow-y-auto">
            {failed.map((f, i) => <li key={i} className="break-all">{f.why} · {f.url}</li>)}
          </ul>
        )}
      </div>
    </AdminLayout>
  )
}
