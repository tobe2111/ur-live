/**
 * 🏠 주소 시트 — 주소 검색(다음 우편번호) → 상세 주소(동·호수).
 *
 * 🔒 사장님에게는 **동까지만**(`서울 강남구 역삼동`) 간다. 도로명·동·호수는 `<키>_full` 로 따로 저장되고
 *   **손님이 고른 한 곳만** 본다(서버 `withPrivateDetails` · 오늘의집 "상세 주소는 매칭된 전문가에게만").
 * 검색 스크립트를 못 받으면(차단·오프라인) 예전처럼 "시·구·동" 을 직접 적게 한다 — 요청이 막히지 않게.
 */
import { useEffect, useRef, useState } from 'react'
import type { RequestField } from '@/shared/home-service'
import { Sheet } from './Sheet'
import { eulReul } from './FieldSheets'

const INPUT = 'w-full rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-brand'
const DAUM_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

interface PostcodeData { sido: string; sigungu: string; bname: string; roadAddress: string; jibunAddress: string; buildingName?: string }
type DaumWindow = Window & { daum?: { Postcode: new (o: { oncomplete: (d: PostcodeData) => void; width?: string; height?: string }) => { embed: (el: HTMLElement) => void } } }

function loadPostcode(): Promise<void> {
  const w = window as DaumWindow
  if (w.daum?.Postcode) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = DAUM_SRC
    s.async = true
    s.onload = () => (w.daum?.Postcode ? resolve() : reject(new Error('postcode')))
    s.onerror = () => reject(new Error('postcode'))
    document.head.appendChild(s)
    setTimeout(() => reject(new Error('timeout')), 8000)
  })
}

/** 사장님에게 보이는 부분 — 시/도 · 시군구 · 동. 세종은 시군구가 없어 '세종시' 로 채운다(지역 파서가 시·구를 요구). */
export function publicRegion(d: PostcodeData): string {
  const sigungu = d.sigungu || (/^세종/.test(d.sido) ? '세종시' : '')
  return [d.sido, sigungu, d.bname].filter(Boolean).join(' ')
}

export function AddressSheet({ f, onDone, onClose }: {
  f: RequestField
  onDone: (publicText: string, full: string) => void
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'search' | 'detail' | 'manual'>('search')
  const [picked, setPicked] = useState<PostcodeData | null>(null)
  const [detail, setDetail] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (mode !== 'search') return
    let alive = true
    loadPostcode().then(() => {
      const w = window as DaumWindow
      if (!alive || !box.current || !w.daum) return
      box.current.innerHTML = ''
      new w.daum.Postcode({
        width: '100%', height: '100%',
        oncomplete: (d: PostcodeData) => { setPicked(d); setMode('detail') },
      }).embed(box.current)
    }).catch(() => { if (alive) setMode('manual') })
    return () => { alive = false }
  }, [mode])

  if (mode === 'detail' && picked) {
    const road = picked.roadAddress || picked.jibunAddress
    const label = picked.buildingName ? `${road} (${picked.buildingName})` : road
    const finish = () => onDone(publicRegion(picked), [label, detail.trim()].filter(Boolean).join(', ').slice(0, 120))
    return (
      <Sheet
        title="상세 주소를 알려 주세요"
        onClose={onClose}
        footer={<button type="button" className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center" onClick={finish}>완료</button>}
      >
        <div className="space-y-2 pb-2">
          <button type="button" onClick={() => setMode('search')} className={`${INPUT} text-left text-gray-600 dark:text-gray-300`}>{label}</button>
          <input autoFocus className={INPUT} maxLength={40} placeholder="동·호수 (예: 101동 1402호)" value={detail}
            onChange={(e) => setDetail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') finish() }} />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">상세 주소는 고른 업체에만 공개돼요. 그 전에는 동까지만 보여요.</p>
        </div>
      </Sheet>
    )
  }

  if (mode === 'manual') {
    const ok = manual.trim().split(/\s+/).length >= 2
    return (
      <Sheet
        title={`${eulReul(f.label)} 알려 주세요`}
        onClose={onClose}
        footer={<button type="button" disabled={!ok} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-50" onClick={() => onDone(manual.trim(), '')}>완료</button>}
      >
        <input autoFocus className={INPUT} maxLength={60} placeholder="예) 서울 강남구 역삼동 (동까지만)" value={manual} onChange={(e) => setManual(e.target.value)} />
        <p className="pt-2 pb-2 text-[13px] text-gray-500 dark:text-gray-400">주소 검색을 불러오지 못해 직접 적어 주세요. 시·구까지는 꼭 적어 주세요.</p>
      </Sheet>
    )
  }

  return (
    <Sheet title={`${eulReul(f.label)} 알려 주세요`} onClose={onClose}>
      <div ref={box} className="h-[60dvh] w-full pb-2">
        <p className="py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">주소 검색을 불러오는 중</p>
      </div>
    </Sheet>
  )
}
