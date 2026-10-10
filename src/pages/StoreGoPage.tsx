/**
 * 🔗 `/store/go?s=<매장>&to=<화면>` — 사장님 문자의 링크가 도착하는 자리 (2026-10-10)
 *
 * 로그인(카카오)은 `ProtectedRoute requireUser` 가 맡고 돌아올 주소도 실어 준다. 이 화면은
 * 그 다음 두 가지만 한다: 그 매장 좌석에 앉고(`enterStoreSeat` — 권한은 서버가 판정), 목적 화면으로 간다.
 * 링크 규칙(매장 번호·화면 이름)은 `shared/store-deep-link.ts` 한 곳에 있다.
 *
 * 실패하면 **이유를 단정하지 않는다** — 다른 카카오 계정으로 들어왔을 수도, 권한이 회수됐을 수도 있다.
 * 마이(`/user/profile` — '내 가게' 구역)로 보내 거기서 고르게 한다. `/seller/stores` 는 셀러 토큰이
 *   있어야 열려서 여기서 보내면 셀러 비밀번호 로그인 벽이 된다(막다른 길을 만들지 않는다).
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandLoader from '@/components/brand/BrandLoader'
import SEO from '@/components/SEO'
import { enterStoreSeat } from '@/utils/enter-store'
import { parseStoreGo } from '@/shared/store-deep-link'

export default function StoreGoPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const { sellerId, path } = parseStoreGo(search)
    if (!sellerId) { navigate('/user/profile', { replace: true }); return }
    enterStoreSeat(sellerId).then((ok) => {
      if (!alive) return
      if (ok) navigate(path, { replace: true })
      else setFailed(true)
    })
    return () => { alive = false }
  }, [search, navigate])

  if (!failed) return <BrandLoader fullScreen />

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] flex items-center justify-center px-6">
      <SEO title="매장 열기 - 유어딜" description="사장님 매장 바로가기" url="/store/go" />
      <div className="w-full max-w-sm text-center">
        <p className="text-[17px] font-bold text-gray-900 dark:text-white">이 매장을 열 수 없어요</p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
          지금 로그인한 카카오 계정에 이 매장 관리 권한이 없거나, 권한이 바뀌었을 수 있어요.
          마이의 ‘내 가게’에서 다시 골라 주세요.
        </p>
        <button
          type="button"
          onClick={() => navigate('/user/profile', { replace: true })}
          className="ur-btn ur-btn-primary w-full mt-6"
        >
          마이에서 내 가게 고르기
        </button>
      </div>
    </div>
  )
}
