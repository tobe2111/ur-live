/**
 * 📄 2026-08-30 (대표 요청): 대외 제안서를 어드민에서 열람하고 PDF 로 내려받는다.
 *
 *   repo 의 제안서 원본(docs/business/proposals/*.html)을 `?raw` 로 가져온다 → 배포마다 자동 동기화.
 *   AdminPlatformModelPage 가 SSOT 문서에 쓰는 것과 같은 패턴이라 별도 DB 도, 업로드 절차도 없다.
 *
 *   ⚠️ PDF 를 서버에서 만들지 않는다. 슬라이드 원본이 이미 `@page 13.333in x 7.5in`(16:9)로 짜여 있어
 *      브라우저 인쇄 대화상자의 "PDF로 저장" 이 8장을 그대로 뽑는다. 워커 부담 0, 폰트도 그대로.
 *
 *   ⚠️ 미리보기는 srcDoc iframe 이다. CSP(script-src nonce)가 인라인 스크립트를 막으므로 제안서 안에는
 *      스크립트가 없고, 화면 배율은 이 페이지가 transform 으로 준다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import influencerHtml from '../../../docs/business/proposals/influencer-proposal.html?raw'
import { FileText, Printer, Maximize2 } from 'lucide-react'

const SHEET_W = 1280 // 제안서 슬라이드 폭(원본 CSS 와 동일해야 배율이 맞는다)

const PROPOSALS = [
  {
    key: 'influencer',
    label: '인플루언서 제휴',
    src: influencerHtml,
    summary: '매장이 제안하는 딜 커미션과 영입 커미션 2%(직접 입점 매장, 1년), 이용 흐름과 정산 조건.',
    audience: '인플루언서 · 크리에이터',
    slides: 8,
  },
] as const

type Key = (typeof PROPOSALS)[number]['key']

export default function AdminProposalsPage() {
  const [tab, setTab] = useState<Key>('influencer')
  const active = PROPOSALS.find(p => p.key === tab) ?? PROPOSALS[0]

  const boxRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [scale, setScale] = useState(1)
  const [deckH, setDeckH] = useState(0)

  // 패널 폭에 맞춰 배율을 잡는다. 축소만 하고 확대는 하지 않는다(1280 이 원본 폭).
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => setScale(Math.min(1, box.clientWidth / SHEET_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  // srcDoc 은 부모와 같은 출처라 문서 높이를 직접 읽을 수 있다(하드코딩보다 안전).
  const onFrameLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (doc) setDeckH(doc.body.scrollHeight)
  }, [])

  const print = useCallback(() => {
    const win = frameRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }, [])

  const openFull = useCallback(() => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.open()
    win.document.write(active.src)
    win.document.close()
  }, [active.src])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-extrabold text-gray-900">대외 제안서</h1>
      </div>
      <p className="text-[13px] text-gray-500 mb-4">
        <code className="px-1 rounded bg-gray-100 text-[0.85em]">docs/business/proposals/</code> 의 원본을 그대로 띄웁니다.
        문서를 고쳐 배포하면 이 화면도 자동으로 최신본이 됩니다.
      </p>

      {PROPOSALS.length > 1 && (
        <div className="flex gap-1.5 mb-4 border-b border-gray-200">
          {PROPOSALS.map(p => (
            <button
              key={p.key}
              onClick={() => setTab(p.key)}
              className={`px-3.5 py-2 text-[13px] font-bold -mb-px border-b-2 transition-colors ${
                tab === p.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-gray-900">{active.label} 제안서</p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">{active.summary}</p>
            <p className="text-[11.5px] text-gray-400 mt-1">
              대상 {active.audience} · 슬라이드 {active.slides}장 · 16:9
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openFull}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-bold text-gray-700 hover:bg-gray-50"
            >
              <Maximize2 className="w-4 h-4" />
              새 창에서 보기
            </button>
            <button
              onClick={print}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-bold hover:bg-gray-800"
            >
              <Printer className="w-4 h-4" />
              PDF로 저장
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[12px] text-gray-500">
            인쇄 대화상자에서 대상을 <b className="text-gray-700">PDF로 저장</b>, 용지 방향을 <b className="text-gray-700">가로</b>,
            여백을 <b className="text-gray-700">없음</b>으로 두면 슬라이드가 잘리지 않습니다.
          </p>
        </div>

        <div ref={boxRef} className="overflow-auto bg-[#EFEBE8]" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <div style={{ width: SHEET_W * scale, height: deckH * scale }}>
            <iframe
              ref={frameRef}
              title={`${active.label} 제안서`}
              srcDoc={active.src}
              onLoad={onFrameLoad}
              style={{
                width: SHEET_W,
                height: deckH || 800,
                border: 0,
                display: 'block',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
