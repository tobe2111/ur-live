import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'

/**
 * 🔗 2026-07-27 크리에이터 시작 페이지 (`/creators/start?ic=CODE`) — 신청 ↔ 가입을 잇는 다리.
 *
 *   온보딩 메일·신청완료 화면·어드민 모집 안내가 전부 이 URL 로 보낸다. 여기서 초대 코드를
 *   내 계정에 연결(`POST /api/creator-claim`)해야 "신청한 사람이 실제로 가입했는가 / 첫 판매를 했는가"가
 *   측정된다(그 전엔 맨 /login 링크라 추적이 끊겼다).
 *
 *   ⚠️ 코드는 **localStorage 에 먼저 저장**한 뒤 로그인으로 보낸다 — returnUrl 의 query 는
 *   safeInternalPath 화이트리스트(ref/aff/invite)에 없어 왕복 중 제거되기 때문(카카오 경로는 잠금 파일이라
 *   화이트리스트를 늘리지 않고 자체 보관으로 해결).
 *   로그인 여부는 클라가 추측하지 않고 **서버 응답(401 need_login)** 으로 판단한다.
 *   라이트 고정 standalone → 루트 div 에 force-light-theme.
 */
const LS_KEY = 'ur_creator_ic'
const CODE_RE = /^[A-Z0-9]{8,32}$/

type Phase = 'checking' | 'need_login' | 'done' | 'error'

export default function CreatorStartPage() {
  const [sp] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('checking')
  const [msg, setMsg] = useState('')
  const fired = useRef(false) // 1회만 — 재렌더/StrictMode 이중실행이 rate-limit 을 갉아먹지 않게

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const raw = (sp.get('ic') || '').trim().toUpperCase()
    if (CODE_RE.test(raw)) { try { localStorage.setItem(LS_KEY, raw) } catch { /* 사파리 프라이빗 등 — 쿼리값으로 진행 */ } }
    const code = CODE_RE.test(raw) ? raw : (() => { try { return localStorage.getItem(LS_KEY) || '' } catch { return '' } })()
    if (!CODE_RE.test(code)) { setPhase('error'); setMsg('초대 링크가 올바르지 않습니다. 메일에 있는 링크를 다시 눌러주세요.'); return }
    let alive = true
    api.post('/api/creator-claim', { code })
      .then(r => {
        if (!alive) return
        if (r.data?.success) { try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }; setPhase('done') }
        else { setPhase('error'); setMsg(r.data?.error || '연결에 실패했습니다.') }
      })
      .catch((e: unknown) => {
        if (!alive) return
        const ax = e as { response?: { status?: number; data?: { error?: string; need_login?: boolean } } }
        if (ax.response?.status === 401 || ax.response?.data?.need_login) { setPhase('need_login'); return }
        // 409(다른 계정에 연결됨) 등 — 코드는 지우지 않는다(올바른 계정으로 다시 시도 가능).
        setPhase('error'); setMsg(ax.response?.data?.error || '연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
      })
    return () => { alive = false }
  }, [sp])

  const btn = 'inline-block rounded-lg px-5 py-3 text-sm font-semibold'

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 py-14 px-4">
      <SEO title="크리에이터 시작하기 - 유어딜" description="유어딜 제휴 크리에이터로 시작합니다. 카카오 로그인 1분이면 내 링크샵이 만들어집니다." url="/creators/start" />
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        {phase === 'checking' && (
          <>
            <div className="text-3xl mb-3">⏳</div>
            <div className="text-base font-semibold text-gray-900">확인 중입니다…</div>
          </>
        )}

        {phase === 'need_login' && (
          <>
            <div className="text-3xl mb-3">👋</div>
            <h1 className="text-lg font-bold text-gray-900">크리에이터 시작하기</h1>
            <p className="mt-2 text-sm text-gray-600">카카오 로그인 1분이면 내 링크샵이 자동으로 만들어집니다.<br />로그인하면 신청 내역과 자동으로 연결됩니다.</p>
            {/* 코드는 이미 localStorage 에 있으므로 returnUrl 은 경로만으로 충분(돌아오면 자동 연결). */}
            <a href="/login?returnUrl=%2Fcreators%2Fstart" className={`${btn} mt-5 bg-[#FEE500] text-[#3C1E1E]`}>카카오로 로그인하고 시작하기</a>
            <p className="mt-3 text-xs text-gray-500">이미 유어딜 계정이 있어도 같은 버튼으로 로그인하시면 됩니다.</p>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="text-4xl mb-3">🎉</div>
            <h1 className="text-lg font-bold text-gray-900">시작 준비가 끝났습니다</h1>
            <p className="mt-2 text-sm text-gray-600">내 링크샵이 준비됐어요. 소개하고 싶은 딜을 담고 링크만 공유하면 됩니다.</p>
            <div className="mt-5 flex flex-col gap-2">
              <a href="/group-buy" className={`${btn} bg-gray-900 text-white`}>딜 둘러보고 담기</a>
              <a href="/u/me" className={`${btn} border border-gray-300 text-gray-900`}>내 링크샵 보기</a>
            </div>
            <p className="mt-3 text-xs text-gray-500">소개비는 딜마다 표시되며, 내 링크로 판매될 때 적립됩니다.</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="text-3xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-gray-900">연결하지 못했습니다</h1>
            <p className="mt-2 text-sm text-gray-600">{msg}</p>
            <div className="mt-5 flex flex-col gap-2">
              <a href="/creators" className={`${btn} bg-gray-900 text-white`}>제휴 안내 보기</a>
              <a href="/creators/apply" className={`${btn} border border-gray-300 text-gray-900`}>제휴 신청하기</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
