/**
 * 🏪 매장 등록 — 한 화면 한 질문 위저드 (2026-09-07 대표 "당근 참고한 내용 진행 · 구멍들 다 막아주고")
 *
 * ## 왜 스텝으로 바꿨나 (당근 시안 원칙 ①)
 * 종전엔 네 질문(①매장 ②담당자 ③운영방식 ④사업자)이 **한 시트에 세로로** 쌓여 있었고,
 * 아래 [매장 등록] 버튼은 넷이 다 채워져야 켜졌다. 그런데 **무엇이 빠졌는지는 아무 데도 안 적혀
 * 있었다** — 사장님은 셋을 채우고 회색 버튼을 바라보게 된다. 이건 이 레포가 토스 결제에서 한 번
 * 고쳤던 "구조적으로 잠기는 버튼"과 같은 클래스다(2026-06-26 audit log).
 *
 * 스텝으로 나누면 그 구멍이 **구조적으로 사라진다**: 화면에 질문이 하나뿐이라 [다음]이 회색이면
 * 이유가 자명하고, 그래도 남는 애매함은 버튼 아래 한 줄(`blockReason`)이 말해 준다.
 *
 * ## 필수/선택을 제목에 적는다 (당근 원칙 ②)
 * 사업자번호는 **선택**이다(서버가 `|| undefined` 로 받는다). 그런데 종전 화면은 ④의 첫 칸으로
 * 놓고 아무 표시가 없어 필수처럼 보였다. 그래서 "안 쓰면 못 넘어가나?"를 사장님이 고민한다.
 *
 * ## 🕳️ 함께 막은 막다른 길 — 이미 등록된 매장(409 STORE_EXISTS)
 * 서버는 중복이면 `code:'STORE_EXISTS'` 와 **그 매장의 `seller_id` 까지** 돌려준다
 * (`seller-stores.routes.ts:357`). 그런데 화면은 `alert('이미 유어딜에 등록된 매장입니다')` 하나
 * 띄우고 끝이었다 — 자기 매장을 다른 계정으로 등록해 둔 사장님은 거기서 갈 곳이 없다.
 *
 * ⚠️ **소유권을 자동으로 넘기지 않는다.** 매장 귀속은 정산이 따라가는 **머니 경로**이고,
 *   진짜 승계(`owner_verified`)는 아직 설계만 있고 코드가 없다(`store-operator-model.md` §5).
 *   대신 **이미 갖고 있는 권한 검사를 그대로 시험지로 쓴다** — 좌석 토큰(`/stores/:id/token`)은
 *   `canOperateStore` 를 통과해야만 발급된다(그 파일이 "유일한 방어선"이라고 못 박은 곳). 그러니
 *   `enterStoreSeat` 가 성공하면 **원래 내 매장**이었던 것이고, 실패하면 내 것이 아니다.
 *   서버는 한 줄도 안 건드리고, 새로 뚫리는 권한도 0이다.
 *
 * ⚠️ 실패 문구는 **누구 것인지 단정하지 않는다.** 내 매장이어도 승인 대기(pending)면 좌석 토큰이
 *   403 이라 여기로 온다 — "남이 등록했다"고 말하면 그 사장님에게 거짓말이 된다.
 *
 * ## 종전 계약(무접촉)
 *   - `initialPlace` 프리필: 주면 ①을 건너뛰고 ②부터 시작한다(이용권 위저드가 쓰는 다리).
 *   - `POST /api/seller/stores` 바디·`referrer_user_id` 귀속·중복 409 — 서버 무수정.
 *   ⚠️ 2026-08-26 (대표): **선택지에 수수료율을 표시하지 않는다.** 채널은 사실(누가 운영하는가)이지
 *   고르는 요금제가 아니다. 실제 수수료는 이용권 등록의 '실수령가' 카드가 건별로 보여 준다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { formatPhone, isValidMobilePhone, digitsOnly } from '@/utils/format-phone'
import { readStoreReferrer, clearStoreReferrer } from '@/utils/store-referrer'
import { enterStoreSeat } from '@/utils/enter-store'
import { toast } from '@/hooks/useToast'
import { Loader2, MapPin, CheckCircle2, XCircle, BadgeCheck, FileImage, ArrowLeft } from 'lucide-react'

export interface RegisterPlace {
  id?: string
  name: string
  address: string
  phone?: string
  category?: string
  place_url?: string
  lat?: number
  lng?: number
}

export function toRegisterPlace(p: KakaoPlace): RegisterPlace {
  return {
    id: p.id,
    name: p.place_name,
    address: p.road_address_name || p.address_name || '',
    phone: p.phone || '',
    category: p.category_name || '',
    place_url: p.id ? `https://place.map.kakao.com/${p.id}` : undefined,
    lat: Number(p.y) || undefined,
    lng: Number(p.x) || undefined,
  }
}

interface Props {
  initialPlace?: RegisterPlace | null
  onClose: () => void
  /**
   * 등록 성공 — 서버 응답의 새 seller_id 를 넘긴다(목록 갱신용).
   * `existing: true` 면 **새로 만든 게 아니라 원래 갖고 있던 매장**으로 들어간 것이다 —
   * 호출부가 "등록됐어요" 라고 말하면 거짓말이 되므로 문구를 가를 수 있게 알려 준다.
   * (인자를 안 읽는 기존 호출부는 그대로 동작한다.)
   */
  onDone: (sellerId?: number, opts?: { existing?: boolean }) => void
  /**
   * 배경(어두운 여백)을 눌렀을 때 닫을지. 기본 `true` — 대시보드에서 목록 위에 겹쳐 뜰 때는
   * 바깥 클릭으로 닫히는 게 맞다(뒤에 돌아갈 화면이 보인다).
   *
   * 🩸 2026-09-07 (대표 신고 *"흰 섹션 바깥쪽을 클릭하니까 페이지가 꺼져"*): `/store/new` 는
   *   **모달이 곧 페이지**라 배경 뒤에 아무것도 없다. 그 자리에서 바깥을 누르면 사장님이
   *   사업자등록증까지 올려 둔 폼이 통째로 날아가고 화면을 떠난다. 겹쳐 뜬 것과 페이지인 것은
   *   같은 컴포넌트라도 **닫기의 의미가 다르다** ⇒ 페이지로 쓸 땐 `false`.
   */
  dismissOnBackdrop?: boolean
}

/** 질문 넷. 순서가 곧 진행바이고, 각 단계는 **하나만** 묻는다. */
const STEPS = [
  { key: 'place', title: '내 매장을 찾아주세요', hint: '카카오맵에서 검색하면 주소·전화번호가 자동으로 채워져요' },
  { key: 'manager', title: '담당자 전화번호를 알려주세요', hint: '승인·사용 문의·정산 확인 때 연락드릴 번호예요' },
  { key: 'channel', title: '이 매장, 누가 운영하나요?', hint: '사장님인지 대행사인지에 따라 정산 방식이 달라져요' },
  { key: 'business', title: '사업자등록증을 올려주세요', hint: '사람이 직접 확인해요 — 내용이 잘 보이는 사진이면 돼요' },
] as const

export default function StoreRegisterModal({ initialPlace, onClose, onDone, dismissOnBackdrop = true }: Props) {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<RegisterPlace | null>(initialPlace ?? null)
  const [showMap, setShowMap] = useState(!initialPlace)
  const [channel, setChannel] = useState<'direct' | 'brokered' | null>(null)
  const [managerPhone, setManagerPhone] = useState('')
  const [bno, setBno] = useState('')
  // 📄 2026-08-26 (대표 "당근마켓 플로우 정도로 하자"): 대표자명·개업일 **타이핑을 없앴다**.
  //   사장님이 외워서 적을 값이 아니고(개업일은 검색으로도 나온다) 위조도 쉽다. 당근처럼
  //   **등록증 사진**을 받고 사람이 심사한다(시안 05). 그 사진이 심사의 근거다.
  const [certUrl, setCertUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [nts, setNts] = useState<{ valid: boolean | null; message?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // 프리필로 열렸으면 ①은 이미 답이 있다 — 답한 질문을 다시 묻지 않는다.
  const [step, setStep] = useState(initialPlace ? 1 : 0)
  /** 이미 등록된 매장(409)일 때의 안내 — 막다른 alert 대신 다음 행동을 준다. */
  const [taken, setTaken] = useState<{ sellerId: number | null } | null>(null)
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  async function verify() {
    const clean = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(clean)) { toast.error('사업자번호는 숫자 10자리입니다'); return }
    setVerifying(true); setNts(null)
    try {
      const r = await api.post('/api/seller/stores/verify-business', { business_number: clean })
      setNts(r.data?.data || null)
    } catch (e: any) {
      setNts({ valid: null, message: e?.response?.data?.error || '확인 실패' })
    } finally { setVerifying(false) }
  }

  const managerOk = isValidMobilePhone(managerPhone)
  const certOk = !!certUrl

  async function uploadCert(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/upload/business-cert', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = r.data?.data?.url
      if (!r.data?.success || !url) throw new Error(r.data?.error || '업로드 실패')
      setCertUrl(url)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || '사업자등록증 업로드에 실패했습니다')
    } finally { setUploading(false) }
  }

  /**
   * 이 단계의 답이 준비됐는가. 준비 안 됐으면 **왜인지**를 문자열로 돌려준다 —
   * 회색 버튼만 두고 이유를 안 적으면 사장님은 무엇을 고쳐야 할지 모른다.
   */
  function blockReason(i: number): string | null {
    if (i === 0) return picked ? null : '지도에서 매장을 선택해주세요'
    if (i === 1) {
      if (!managerPhone) return '휴대폰 번호를 입력해주세요'
      return managerOk ? null : '휴대폰 번호(01x)로 입력해주세요'
    }
    if (i === 2) return channel ? null : '둘 중 하나를 골라주세요'
    return certOk ? null : '사업자등록증 사진을 첨부해주세요'
  }
  const blocked = blockReason(step)
  const last = step === STEPS.length - 1

  async function submit() {
    if (!picked || !channel || !managerOk || !certOk || submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/stores', {
        name: picked.name,
        address: picked.address,
        phone: picked.phone,
        category: picked.category,
        kakao_place_id: picked.id,
        kakao_place_url: picked.place_url,
        lat: picked.lat, lng: picked.lng,
        channel,
        manager_phone: digitsOnly(managerPhone),
        business_number: bno.replace(/-/g, '') || undefined,
        business_cert_url: certUrl,
        // 🤝 2026-08-27: 소개자 초대 링크(`/store/new?ref=`)로 들어왔으면 그 사람에게 귀속된다.
        //   ⚠️ sessionStorage 를 거치는 이유 — 로그인이 필요한 페이지라 카카오를 다녀오면
        //   쿼리스트링이 날아간다. 그 사이 ref 를 잃으면 소개자가 보상을 못 받는다.
        referrer_user_id: readStoreReferrer() || undefined,
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      clearStoreReferrer()
      toast.success(r.data.data?.message || '매장이 등록되었습니다')
      onDone(Number(r.data.data?.seller_id) || undefined)
    } catch (e: any) {
      // 🕳️ 이미 등록된 매장 — 종전엔 여기서 alert 하나 띄우고 끝(막다른 길)이었다.
      if (e?.response?.status === 409 && e?.response?.data?.code === 'STORE_EXISTS') {
        setTaken({ sellerId: Number(e.response.data.seller_id) || null })
        setSubmitting(false)
        return
      }
      toast.error(e?.response?.data?.error || e?.message || '등록에 실패했습니다')
      setSubmitting(false)
    }
  }

  /** 그 매장이 원래 내 것이었는지 **서버 권한 검사로** 시험한다(새 권한 0). */
  async function tryEnterExisting() {
    if (!taken?.sellerId || submitting) return
    setSubmitting(true)
    const ok = await enterStoreSeat(taken.sellerId)
    setSubmitting(false)
    if (ok) {
      toast.success('이미 등록해 두신 매장이에요 — 그 매장으로 들어갈게요')
      onDone(taken.sellerId, { existing: true })
      return
    }
    toast.error('이 계정으로는 그 매장에 들어갈 수 없어요')
  }

  /**
   * 셀러 좌석이 없는 사람에게 `/seller/stores` 를 권하면 **셀러 로그인 화면으로 튕긴다**
   * (`requireSeller`) — 막다른 길을 없애러 와서 새 막다른 길을 놓는 셈이다. 그래서 좌석이
   * 실제로 있을 때만 그 길을 보여 준다. 푸터로 들어온 소비자는 이 버튼이 아예 안 보인다.
   */
  const hasSellerSeat = (() => {
    try { return !!localStorage.getItem('seller_token') } catch { return false }
  })()

  // 🩸 2026-09-07 병합에서 **다른 세션의 가드가 내 버그를 잡았다.** 이 안내 화면은 위 폼과 별개의
  //   모달 마크업이라, 같은 날 고쳐진 두 가지가 여기엔 안 들어와 있었다 — `light-island` 없이
  //   `bg-white` 라 다크에서 흰 판 위 흰 글자가 되고, 배경 클릭이 `dismissOnBackdrop` 을 안 거쳐
  //   곧장 닫혔다. 한 파일 안에 같은 성질의 표면이 둘이면 **하나만 고치고 끝났다고 믿기 쉽다.**
  if (taken) {
    return (
      <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={dismissOnBackdrop ? onClose : undefined}>
        <div className="light-island w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-5">
            <h2 className="text-base font-bold text-gray-900">이미 유어딜에 등록된 매장이에요</h2>
            {/* ⚠️ 누구 것인지 단정하지 않는다 — 내 매장이어도 승인 대기면 좌석이 안 열려 여기로 온다. */}
            <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">
              {picked?.name ? <b className="text-gray-900">{picked.name}</b> : '이 매장'} 은(는) 이미 등록돼 있어요.
              직접 등록해 두셨거나, 다른 분이 대신 등록했을 수 있어요.
            </p>
            <div className="mt-4 space-y-2">
              {taken.sellerId && (
                <button onClick={tryEnterExisting} disabled={submitting}
                  className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
                  {submitting ? '확인 중…' : '내가 등록한 매장인지 확인하기'}
                </button>
              )}
              {hasSellerSeat && (
                <button onClick={() => { onClose(); navigate('/seller/stores') }}
                  className="w-full py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50">
                  내 매장 목록 보기
                </button>
              )}
              <button onClick={() => setTaken(null)}
                className="w-full py-2 text-[12.5px] text-gray-500 hover:text-gray-700">
                다른 매장으로 다시 찾기
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              사장님이신데 들어갈 수 없다면 소유권 확인이 필요해요. 아래 상담으로 알려주시면 확인해 드릴게요.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={dismissOnBackdrop ? onClose : undefined}>
      {/* 🏝️ light-island — 이 패널은 `bg-white` 뿐이라 **테마와 무관하게 늘 흰색**이다. 그런데 이 모달은
        * 소비자 라우트(`/store/new`)에서도 열리므로, 다크에서 안쪽 `dark:` 유틸이 살아 있으면
        * 흰 판 위에 흰 글자가 된다 — 실제로 대표가 검색창에 친 글자를 못 봤다(2026-09-07).
        * 전역 `.dark input`(특이도 0,5,1)이 `text-gray-900`(0,1,0)을 이기므로 **클래스 유틸로는 못 이긴다.**
        * 실측: 붙이기 전 1.00:1(흰 위 흰) → 붙인 뒤 17.77:1.
        * ⚠️ 두 세션이 같은 버그를 각자 고쳐 방어가 둘이다 — 여기 `light-island`(모달 자신, **모든 호출부**를
        *    덮는다)와 `StoreClaimPage` 의 `force-light-theme`(페이지 셸). 겹쳐도 무해하고 서로 다른 범위를
        *    지키므로 **둘 다 남긴다**. 하나를 지우려면 나머지 하나가 그 범위까지 덮는지 먼저 확인할 것.
        * ⚠️ `light-fixed` 주석은 가드 면제용 부표일 뿐 런타임엔 아무 일도 안 한다(CLAUDE.md 🏝️ 절).
        * ⚠️ 이 블록의 이어지는 줄이 `*` 로 시작하는 이유: `check-dashboard-theme.sh` 가 여러 줄 JSX
        *    주석의 둘째 줄부터를 실코드로 보고 다크 유틸 표기를 위반으로 잡는다(오탐 방향이라 안전). */}
      <div className="light-island w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
              aria-label={step === 0 ? '닫기' : '이전 단계'}
              className="-ml-1 p-1 text-gray-400 hover:text-gray-700"
            >
              {step === 0 ? <span className="text-sm px-1">✕</span> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <span className="text-[11px] font-bold text-gray-400 tabular-nums">{step + 1} / {STEPS.length}</span>
          </div>
          {/* 진행바 — 몇 개 남았는지가 보이면 중간 이탈이 줄어든다(당근 시안 공통) */}
          <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-brand transition-[width] duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <h2 className="mt-3 text-[17px] font-bold text-gray-900 leading-snug">{STEPS[step].title}</h2>
          <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">{STEPS[step].hint}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1">
          {/* ① 카카오맵 지도 검색 — 선택하면 이름/주소/전화/좌표/플레이스 링크 자동입력 */}
          {step === 0 && (
            picked && !showMap ? (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{picked.name}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />{picked.address}
                  </p>
                </div>
                <button onClick={() => setShowMap(true)} className="text-[11px] text-gray-400 underline shrink-0 ml-2">다시 선택</button>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 p-2">
                <KakaoMapPicker
                  kakaoJsKey={KAKAO_JS_KEY}
                  selectedPlace={picked && picked.lat && picked.lng ? {
                    name: picked.name, address: picked.address, lat: String(picked.lat), lng: String(picked.lng),
                  } : null}
                  onSelect={(p) => { setPicked(toRegisterPlace(p)); setShowMap(false) }}
                />
              </div>
            )
          )}

          {/* ② 담당자 연락처 — 매장 대표번호(위에서 자동입력)와 별개인 '사람' 연락처 */}
          {step === 1 && (
            <div>
              <input
                value={formatPhone(managerPhone)}
                onChange={e => setManagerPhone(e.target.value)}
                placeholder="010-0000-0000"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400"
              />
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                이 매장을 관리하는 분의 휴대폰 번호예요.
                {picked?.phone && <span className="text-gray-400"> 매장 대표번호({picked.phone})와는 별개예요.</span>}
              </p>
            </div>
          )}

          {/* ③ 운영 방식 */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setChannel('direct')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'direct' ? 'border-brand bg-[#EAF1FE]' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">내 가게에요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">제가 사장이고, 직접 운영해요</p>
              </button>
              <button onClick={() => setChannel('brokered')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'brokered' ? 'border-brand bg-[#EAF1FE]' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">중개·대행사에요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">사장님을 대신해 등록·관리해요</p>
              </button>
            </div>
          )}

          {/* ④ 사업자 확인 — 사진이 필수, 번호는 선택 */}
          {step === 3 && (
            <div className="space-y-3">
              {/* 🪞 당근 원칙 ⑤ "매 단계 결과 미리보기" — 마지막 문턱에서 **무엇이 등록되는지** 보여 준다.
                  앞 세 단계는 답하고 나면 화면에서 사라지므로, 여기서 다시 안 보여 주면 사장님은
                  자기가 무엇을 골랐는지 기억에만 의존해 [매장 등록]을 누르게 된다. 매장명이 한 글자
                  다른 지점을 골랐어도 이 카드가 없으면 등록 후에야 안다.
                  ⚠️ 새 데이터를 부르지 않는다 — 이미 손에 든 값만 다시 보여 준다(요청 0). */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200">
                {[
                  { k: '매장', v: picked?.name, sub: picked?.address, to: 0 },
                  { k: '담당자', v: formatPhone(managerPhone), to: 1 },
                  { k: '운영', v: channel === 'direct' ? '내 가게' : channel === 'brokered' ? '중개·대행' : '', to: 2 },
                ].map((r) => (
                  <div key={r.k} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="text-[11px] font-bold text-gray-400 w-11 shrink-0 pt-0.5">{r.k}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-gray-900 truncate">{r.v}</span>
                      {r.sub && <span className="block text-[11px] text-gray-500 truncate">{r.sub}</span>}
                    </span>
                    {/* 틀린 걸 발견해도 되돌아갈 길이 없으면 미리보기는 불안만 준다. */}
                    <button onClick={() => setStep(r.to)} className="text-[11px] text-gray-400 underline shrink-0 pt-0.5">수정</button>
                  </div>
                ))}
              </div>
              {/* 📄 사업자등록증 사본 — 개업일·대표자명을 외워 적는 대신 사진 1장. 이게 심사의 근거다. */}
              <label className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border border-dashed cursor-pointer ${certUrl ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50'}`}>
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCert(f); e.target.value = '' }}
                />
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                  : certUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <FileImage className="w-4 h-4 text-gray-400 shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-gray-900">
                    {uploading ? '올리는 중…' : certUrl ? '사업자등록증 첨부됨' : '사업자등록증 사진 첨부'}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    {certUrl ? '다시 누르면 교체할 수 있어요' : '내용이 잘 보이는 사진으로 · 10MB 이하 jpg·png'}
                  </span>
                </span>
              </label>

              {/* 🏷️ 당근 원칙 ②: 선택인 것은 제목에 적는다 — 안 쓰면 못 넘어가나 고민하지 않게. */}
              <div className="pt-1">
                <p className="text-[12px] font-bold text-gray-700 mb-1.5">
                  사업자번호 <span className="font-normal text-gray-400">(선택 — 지금 안 적어도 등록돼요)</span>
                </p>
                <input value={bno} onChange={e => setBno(e.target.value)} placeholder="숫자 10자리" inputMode="numeric" maxLength={12}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                <button onClick={verify} disabled={verifying || !bno}
                  className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} 국세청 확인
                </button>
                {nts && (
                  <p className={`text-[11px] flex items-center gap-1 mt-1.5 ${nts.valid === true ? 'text-emerald-600' : nts.valid === false ? 'text-red-600' : 'text-gray-500'}`}>
                    {nts.valid === true ? <CheckCircle2 className="w-3.5 h-3.5" /> : nts.valid === false ? <XCircle className="w-3.5 h-3.5" /> : null}
                    {nts.valid === true ? `국세청에 등록된 번호예요${nts.message ? ` (${nts.message})` : ''}` : nts.valid === false ? '조회되지 않는 번호예요 — 입력을 확인해주세요' : (nts.message || '확인 불가 — 등록 후 검토됩니다')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => (last ? void submit() : setStep(step + 1))}
            disabled={!!blocked || submitting}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition"
          >
            {submitting ? '등록 중…' : last ? '매장 등록' : '다음'}
          </button>
          {/* 🔓 회색 버튼만 두고 이유를 안 적으면 사장님은 무엇을 고쳐야 할지 모른다. */}
          {blocked && <p className="text-[11.5px] text-gray-500 text-center mt-2">{blocked}</p>}
        </div>
      </div>
    </div>
  )
}
