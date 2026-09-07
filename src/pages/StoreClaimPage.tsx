/**
 * 🏪 매장 등록 — 소비자 화면 어디서나 도달하는 **하나의 목적지** (2026-08-26 대표 지시)
 *
 * 대표: *"메인서비스랑 셀러대시보드 간극이 크다"* → 그리고 회색 핀 제안에 대해
 * *"회색 핀이 의미가 있나? 어차피 카카오맵으로 검색하는 거잖아"* — **맞는 지적이었다.**
 *
 * 🩸 내가 처음 만든 진입점은 지도의 회색 핀 하나였다. 그건 사장님이 **우연히 자기 가게 핀을 눌러야**
 *   발견되고, 이미 등록된(컬러 핀) 가게의 진짜 사장님에겐 길이 없다. 당근도 핀을 누르게 하지 않는다 —
 *   **이름을 입력하면 찾아 주고** "이 업체가 맞나요?"를 띄운다(시안 04). 그 검색은 우리도 이미 갖고
 *   있다(`StoreRegisterModal` 의 카카오맵 검색). 없던 건 **그 검색으로 가는 상시 문**이었다.
 *
 * ⚠️ 그래서 이 페이지는 화면이 아니라 **주소**가 목적이다. 여러 진입점(마이·푸터·소개 페이지)이
 *   전부 여기로 오게 해서, 문구가 갈려도 목적지는 하나로 유지한다.
 *
 * 🔓 셀러 가입(`/seller/register/supplier`)을 **먼저 거치지 않는다.** `POST /api/seller/stores` 가
 *   매장(sellers 행)과 운영 권한을 함께 만들므로, 소비자 계정이 바로 매장 주인이 될 수 있다 —
 *   대표 확정("대시보드 첫 단계는 매장 등록, 무조건 선행")과 같은 순서다.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
import { enterStoreSeat } from '@/utils/enter-store'
import { isLoggedInSync } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import { captureStoreReferrer } from '@/utils/store-referrer'

export default function StoreClaimPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // 🤝 소개자 초대 링크(`?ref=`)는 **로그인으로 보내기 전에** 담아야 한다.
  //   로그인 왕복에서 쿼리스트링이 사라지므로, 여기서 놓치면 소개자가 데려오고도 보상을 못 받는다.
  useEffect(() => { captureStoreReferrer(params.get('ref')) }, [params])

  // 등록은 로그인이 필요하다. 401 을 만나게 두지 말고 로그인으로 보내되 돌아올 곳을 지정한다.
  useEffect(() => {
    if (!isLoggedInSync()) navigate(`/login?returnUrl=${encodeURIComponent('/store/new')}`, { replace: true })
  }, [navigate])

  /**
   * ✕ 로 나갈 곳. `navigate(-1)` 하나로는 부족하다 — 이 페이지는 푸터·소개 페이지·카톡으로 받은
   * 링크처럼 **직접 주소로** 열리는 자리라(그게 이 페이지의 존재 이유다) 돌아갈 이력이 없을 수 있고,
   * 그때 `-1` 은 아무 일도 안 하거나 앱 밖으로 나간다. 이력이 없으면 홈으로 보낸다.
   */
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' ? idx > 0 : window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#11141C]">
      <SEO title="매장 등록 - 유어딜" description="카카오맵에서 내 가게를 찾아 유어딜에 등록하세요" noindex />
      <StoreRegisterModal
        /**
         * 🩸 2026-09-07 (대표 *"흰 섹션 바깥쪽을 클릭하니까 페이지가 꺼져"*): 여기선 모달이 곧 페이지라
         *   배경 뒤에 아무것도 없다 — 바깥 클릭은 닫을 것이 아니라 **폼을 날리는 사고**다. 닫기는 ✕ 로만.
         */
        dismissOnBackdrop={false}
        onClose={goBack}
        onDone={async (sellerId) => {
          await enterStoreSeat(sellerId)
          toast.success('매장이 등록됐어요 — 이제 이용권을 올릴 수 있어요')
          navigate('/seller', { replace: true })
        }}
      />
    </div>
  )
}
