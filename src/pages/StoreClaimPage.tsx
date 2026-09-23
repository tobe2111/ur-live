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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🖥️ 2026-09-23 (대표 신고 *"페이지가 불친절해. 처음 등록 시 페이지인데 매장 이용권 판매 등록하기
 *    라던지, 그런 내용이 있어야 할 것 같은데?"* → 시안 3안 중 **"안 B로 하자"**).
 *
 * **위 "주소가 목적" 설계는 옳았고 지금도 유효하다.** 다만 그 주소에 도착한 사장님이 받는 정보가
 * **0** 이었다 — 이 파일은 82줄이었고 화면은 `StoreRegisterModal` 한 장이었다. 검은 오버레이 위
 * 512px 카드가 곧장 "내 매장을 찾아주세요 + 카카오맵 검색"을 띄운다. 무엇을 등록하는 곳인지,
 * 등록하면 무엇을 할 수 있는지, 돈이 드는지, 몇 단계인지 **어디에도 안 적혀 있었다.**
 *
 * 🩸 그리고 **2026-09-21 PC 액자 해제(#1525, B 묶음)가 이걸 키웠다.** 그 전에는 430px 액자 안이라
 *   512px 모달이 폭을 꽉 채워 앱 화면처럼 보였는데, 액자를 벗기자 같은 모달이 **1440px 어두운 빈
 *   들판 한가운데 뜬 작은 카드**가 됐다. ⚠️ 액자로 되돌리는 것은 답이 아니다 — 해제 근거(사장님
 *   화면의 좌우가 전부 소비자 앱 설치 QR)는 그대로 유효하다. 빈 공간이 생긴 게 문제가 아니라
 *   **그 공간에 놓을 것을 아직 안 만든 것**이 문제였다. 안 B 가 정확히 그 자리를 쓴다.
 *
 * 레이아웃: 폰은 [설명 → 등록 카드] 한 줄, PC(lg+)는 [좌 설명 / 우 등록 카드] 2단.
 * 설계·대안 A/C 와 기각 사유: `docs/design/store-new-onboarding-2026-09.md`.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import SEO from '@/components/SEO'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
import { TicketStubIcon, ReceiptIcon, WonCoinIcon } from '@/components/icons/urdeal-icons'
import { enterStoreSeat } from '@/utils/enter-store'
import { isLoggedInSync } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import { captureStoreReferrer } from '@/utils/store-referrer'

/**
 * 등록하면 할 수 있는 것 셋. **전부 코드에서 확인한 사실만 적는다** —
 * 등록 완료 토스트("이제 이용권을 올릴 수 있어요")·3단계 본문("사장님께 드릴 코드가 생겨요")·
 * 셀러 대시보드의 주문/정산 탭이 근거다. 지어낸 숫자나 약속은 넣지 않는다.
 */
const BENEFITS = [
  { Icon: TicketStubIcon, title: '이용권을 올립니다', desc: '가격과 조건은 사장님이 정합니다' },
  { Icon: ReceiptIcon, title: '주문과 정산을 한 곳에서 봅니다', desc: '누가 언제 썼는지, 얼마가 들어오는지' },
  { Icon: WonCoinIcon, title: '소개 코드를 받습니다', desc: '그 코드로 들어온 손님은 사장님 매출이 됩니다' },
] as const

/**
 * 🔴 수수료율을 **숫자로 쓰지 않는다.** 채널별 요율(직접 10% / 중개 5%)이 문서에는 있으나
 *   라이브 `platform_settings` 실측을 하지 않았다. 숫자를 틀리게 적으면 사장님에게 한 약속이 되고,
 *   아래 문장은 요율이 무엇이든 참이다. 숫자를 넣으려면 실측이 먼저다.
 */
const FACTS = [
  { value: '0원', label: '등록 비용' },
  { value: '사진 1장', label: '사업자등록증' },
  { value: '4단계', label: '지금 시작하면 끝' },
] as const

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
    /* 🕳️ 2026-09-07 (실측 1.09:1): `force-light-theme` 이 없으면 **다크모드에서 입력 글자가 안 보인다.**
       전역 `.dark input:not(...)`(특이도 0,5,1)이 모달의 `text-gray-900`(0,1,0)을 이겨 글자를
       gray-100 으로 덮는데, 모달 배경은 `bg-white` 다 → 흰 배경 위 흰 글자(브라우저 실측
       rgb(243,244,246) on rgb(255,255,255)). 대표가 2026-09-03 지도 검색창에서 신고한 것과
       **같은 버그**가, 하필 매장 유치 퍼널에 있었다.
       ⚠️ 이건 임기응변이 아니라 `index.css` 가 명시한 규칙이다 —
       *"신규 standalone 라이트 페이지(로그인/가입/대시보드 외부)는 루트 div 에 `force-light-theme` 추가할 것"*.
       대시보드 안(`MyStoresPanel`)에서 열릴 땐 `.seller-light-theme` 래퍼가 이미 같은 일을 한다.
       ⚠️ 그리고 이 클래스는 `--lift`·`--rule` 같은 🎫 토큰도 라이트 값으로 되박는다(index.css:511) —
       그래서 아래 `shadow-lift`·`border-rule` 이 **다크 상태에서도** 제대로 보인다.

       📏 높이는 **페이지가 정하지 않는다**(`min-h` 만). 🩸 첫 판에서 폰을 `h-[100dvh]` 로 잡았다가
       렌더해 보니 카드 아래 24px 이 **하단 네비(고정 57px) 밑으로 잘렸다** — `main` 이 이미
       `padding-bottom:56px` 로 그 자리를 예약하는데 거기에 뷰포트 높이를 또 얹은 것이다.
       카드는 자기 `max-h` 로 바운드하므로(page variant) 페이지는 평범하게 흐르면 된다. */
    <div className="force-light-theme min-h-[100dvh] bg-gray-50">
      <SEO title="매장 이용권 판매 등록 - 유어딜" description="내 가게를 유어딜에 등록하고 이용권을 판매하세요. 등록 비용 0원." noindex />

      <div className="mx-auto w-full max-w-[1180px] px-5 pt-3 pb-6 lg:px-10 lg:pt-8 lg:pb-16">
        <button
          type="button"
          onClick={goBack}
          aria-label="닫기"
          className="-ml-1 mb-2 w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16">
          {/* 왼쪽(PC) · 위(폰) — 무엇을 등록하는 곳인가 */}
          <div className="lg:pt-4">
            <h1 className="text-[26px] lg:text-[44px] font-black tracking-[-0.03em] leading-[1.22] text-gray-900">
              매장 이용권<br className="hidden lg:block" /> 판매 등록
            </h1>
            <p className="mt-2.5 lg:mt-4 text-[14px] lg:text-[16px] leading-relaxed text-gray-600 lg:max-w-[460px]">
              손님이 유어딜에서 할인가로 이용권을 미리 삽니다. 매장에 와서 QR 을 보여주면 그걸로 끝입니다.
            </p>

            <ul className="mt-4 lg:mt-8 flex flex-col gap-3 lg:gap-3.5 lg:max-w-[460px]">
              {BENEFITS.map(({ Icon, title, desc }) => (
                <li key={title} className="flex gap-3 lg:gap-3.5 items-start">
                  <Icon size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] lg:text-[15px] font-bold text-gray-900">{title}</p>
                    {/* 폰은 한 줄로 끊는다 — 설명까지 다 펴면 카드가 밀려 첫 화면에서 사라진다. */}
                    <p className="hidden lg:block mt-0.5 text-[13.5px] leading-relaxed text-gray-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:flex mt-9 pt-5 border-t border-rule gap-9 lg:max-w-[460px]">
              {FACTS.map(({ value, label }) => (
                <div key={label}>
                  <div className="text-[22px] font-black text-gray-900">{value}</div>
                  <div className="mt-1 text-[12.5px] text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽(PC) · 아래(폰) — 등록 카드 그대로 */}
          <div className="mt-4 lg:mt-0 lg:self-start">
            <StoreRegisterModal
              /**
               * 🖥️ `variant="page"` — 검은 오버레이 없이 이 칸의 본문으로 렌더한다(2026-09-23 안 B).
               * 🩸 2026-09-07 (대표 *"흰 섹션 바깥쪽을 클릭하니까 페이지가 꺼져"*): 여기선 모달이 곧
               *   페이지라 배경 뒤에 아무것도 없다 — 바깥 클릭은 닫을 것이 아니라 **폼을 날리는 사고**다.
               *   `dismissOnBackdrop={false}` 를 **남겨 둔다**: page 에는 배경이 없어 구조적으로 못 닫히지만,
               *   누군가 variant 를 되돌리는 날 이 한 줄이 그 사고를 다시 막는다(방어를 겹쳐 둔다).
               */
              variant="page"
              dismissOnBackdrop={false}
              onClose={goBack}
              onDone={async (sellerId, opts) => {
                // `existing` = 새로 만든 게 아니라 **원래 갖고 있던 매장**으로 들어간 경우(중복 409 분기).
                //   그때 "등록됐어요" 라고 말하면 사장님에게 거짓말이고, 좌석도 이미 잡혀 있다.
                if (!opts?.existing) {
                  await enterStoreSeat(sellerId)
                  toast.success('매장이 등록됐어요 — 이제 이용권을 올릴 수 있어요')
                }
                navigate('/seller', { replace: true })
              }}
            />
            {/* 폰에서는 위 FACTS 줄 대신 이 한 줄이 같은 말을 한다(세 숫자를 다 펴면 카드가 밀린다). */}
            <p className="lg:hidden mt-2 text-center text-[11px] text-gray-400">
              등록 0원, 사업자등록증 사진 1장이면 됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
