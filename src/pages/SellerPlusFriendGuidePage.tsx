/**
 * 🛡️ 2026-05-27 (사용자 결정): 셀러 — 카카오 알림톡 plus친구 등록 안내.
 *
 * 사용자가 매장 방문 / 결제 / 사용 시 카카오 알림톡 자동 발송 받으려면
 * 사장님이 본인 카카오에 유어딜 plus친구 추가 필수.
 * 추가는 무료. 발송 비용은 유어딜 부담 (Aligo 통합).
 */

import { Link } from 'react-router-dom'
import { useState } from 'react'
import SEO from '@/components/SEO'

const PLUS_FRIEND_KEY = 'seller_plus_friend_added_v1'
// 🛡️ 2026-05-27: 카카오 채널 URL — env 우선, fallback default.
//   Vite 빌드 시 import.meta.env.VITE_KAKAO_CHANNEL_URL 치환 (Cloudflare Pages env 등록).
const KAKAO_CHANNEL_URL = (import.meta.env.VITE_KAKAO_CHANNEL_URL as string | undefined) || 'https://pf.kakao.com/'
const KAKAO_CHANNEL_ID = (import.meta.env.VITE_KAKAO_CHANNEL_ID as string | undefined) || '@유어딜'

export default function SellerPlusFriendGuidePage() {
  const [confirmed, setConfirmed] = useState(false)

  function markAsAdded() {
    try { localStorage.setItem(PLUS_FRIEND_KEY, '1') } catch { /* ignore */ }
    setConfirmed(true)
  }

  return (
    <>
      <SEO title="카카오 알림톡 plus친구 등록 - 유어딜" description="사장님 카카오에 유어딜 plus친구 추가하기" url="/seller/plus-friend-guide" />
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link to="/seller" className="text-gray-500 text-sm">← 셀러</Link>
            <h1 className="text-lg font-bold text-gray-900">카카오 알림톡 등록</h1>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-xl font-bold text-gray-900 mb-2">📱 왜 등록해야 하나요?</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              사용자가 매장 방문 / 결제 / 바우처 사용 시 사장님께 카카오 알림톡이 자동 발송됩니다.
              <br/><br/>
              <strong className="text-pink-600">발송 비용은 유어딜이 부담</strong> — 사장님은 plus친구 추가만 하면 됩니다.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">3단계 등록</h2>
            <div className="space-y-3">
              {[
                { n: 1, title: '카카오톡 앱 열기', desc: '본인 카카오톡 앱 실행' },
                { n: 2, title: '유어딜 채널 추가', desc: `친구 검색 → "${KAKAO_CHANNEL_ID}" 또는 아래 버튼 클릭` },
                { n: 3, title: '"채널 추가" 버튼', desc: '채널 페이지 진입 후 "채널 추가" 클릭' },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-pink-500 text-white text-sm font-bold flex items-center justify-center">
                    {s.n}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={KAKAO_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={markAsAdded}
              className="block w-full text-center mt-4 py-3 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl font-bold text-sm transition-colors"
            >
              💬 유어딜 카카오 채널 열기
            </a>
          </section>

          <section className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>💡 안내:</strong> 채널 추가 후 이 페이지로 돌아와서 아래 "추가 완료" 버튼을 눌러주세요.
              그래야 onboarding 진행률이 업데이트됩니다.
            </p>
          </section>

          <div className="flex gap-2">
            <Link
              to="/seller"
              className="flex-1 text-center py-3 bg-gray-100 text-gray-900 rounded-xl font-bold text-sm"
            >
              나중에
            </Link>
            <button
              onClick={() => { markAsAdded(); window.location.href = '/seller' }}
              disabled={confirmed}
              className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm"
            >
              {confirmed ? '✓ 완료' : '✓ 추가 완료'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
