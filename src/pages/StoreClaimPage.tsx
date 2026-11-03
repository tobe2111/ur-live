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
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import BrokerHandoffPanel from './store-claim/BrokerHandoffPanel'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MY_PATH } from '@/lib/seller-return'
import { takePartnerReturn } from '@/utils/partner-return'
import { X, ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import type { RegisterPlace } from '@/components/seller/StoreRegisterModal'
import { TicketStubIcon, ReceiptIcon, WonCoinIcon } from '@/components/icons/urdeal-icons'
import { enterStoreSeat } from '@/utils/enter-store'
import { isLoggedInSync } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import { captureStoreReferrer } from '@/utils/store-referrer'
import { AGENCY_INVITE_QUERY, isAgencyInviteToken } from '@/shared/agency-store-invite'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useUserProfile } from '@/hooks/queries/useUserProfile'
import StoreFindStep from './store-new/StoreFindStep'
import StoreConfirmStep from './store-new/StoreConfirmStep'
import StoreTakenPanel from './store-new/StoreTakenPanel'
import StoreDoneStep from './store-new/StoreDoneStep'
import AgencyInviteBanner from './store-new/AgencyInviteBanner'
import { readStoreNewDraft, writeStoreNewDraft, clearStoreNewDraft } from './store-new/store-new-draft'
import { FIRST_VOUCHER_PATH } from './store-new/first-voucher-path'

/** 🎬 이 흐름의 움직임 — 부품이 불러올 때 한 번 꽂는다(공유 모듈로 빼면 화면마다 청크가 하나 더 생긴다 — 2026-11-02 실측). */
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) }
injectMotionCss('ur-m-rise', `@keyframes ur-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }.ur-rise { animation: ur-rise .35s cubic-bezier(.16,1,.3,1) both; }@media (prefers-reduced-motion: reduce){.ur-rise{animation:none!important}}`)
injectMotionCss('ur-m-step', `@keyframes ur-step-fwd { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }@keyframes ur-step-back { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }.ur-step-fwd { animation: ur-step-fwd .3s cubic-bezier(.2,1,.3,1) backwards; }.ur-step-back { animation: ur-step-back .3s cubic-bezier(.2,1,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-step-fwd,.ur-step-back{animation:none!important}}`)
injectMotionCss('ur-m-busyring', `@keyframes ur-busy-spin { to { transform: rotate(360deg); } }.ur-busy-ring { position: relative; isolation: isolate; overflow: hidden; }.ur-busy-ring::before { content: ''; position: absolute; inset: -60%; z-index: -2; background: conic-gradient(from 0deg, transparent 0 65%, rgba(255,255,255,.95) 82%, transparent 100%); animation: ur-busy-spin 1.1s linear infinite; }.ur-busy-ring::after { content: ''; position: absolute; inset: 2px; z-index: -1; border-radius: inherit; background: var(--brand); }@media (prefers-reduced-motion: reduce){.ur-busy-ring::before{animation:none!important;opacity:0}}`)
injectMotionCss('ur-m-storenew', `@keyframes ur-sn-shake { 0%,100% { transform: none; } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }@keyframes ur-sn-note { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }.ur-sn-field[aria-invalid="true"] { animation: ur-sn-shake .4s ease-out; }.ur-sn-note { animation: ur-sn-note .2s ease-out both; }.ur-sn-bar { transition: width .4s cubic-bezier(.2,1,.3,1); }@media (prefers-reduced-motion: reduce){.ur-sn-field[aria-invalid="true"],.ur-sn-note{animation:none!important}.ur-sn-bar{transition:none}}`)

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

/** 질문 화면 수 — ① 가게 찾기 ② 이 가게로 등록(2026-11-03 대표 확정 4화면 시안). */
const STEP_TOTAL = 2

/**
 * 🔴 수수료율을 **숫자로 쓰지 않는다.** 채널별 요율(직접 10% / 중개 5%)이 문서에는 있으나
 *   라이브 `platform_settings` 실측을 하지 않았다. 숫자를 틀리게 적으면 사장님에게 한 약속이 되고,
 *   아래 문장은 요율이 무엇이든 참이다. 숫자를 넣으려면 실측이 먼저다.
 */
const FACTS = [
  { value: '0원', label: '등록 비용' },
  { label: '사업자등록증', value: '선택' },
  { value: `${STEP_TOTAL}단계`, label: '지금 시작하면 끝' },
] as const

export default function StoreClaimPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // 🤝 소개자 초대 링크(`?ref=`)는 **로그인으로 보내기 전에** 담아야 한다.
  //   로그인 왕복에서 쿼리스트링이 사라지므로, 여기서 놓치면 소개자가 데려오고도 보상을 못 받는다.
  useEffect(() => { captureStoreReferrer(params.get('ref')) }, [params])

  // 등록은 로그인이 필요하다. 401 을 만나게 두지 말고 로그인으로 보내되 돌아올 곳을 지정한다.
  // 🔁 2026-10-10: 쿼리까지 싣는다 — 영입자 초대(`?prospect=&pt=`)가 로그인 왕복에서 사라지면 준비해 둔 정보를 잃는다.
  useEffect(() => {
    if (!isLoggedInSync()) navigate(`/login?returnUrl=${encodeURIComponent(`/store/new${window.location.search || ''}`)}`, { replace: true })
  }, [navigate])

  /**
   * 📋 2026-10-10 (대표 "1,2,5번은 해주고" — 가입 문 하나): 영입자 초대 링크가 옛 가입 폼 대신 **여기로** 온다.
   * 준비해 둔 가게 이름·담당자 번호를 보여 주고 번호를 채운다. 귀속은 서버가 그 번호로 옛 문과 똑같이 한다
   * (`store-signup-extras.ts`). 조회가 실패해도 등록은 막지 않는다.
   */
  const [prospect, setProspect] = useState<{ store_name: string | null; contact_phone: string | null } | null>(null)
  useEffect(() => {
    const id = params.get('prospect'); const pt = params.get('pt')
    if (!id || !pt || !isLoggedInSync()) return
    api.get(`/api/prospects/prefill/${encodeURIComponent(id)}?pt=${encodeURIComponent(pt)}`)
      .then((r) => { if (r.data?.success && !r.data.data?.converted) setProspect(r.data.data) })
      .catch(() => { /* 프리필 실패 — 빈 칸으로 시작 */ })
  }, [params])
  /**
   * 🔗 2026-10-31 대표 *"그 링크로 들어와서 가입하면 바로 에이전시와 매장이 연동되게"* — 에이전시 영입 링크에서
   *   넘어온 등록이면(`?agency_invite=`) 어느 에이전시인지 먼저 말하고, 등록이 끝나는 순간 그 링크로 맡긴다.
   *   맡기기는 사장님 링크 화면과 **같은 API**(`/api/store-agency-invite/accept`)라 소유 판정·에이전시 수 상한이 그대로다.
   *   조회가 실패해도(만료된 링크) 등록은 막지 않는다 — 매장은 매장대로 생기고 연결만 안 된다.
   */
  const inviteToken = (() => { const v = params.get(AGENCY_INVITE_QUERY); return isAgencyInviteToken(v) ? v : null })()
  const [inviteAgency, setInviteAgency] = useState<string | null>(null)
  useEffect(() => {
    if (!inviteToken || !isLoggedInSync()) return
    api.get(`/api/store-agency-invite/${encodeURIComponent(inviteToken)}`)
      .then((r) => { if (r.data?.success) setInviteAgency(r.data.agencyName || '에이전시') })
      .catch(() => { /* 만료 — 등록은 그대로 */ })
  }, [inviteToken])
  async function entrustToInviter(sellerId: number | undefined): Promise<void> {
    if (!inviteToken || !sellerId) return
    try {
      const r = await api.post('/api/store-agency-invite/accept', { token: inviteToken, seller_id: sellerId })
      if (r.data?.success) { toast.success(`${r.data.agencyName || '에이전시'} 에이전시에 매장을 맡겼어요`); return }
      throw new Error(r.data?.error)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '에이전시에 맡기지 못했어요. 받은 링크를 다시 열어 [맡기기] 를 눌러 주세요.')
    }
  }
  // 🔑 중개 등록 완료 — 승계 코드를 **고정**으로 보여 준다(종전엔 토스트 한 번이라 대행사가 놓쳤다).
  const [handoff, setHandoff] = useState<string | null>(null)

  /**
   * ✕ 로 나갈 곳. `navigate(-1)` 하나로는 부족하다 — 이 페이지는 푸터·소개 페이지·카톡으로 받은
   * 링크처럼 **직접 주소로** 열리는 자리라 돌아갈 이력이 없을 수 있다. 이력이 없으면 홈으로 보낸다.
   */
  const goBack = useSafeBack('/')

  // ── 4화면 흐름(2026-11-03 대표 확정): find → confirm → done (→ 첫 이용권은 별도 주소) ──
  type Step = 'find' | 'confirm' | 'taken' | 'done'
  const draft = useState(() => readStoreNewDraft())[0]
  const [step, setStep] = useState<Step>(draft?.place ? 'confirm' : 'find')
  const [dir, setDir] = useState<1 | -1>(1)
  const [place, setPlace] = useState<RegisterPlace | null>(draft?.place ?? null)
  const [phone, setPhone] = useState(draft?.phone ?? '')
  const [phoneFromAccount, setPhoneFromAccount] = useState(false)
  const [takenId, setTakenId] = useState<number | null>(null)
  const { data: profile } = useUserProfile()
  // 📞 번호 미리 채우기 — 영입자가 준비한 번호 > 이어하기 저장분 > 계정 번호. 사장님이 이미 적었으면 건드리지 않는다.
  useEffect(() => {
    if (phone) return
    if (prospect?.contact_phone) { setPhone(prospect.contact_phone); return }
    if (profile?.phone) { setPhone(profile.phone); setPhoneFromAccount(true) }
  }, [prospect?.contact_phone, profile?.phone]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (step !== 'done') writeStoreNewDraft({ place, phone }) }, [place, phone, step])

  const go = (next: Step, d: 1 | -1 = 1) => { setDir(d); setStep(next) }
  const pick = (p: RegisterPlace) => { setPlace(p); go('confirm') }

  async function onRegistered(sellerId: number | undefined, ownerClaimCode: string | null) {
    clearStoreNewDraft()
    await enterStoreSeat(sellerId)
    if (ownerClaimCode) { setHandoff(ownerClaimCode); return } // 중개 — 코드를 먼저 손에 쥐여 준다
    // 🔗 에이전시 영입 링크로 온 사장님 — 등록과 동시에 맡긴다.
    await entrustToInviter(sellerId)
    // 🤝 2026-10-31 제휴사 위젯으로 들어왔으면 그 제휴사 요청 화면으로 돌아간다(`utils/partner-return.ts`).
    const back = takePartnerReturn()
    if (back) { toast.success('매장이 등록됐어요'); navigate(back, { replace: true }); return }
    go('done')
  }

  const inForm = step === 'find' || step === 'confirm'
  const stepNo = step === 'find' ? 1 : 2

  return (
    /* 📱 2026-11-03 (대표 *"플로우가 이상적이지 않고 UI 도 별로야"* → 4화면 시안 확정 · *"다크모드에서도 다크로"*):
       폰은 하단 탭 없는 전체 화면(`consumer-chrome.ts` `/store/new`)이라 페이지가 화면 높이를 잡아 버튼이 늘 바닥이다.
       🌙 다크 지원 — 종전의 `force-light-theme`(늘 흰 화면)을 걷었다. 그 클래스가 막던 사고는 *흰 바탕 위 흰 입력 글자*였는데,
       이제 바탕이 테마를 따르므로 전역 `.dark input` 규칙이 오히려 맞는 색을 준다. 지도 칸만 늘 밝은 섬으로 둔다(`StoreConfirmStep`). */
    <div className="h-dvh lg:h-auto lg:min-h-dvh bg-warm text-gray-900 dark:text-white flex flex-col">
      <SEO title="매장 이용권 판매 등록 - 유어딜" description="내 가게를 유어딜에 등록하고 이용권을 판매하세요. 등록 비용 0원." noindex />

      <div className="mx-auto w-full max-w-[1180px] flex-1 min-h-0 flex flex-col lg:block lg:px-10 lg:pt-10 lg:pb-16">
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-12">
          {/* PC 왼쪽 — 무엇을 등록하는 곳인가 */}
          <div className="hidden lg:block lg:pt-16">
            <h1 className="text-[40px] font-bold tracking-[-0.03em] leading-[1.22]">
              매장 이용권<br /> 판매 등록
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-soft max-w-[460px]">손님이 유어딜에서 할인가로 이용권을 미리 삽니다. 매장에 와서 QR 을 보여주면 그걸로 끝입니다.</p>
            <ul className="mt-8 flex flex-col gap-3 max-w-[460px]">
              {BENEFITS.map(({ Icon, title, desc }) => (
                <li key={title} className="flex gap-3 items-start">
                  <Icon size={20} className="mt-1 shrink-0 text-brand-text" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex mt-8 pt-5 border-t border-rule gap-8 max-w-[460px]">
              {FACTS.map(({ value, label }) => (
                <div key={label}>
                  <div className="text-[20px] font-semibold">{value}</div>
                  <div className="mt-1 text-[12px] text-ink-soft">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 등록 흐름 — 폰은 화면 전체, PC 는 오른쪽 열 */}
          <div className="flex-1 min-h-0 flex flex-col lg:h-[min(780px,88dvh)]">
            <div className="h-14 shrink-0 flex items-center justify-between px-2 lg:px-0">
              <button type="button" aria-label={step === 'confirm' ? '이전' : '닫기'}
                onClick={() => (step === 'confirm' ? go('find', -1) : step === 'taken' ? go('find', -1) : step === 'done' ? navigate(MY_PATH, { replace: true }) : goBack())}
                className="w-11 h-11 -ml-1 lg:-ml-3 flex items-center justify-center rounded-full text-gray-900 dark:text-white hover:bg-wash">
                {step === 'confirm' ? <ArrowLeft size={22} strokeWidth={1.6} /> : <X size={22} strokeWidth={1.6} />}
              </button>
              {inForm && <span className="pr-3 lg:pr-0 text-[12px] text-ink-soft tabular-nums">{stepNo} / {STEP_TOTAL}</span>}
            </div>
            {inForm && (
              <div className="mx-5 lg:mx-0 h-1 rounded-full bg-wash overflow-hidden" aria-hidden="true">
                <div className="ur-sn-bar h-full rounded-full bg-brand" style={{ width: `${(stepNo / STEP_TOTAL) * 100}%` }} />
              </div>
            )}

            <div key={step} className={`flex-1 min-h-0 flex flex-col px-5 lg:px-0 pt-6 pb-[calc(16px+env(safe-area-inset-bottom,0px))] ${dir < 0 ? 'ur-step-back' : 'ur-step-fwd'}`}>
              {handoff ? (
                <BrokerHandoffPanel code={handoff} onDone={() => navigate(MY_PATH, { replace: true })} />
              ) : step === 'done' ? (
                <StoreDoneStep storeName={place?.name || '내 가게'} agencyName={inviteAgency}
                  onFirstVoucher={() => navigate(FIRST_VOUCHER_PATH, { replace: true, state: { place } })}
                  onLater={() => navigate(MY_PATH, { replace: true })} />
              ) : step === 'taken' ? (
                <StoreTakenPanel storeName={place?.name || '이 가게'} sellerId={takenId}
                  onEntered={() => navigate(MY_PATH, { replace: true })} onRetry={() => go('find', -1)} />
              ) : (
                <>
                  {inviteAgency && <AgencyInviteBanner name={inviteAgency} />}
                  {prospect?.store_name && (
                    <p className="mb-5 rounded-xl bg-brand-tint px-4 py-3 text-[13px] leading-relaxed">
                      <b className="font-medium">{prospect.store_name}</b> — 영입 담당자가 미리 준비한 매장이에요. 이 가게를 찾아 진행해 주세요.
                    </p>
                  )}
                  {step === 'find' && (
                    <>
                      <p className="text-[13px] font-medium text-brand-text lg:hidden">매장 이용권 판매 등록 · 무료</p>
                      <h1 className="mt-2 lg:mt-0 text-[20px] font-semibold tracking-[-0.02em] leading-snug">가게 이름을 검색해 주세요</h1>
                      <StoreFindStep onPick={pick} hasAgency={!!inviteAgency} />
                    </>
                  )}
                  {step === 'confirm' && place && (
                    <>
                      <h1 className="text-[20px] font-semibold tracking-[-0.02em] leading-snug">이 가게로 등록할게요</h1>
                      <StoreConfirmStep place={place} phone={phone} phoneFromAccount={phoneFromAccount}
                        onPhone={(v) => { setPhone(v); setPhoneFromAccount(false) }} agencyName={inviteAgency}
                        onChangePlace={() => go('find', -1)} onRegistered={(id, code) => void onRegistered(id, code)}
                        onTaken={(id) => { setTakenId(id); go('taken') }} />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
