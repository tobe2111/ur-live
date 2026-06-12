/**
 * 🛒 2026-06-12 네이버 커머스API Phase A — 스마트스토어 연동 관리 (유통사).
 *   발급 가이드(커머스API센터) + 연결 폼(앱 ID/시크릿 — 서버가 토큰 발급으로 즉시 검증)
 *   + 연결 상태/해제. 내보내기는 상품 상세의 "스마트스토어로 내보내기" 버튼에서.
 *   WT 라이트 고정 (B2B 대시보드 계열 — dark: variant 없음).
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Store, Loader2, CheckCircle2, ExternalLink, Unplug } from 'lucide-react'
import { WT } from './wholesale-theme'
import { useIsWholesaleViewer, ViewerNotice } from './ViewerGate'

interface NaverStatus {
  connected: boolean
  client_id_masked: string | null
  connected_at: string | null
  last_export_at: string | null
  export_count: number
}

const sellerAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

export default function WholesaleNaverPage() {
  const navigate = useNavigate()
  const isViewer = useIsWholesaleViewer()
  const [status, setStatus] = useState<NaverStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/api/wholesale/naver/status', sellerAuth())
      .then(r => { if (r.data?.success) setStatus(r.data) })
      .catch(e => {
        // 401/403 — 유통회원 아님 → 카탈로그로
        const st = (e as { response?: { status?: number } })?.response?.status
        if (st === 401 || st === 403) navigate('/wholesale')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/wholesale/login'); return }
    load()
  }, [load, navigate])

  const connect = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await api.post('/api/wholesale/naver/connect', { client_id: clientId.trim(), client_secret: clientSecret.trim() }, sellerAuth())
      if (r.data?.success) {
        toast.success('스마트스토어가 연결되었습니다 🎉')
        setClientId(''); setClientSecret('')
        load()
      } else {
        toast.error(r.data?.error || '연결 실패')
      }
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패')
    } finally { setSaving(false) }
  }

  const disconnect = async () => {
    const ok = await confirmDialog({ message: '스마트스토어 연결을 해제할까요? 저장된 인증 정보가 삭제됩니다.', danger: true })
    if (!ok) return
    try {
      const r = await api.delete('/api/wholesale/naver/connect', sellerAuth())
      if (r.data?.success) { toast.success('연결이 해제되었습니다'); load() }
    } catch { toast.error('해제 실패') }
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl text-[14px] text-gray-900 outline-none'

  return (
    <div className="min-h-screen" style={{ background: WT.fill }}>
      <SEO title="스마트스토어 연동 - 유통스타트" description="네이버 스마트스토어 연동" url="/wholesale/naver" noindex />
      <header className="bg-white" style={{ borderBottom: `1px solid ${WT.line}` }}>
        <div className="ur-content-medium px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6" style={{ color: '#03C75A' }} />
            <span className="text-lg font-bold" style={{ color: WT.ink }}>스마트스토어 연동</span>
          </div>
          <button onClick={() => navigate('/wholesale/dashboard')} className="text-sm" style={{ color: WT.ink2 }}>← 대시보드</button>
        </div>
      </header>

      <main className="ur-content-medium px-4 lg:px-8 py-6 space-y-5">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : status?.connected ? (
          /* ── 연결됨 ── */
          <section className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${WT.line}` }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5" style={{ color: WT.pos }} />
              <h2 className="text-base font-bold" style={{ color: WT.ink }}>스마트스토어 연결됨</h2>
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt style={{ color: WT.ink3 }}>애플리케이션</dt><dd className="font-mono font-bold" style={{ color: WT.ink }}>{status.client_id_masked}</dd></div>
              <div className="flex justify-between"><dt style={{ color: WT.ink3 }}>연결일</dt><dd style={{ color: WT.ink2 }}>{(status.connected_at || '').slice(0, 10)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: WT.ink3 }}>내보낸 상품</dt><dd className="font-bold" style={{ color: WT.ink }}>{status.export_count}개</dd></div>
              {status.last_export_at && <div className="flex justify-between"><dt style={{ color: WT.ink3 }}>마지막 내보내기</dt><dd style={{ color: WT.ink2 }}>{status.last_export_at.replace('T', ' ').slice(0, 16)}</dd></div>}
            </dl>
            <div className="mt-5 rounded-xl p-3.5" style={{ background: WT.fill2, border: `1px solid ${WT.line}` }}>
              <p className="text-[13px] font-bold" style={{ color: WT.ink }}>이제 이렇게 쓰세요</p>
              <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: WT.ink2 }}>
                카탈로그에서 상품 상세를 열면 <b>"스마트스토어로 내보내기"</b> 버튼이 보입니다.
                판매가·재고·카테고리만 정하면 내 스토어에 바로 등록돼요.
              </p>
              <button onClick={() => navigate('/wholesale')} className="mt-3 px-4 h-10 rounded-xl text-[13px] font-bold text-white" style={{ background: WT.brand }}>
                카탈로그에서 상품 고르기 →
              </button>
            </div>
            {!isViewer && (
              <button onClick={disconnect} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: WT.ink3 }}>
                <Unplug className="w-3.5 h-3.5" /> 연결 해제
              </button>
            )}
          </section>
        ) : (
          /* ── 미연결: 가이드 + 폼 ── */
          <>
            <section className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${WT.line}` }}>
              <h2 className="text-base font-bold mb-1" style={{ color: WT.ink }}>내 스마트스토어와 연결하기</h2>
              <p className="text-[13px] mb-4 leading-relaxed" style={{ color: WT.ink2 }}>
                사입한 도매 상품을 버튼 한 번으로 내 스마트스토어에 등록할 수 있어요.
                네이버 커머스API센터에서 <b>내 스토어 애플리케이션</b>(스토어당 1개, 무료)을 만들고 ID/시크릿을 입력하세요.
              </p>
              <ol className="space-y-2 text-[13px] mb-4" style={{ color: WT.ink2 }}>
                <li>① <a href="https://apicenter.commerce.naver.com" target="_blank" rel="noreferrer" className="underline font-semibold inline-flex items-center gap-0.5" style={{ color: WT.ink }}>커머스API센터 <ExternalLink className="w-3 h-3" /></a> 에 스토어 계정으로 로그인</li>
                <li>② [애플리케이션 등록] — 이름 자유, API 그룹은 <b>전체 선택</b> 권장</li>
                <li>③ 발급된 <b>애플리케이션 ID</b> 와 <b>시크릿</b>을 아래에 입력</li>
              </ol>
              {isViewer && <div className="mb-4"><ViewerNotice action="스토어 연결" /></div>}
              <label className="block text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>애플리케이션 ID</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)} disabled={saving || isViewer}
                className={inputCls} style={{ border: `1.5px solid ${WT.line}`, background: WT.fill2, marginBottom: 12 }}
                placeholder="예: 5NKbS2VrLi..." autoComplete="off" />
              <label className="block text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>애플리케이션 시크릿</label>
              <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} disabled={saving || isViewer}
                type="password" className={inputCls} style={{ border: `1.5px solid ${WT.line}`, background: WT.fill2, marginBottom: 4 }}
                placeholder="$2a$04$..." autoComplete="off" />
              <p className="text-[11px] mb-4" style={{ color: WT.ink4 }}>시크릿은 암호화되어 저장되며, 연결 검증(토큰 발급)에 성공해야만 저장됩니다.</p>
              <button onClick={connect} disabled={saving || isViewer || !clientId.trim() || !clientSecret.trim()}
                className="w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50" style={{ background: '#03C75A' }}>
                {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 연결 확인 중...</span> : '연결하기'}
              </button>
            </section>
            <section className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${WT.line}` }}>
              <p className="text-[13px] font-bold mb-1.5" style={{ color: WT.ink }}>다음 단계 (준비 중)</p>
              <p className="text-[12.5px] leading-relaxed" style={{ color: WT.ink3 }}>
                스토어 주문 자동 수집 → 도매몰 자동 발주 → 송장 자동 등록(드랍쉬핑)은 다음 단계로 준비 중이에요.
                지금은 상품 등록(내보내기)까지 지원합니다.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
