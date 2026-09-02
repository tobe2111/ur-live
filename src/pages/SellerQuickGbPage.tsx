/**
 * ⚡ **3분 등록** — 운영자가 공구 하나를 한 화면에서 연다 (세션 ③-b, O4)
 *
 * 대표 완료 기준: *"사진·가격·마감만으로 **3분 내** 등록 완주"* ·
 * UX 기준 ④: *"모바일 **한 손 조작** 기준"*.
 *
 * ## 왜 새 화면인가 (기존 폼을 줄이지 않고)
 * `SellerProductNewPage`(511줄)는 배송·옵션·상세설명·카테고리별 분기까지 다루는 **풀 폼**이다.
 * 거기서 필드를 숨기면 **한 폼이 두 가지 일을 하게 되고**, 픽업 공구에 안 쓰는 분기가 계속 따라다닌다.
 * ⇒ 별도 경로로 두고 **풀 폼은 그대로** 둔다(기존 셀러 동작 무변경).
 *
 * ## 한 손 조작 — 구체적으로
 * - 단일 컬럼 · 입력 높이 **56px**(엄지 타겟) · 라이트 고정(대시보드 룰 — dark: 금지) · `inputMode="numeric"` 로 숫자 키패드 즉시
 * - 제출 버튼은 **화면 하단 고정**(스크롤해서 찾지 않는다)
 * - 마감은 **버튼 3개(3일·7일·14일)** — 날짜 피커는 한 손으로 제일 괴로운 위젯이다
 *
 * ## 두 번 부른다 (한 번에 못 한다)
 * ① `POST /api/seller/products` — 상품 생성(**서버가 `mall_id` 스탬프**)
 * ② `PUT /api/seller/gb/:id` — 공구가·마감(**서버가 `공구가 < 상시가` 강제**)
 *
 * 🔴 **②가 실패해도 ①은 남는다**(원자적이지 않다). 그래서 실패 시 **상품이 만들어졌다는 사실과
 *   이어서 할 일을 그대로 말해준다** — 조용히 실패하면 운영자는 같은 상품을 또 만든다.
 *
 * ---
 * ## 🎨 2026-08-02 시안 적용 〔`docs/design/operator-mall-pilot.md` 화면 B-1·B-2〕
 *
 * 배선은 그대로고 **표면만** 바꿨다. 시안이 실제로 더한 것은 넷이다:
 * ① 필수(사진·상품명·가격·마감) / 선택(픽업일·보관구분)을 **두 카드로 분리** — 의뢰서 §4
 *   *"지금은 선택 항목에 회색 (선택)만 붙어 있습니다"* 에 대한 답.
 * ② 마감 버튼 아래 **실제 날짜 환산** — "7일"만 보고는 그게 며칠인지 아무도 모른다.
 * ③ 오류를 **상단 요약 상자**로 — 의뢰서 §4 *"사장님은 '저장 실패'만 보면 포기합니다"*.
 * ④ 보관구분 미리보기를 **옅은 로즈 면**으로 승격 — 손님에게 나갈 문구는 팔리기 전에 보여야 한다.
 *
 * 🎨 **테두리 규칙**〔시안 §3.2〕: 테두리는 **입력칸에만**(1px `#DFD9DC`, 포커스만 1.5px `#1A1719`).
 *   마감·보관구분 버튼은 안 고른 것도 **회색 면**이다 — 테두리 박스로 그리면 세그먼트가 아니라
 *   "박스의 나열"로 읽힌다.
 *
 * ⚠️ `text-gray-*` 를 쓰지 않고 hex 를 직접 쓴다 — `tailwind.config.js` 가 `gray-*` 를 **INK
 *   스케일(딥네이비 `#16181C`)로 리맵**하는데 시안의 중립색은 웜 계열(`#1A1719`)이라 조용히 틀어진다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check, AlertCircle, ChevronLeft, Calendar, X } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { STORAGE_LABEL, STORAGE_NOTICE, type StorageKind } from '@/shared/pickup'

/** 마감 프리셋 — 날짜 피커 대신. 한 손으로 누를 수 있는 것만 남긴다. */
const DEADLINE_PRESETS = [
  { days: 3, label: '3일' },
  { days: 7, label: '7일' },
  { days: 14, label: '14일' },
] as const

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 마감 시각 = **그날 KST 23:59:59**.
 *
 * 🔴 예전엔 `now + N일`(=등록한 시각 그대로)이었다. 그러면 오후 2시 31분에 등록한 공구가
 *   사흘 뒤 **오후 2시 31분**에 닫힌다 — 운영자도 손님도 그 시각을 예측할 수 없고,
 *   "3일"이라는 라벨과도 안 맞는다. 날짜 단위 라벨을 쓰는 이상 마감도 날짜 단위여야 한다.
 *
 * KST 23:59:59 == 같은 날 UTC 14:59:59.
 */
function deadlineAt(days: number): Date {
  const nowKst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(
    nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate() + days,
    14, 59, 59,
  ))
}

function deadlineIso(days: number): string {
  return deadlineAt(days).toISOString()
}

/** KST 달력 기준 조각 — `Date` 의 로컬 타임존에 기대지 않는다(이 레포 반복 사고 클래스). */
function kstParts(d: Date) {
  const k = new Date(d.getTime() + 9 * 3600_000)
  return { m: k.getUTCMonth() + 1, d: k.getUTCDate(), dow: DOW[k.getUTCDay()], ymd: k.toISOString().slice(0, 10) }
}

const CARD = 'bg-white border border-[#EAE5E7] rounded-2xl p-4 flex flex-col gap-[18px]'
const INPUT = 'w-full h-14 px-[15px] rounded-xl border border-[#DFD9DC] bg-white text-[15.5px] font-semibold text-[#1A1719] tracking-[-0.02em] outline-none focus:border-[1.5px] focus:border-[#1A1719]'
const LABEL = 'block text-[12.5px] font-bold text-[#4A4448] tracking-[-0.02em] mb-2'
/** 안 고른 것도 **면**이다 — 테두리 박스로 그리면 세그먼트가 아니라 박스의 나열이 된다. */
const CHIP_ON = 'bg-[#1A1719] text-white'
const CHIP_OFF = 'bg-[#F1EDEF] text-[#4A4448]'

export default function SellerQuickGbPage() {
  const navigate = useNavigate()
  const [imageUrl, setImageUrl] = useState('')
  const [name, setName] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [gbPrice, setGbPrice] = useState('')
  const [days, setDays] = useState<number>(7)
  const [pickupDate, setPickupDate] = useState('')
  const [storage, setStorage] = useState<StorageKind | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 제출을 한 번이라도 눌렀는가 — 누르기 전엔 오류를 안 띄운다(입력 중 잔소리 금지). */
  const [attempted, setAttempted] = useState(false)
  /** ①은 됐는데 ②가 실패한 상태 — 이걸 숨기면 운영자가 같은 상품을 또 만든다. */
  const [orphanId, setOrphanId] = useState<number | null>(null)

  const list = Number(listPrice)
  const gb = Number(gbPrice)
  const priceOk = Number.isFinite(list) && list > 0 && Number.isFinite(gb) && gb > 0 && gb < list
  const discountPct = priceOk ? Math.round((1 - gb / list) * 100) : 0

  /**
   * 🔴 고칠 것을 **항목으로** 센다 — 의뢰서 §4: *"오류가 났을 때 뭘 고쳐야 하는지 바로 보여야 합니다."*
   * 사진이 여기 있는 이유: 의뢰서가 필수를 *사진·상품명·가격·마감* 으로 못박았다(§4 화면 B).
   */
  const issues: string[] = []
  if (!imageUrl) issues.push('상품 사진을 1장 올려주세요')
  if (!name.trim()) issues.push('상품명을 적어주세요')
  if (!priceOk) issues.push('공구가는 정가보다 낮아야 해요')

  const canSubmit = !saving && issues.length === 0
  const showIssues = attempted && issues.length > 0
  const dl = kstParts(deadlineAt(days))

  async function submit() {
    setAttempted(true)
    if (!canSubmit) return
    setSaving(true); setError(null)
    try {
      // ① 상품 — mall_id 는 **서버가** sellers 에서 읽어 스탬프한다(클라가 보내지 않는다).
      let productId = orphanId
      if (!productId) {
        const res = await api.post('/api/seller/products', {
          name: name.trim(), price: gb, original_price: list, image_url: imageUrl || undefined, stock: 0,
        })
        // 응답은 `{ success, data: newProduct }` — 실제 핸들러(seller-orders.routes:1044)를 보고 맞췄다.
        productId = Number(res.data?.data?.id ?? res.data?.id)
        if (!Number.isFinite(productId) || !productId) throw new Error('상품 생성 응답을 이해하지 못했습니다')
        setOrphanId(productId)   // ②가 실패해도 재시도 시 상품을 또 만들지 않는다
      }

      // ② 공구 — 서버가 `공구가 < 상시가` 를 강제한다(어드민 조종석과 같은 함수).
      await api.put(`/api/seller/gb/${productId}`, {
        mode: 'live', price: gb, deadline: deadlineIso(days),
        // 📦 픽업 — 서버가 "픽업일 >= 공구 마감" 을 강제한다(안 끝난 공구를 받으러 오라는 말 방지).
        pickupDate: pickupDate || undefined, storage: storage || undefined,
      })
      navigate('/seller/products?created=1')
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F5F6] pb-28">
      <SEO title="빠른 공구 등록 - 유어딜" description="사진·가격·마감만으로 공동구매를 엽니다" noindex />

      <header className="bg-white border-b border-[#EDE9EB] px-5 pt-1.5 pb-5">
        <div className="max-w-lg mx-auto">
          <button type="button" onClick={() => navigate(-1)} aria-label="뒤로"
            className="h-[38px] flex items-center -ml-1">
            <ChevronLeft className="w-[22px] h-[22px] text-[#1A1719]" strokeWidth={2} />
          </button>
          <h1 className="mt-1 text-[23px] font-extrabold text-[#1A1719] tracking-[-0.04em] leading-tight">빠른 공구 등록</h1>
          <p className="mt-[7px] text-[13.5px] text-[#776F74] tracking-[-0.02em]">사진·가격·마감만 정하면 바로 열려요</p>
        </div>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto">
        {/* 🔴 시안 B-2 — "저장 실패"가 아니라 **고칠 항목을 지목**한다. */}
        {showIssues && (
          <div className="mb-5 rounded-[14px] bg-[#FDEEEE] border border-[#F3C9C9] px-4 py-[15px] flex gap-2.5">
            <AlertCircle className="w-[18px] h-[18px] text-[#C0392F] flex-none mt-px" strokeWidth={2.1} />
            <div>
              <p className="text-[13.5px] font-extrabold text-[#B3352B] tracking-[-0.03em]">
                {issues.length}가지만 고치면 바로 열려요
              </p>
              <ul className="mt-1.5 text-[12.5px] leading-[1.75] text-[#8E3A32] tracking-[-0.02em]">
                {issues.map((m) => <li key={m}>· {m}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* ── 필수 ─────────────────────────────────────────── */}
        <div className="flex items-center gap-[7px] mx-1 mb-[9px]">
          <span className="text-[12px] font-extrabold text-[#1C69EF] tracking-[-0.02em]">필수</span>
          <span className="text-[12px] font-bold text-[#3F383C] tracking-[-0.02em]">사진 · 상품명 · 가격 · 마감</span>
        </div>

        <div className={CARD}>
          <div className="flex gap-3.5 items-center">
            <ImageUpload value={imageUrl} onChange={setImageUrl} label="상품 사진"
              maxSizeKB={800} variant="compact" invalid={attempted && !imageUrl} />
            <div className="min-w-0">
              <p className={`text-[13px] font-bold tracking-[-0.02em] ${attempted && !imageUrl ? 'text-[#B3352B]' : 'text-[#1A1719]'}`}>
                상품 사진 1장
              </p>
              <p className="mt-[5px] text-[12px] leading-[1.55] text-[#8A8288] tracking-[-0.02em]">
                정사각형으로 잘려요.<br />밝은 곳에서 위에서 찍으면 잘 나와요
              </p>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="q-name">상품명</label>
            <input id="q-name" className={INPUT} value={name} maxLength={80}
              onChange={(e) => setName(e.target.value)} placeholder="예: 수제 사과잼 250g" />
          </div>

          <div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={LABEL} htmlFor="q-list">정가</label>
                {/* inputMode=numeric — 모바일에서 숫자 키패드가 바로 뜬다(한 손 조작) */}
                <div className="relative">
                  <input id="q-list" className={`${INPUT} pr-[34px] text-right text-base font-bold`} value={listPrice} inputMode="numeric"
                    onChange={(e) => setListPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="10000" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8A8288] pointer-events-none">원</span>
                </div>
              </div>
              <div>
                <label className={`${LABEL} ${attempted && !priceOk ? 'text-[#B3352B]' : ''}`} htmlFor="q-gb">공구가</label>
                <div className="relative">
                  <input id="q-gb" value={gbPrice} inputMode="numeric"
                    className={`${INPUT} pr-[34px] text-right text-base font-bold ${attempted && !priceOk ? 'border-[1.5px] border-[#D9534A]' : ''}`}
                    onChange={(e) => setGbPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="7000" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8A8288] pointer-events-none">원</span>
                </div>
              </div>
            </div>

            {/* 🔴 서버가 어차피 거부하지만(validateGbSession), 제출 후에 알면 3분이 깨진다. 여기서 먼저 말한다. */}
            {(priceOk || (listPrice && gbPrice)) && (
              <p className={`mt-2.5 flex items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.025em] ${priceOk ? 'text-[#2E7D5B]' : 'text-[#C0392F]'}`}>
                <span className={`w-[15px] h-[15px] rounded-full flex items-center justify-center flex-none ${priceOk ? 'bg-[#2E7D5B]' : 'bg-[#C0392F]'}`}>
                  {priceOk
                    ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.4} />
                    : <X className="w-2.5 h-2.5 text-white" strokeWidth={3.4} />}
                </span>
                {priceOk ? `${discountPct}% 할인으로 열려요` : '공구가는 정가보다 낮아야 해요'}
              </p>
            )}
          </div>

          <div>
            <label className={LABEL}>마감</label>
            {/* 날짜 피커 대신 버튼 3개 — 한 손으로 제일 괴로운 위젯을 뺀다(UX 기준 ④). */}
            <div className="grid grid-cols-3 gap-2">
              {DEADLINE_PRESETS.map((p) => (
                <button key={p.days} type="button" onClick={() => setDays(p.days)}
                  aria-pressed={days === p.days}
                  className={`h-14 rounded-xl text-[15.5px] font-bold tracking-[-0.02em] transition-colors ${
                    days === p.days ? CHIP_ON : CHIP_OFF
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* 🔴 "7일"만 보고는 그게 며칠인지 아무도 모른다. */}
            <p className="mt-2.5 text-[12px] text-[#776F74] tracking-[-0.02em]">
              {dl.m}월 {dl.d}일 ({dl.dow}) 밤 11시 59분에 마감돼요
            </p>
          </div>
        </div>

        {/* ── 선택 ─────────────────────────────────────────── */}
        <div className="flex items-center gap-[7px] mx-1 mt-[22px] mb-[9px]">
          <span className="text-[12px] font-extrabold text-[#8A8288] tracking-[-0.02em]">선택</span>
          <span className="text-[12px] font-semibold text-[#8A8288] tracking-[-0.02em]">나중에 바꿀 수 있어요</span>
        </div>

        <div className={CARD}>
          <div>
            <label className={LABEL} htmlFor="q-pickup">픽업일</label>
            {/* 공구 마감 **이후**만 의미가 있다 — min 으로 미리 좁혀 서버 거절을 줄인다. */}
            <div className="relative">
              <input id="q-pickup" type="date" className={`${INPUT} pr-11`} value={pickupDate}
                min={dl.ymd}
                onChange={(e) => setPickupDate(e.target.value)} />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8288] pointer-events-none" strokeWidth={1.9} />
            </div>
          </div>

          <div>
            <label className={LABEL}>보관구분</label>
            <div className="grid grid-cols-2 gap-2">
              {(['room', 'cold'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setStorage(storage === k ? null : k)}
                  aria-pressed={storage === k}
                  className={`h-14 rounded-xl text-[15.5px] font-bold tracking-[-0.02em] transition-colors ${
                    storage === k ? CHIP_ON : CHIP_OFF
                  }`}>
                  {STORAGE_LABEL[k]}
                </button>
              ))}
            </div>
            {/* 🔴 고른 즉시 소비자에게 뭐라고 나가는지 보여준다 — 나중에 알면 이미 팔린 뒤다.
                ⚠️ 문구는 **법무 확인 대기**(체크리스트 X4c) 임시 표기다. 시안이 ~어요체로 그렸지만
                   여기서 바꾸지 않는다 — 법무 회신 전까지 고지 문구는 건드리지 않는 것이 이 레포 방침. */}
            {storage && (
              <div className="mt-2.5 rounded-[10px] bg-[#EAF1FE] px-3 py-[11px]">
                <p className="text-[10.5px] font-extrabold text-[#C4657A] tracking-[0.03em] mb-1">손님에게 이렇게 보여요</p>
                <p className="text-[12px] leading-[1.6] text-[#8E4356] tracking-[-0.02em]">{STORAGE_NOTICE[storage]}</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-[14px] border border-[#F3C9C9] bg-[#FDEEEE] p-3">
            <p className="text-[13px] text-[#B3352B] tracking-[-0.02em]">{error}</p>
            {/* 🔴 ①만 성공한 상태를 **숨기지 않는다** — 숨기면 운영자가 같은 상품을 또 만든다. */}
            {orphanId && (
              <p className="text-[12px] text-[#8E3A32] mt-1.5 tracking-[-0.02em]">
                상품(#{orphanId})은 이미 만들어졌어요. 다시 누르면 공구 설정만 재시도해요.
              </p>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* 제출 — 하단 고정. 스크롤해서 찾지 않는다(한 손 조작).
          🔴 아래 여백 28px — 모바일 주소창에 잘리지 않게(의뢰서 §5.4). */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-[#EAE5E7] px-4 pt-3 pb-7">
        <div className="max-w-lg mx-auto">
          <button type="button" onClick={submit} disabled={saving}
            className={`w-full h-14 rounded-[14px] text-[16.5px] font-extrabold tracking-[-0.03em] inline-flex items-center justify-center gap-2 transition-colors ${
              canSubmit ? 'bg-[#1A1719] text-white active:bg-black' : 'bg-[#F1EDEF] text-[#A9A2A6]'
            }`}>
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            {orphanId ? '공구 설정 다시 시도' : '공구 열기'}
          </button>
        </div>
      </div>
    </div>
  )
}
