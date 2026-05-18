/**
 * 🛡️ 2026-05-18: 셀러 숙소 등록 (PR 2/6).
 *
 * 폼 단계:
 *   1) 기본 정보 (상품명/설명/대표 이미지/숙소 타입)
 *   2) 위치 (주소/시도/시군구/좌표)
 *   3) 체크인 정책 (시간/취소정책/하우스 룰)
 *   4) 시설 (어메니티 다중 선택)
 *
 * 등록 후 → /seller/stays/:id 로 이동 (객실 추가 + 캘린더 작업).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Building2, MapPin, Clock, Shield, Sparkles, ArrowLeft } from 'lucide-react'
import ImageUpload from '@/components/upload/ImageUpload'

interface Amenity { code: string; label_ko: string; icon_emoji: string; category: string }

const PROPERTY_TYPES = [
  { value: 'pension',    label: '펜션', emoji: '🏡' },
  { value: 'hotel',      label: '호텔', emoji: '🏨' },
  { value: 'motel',      label: '모텔', emoji: '🛏️' },
  { value: 'guesthouse', label: '게스트하우스', emoji: '🏠' },
  { value: 'resort',     label: '리조트', emoji: '🌴' },
  { value: 'glamping',   label: '글램핑', emoji: '⛺' },
  { value: 'house',      label: '주택/별장', emoji: '🏘️' },
] as const

const CANCELLATION_POLICIES = [
  { value: 'flexible',       label: '관대 (24h 전 100% 환불)', desc: '체크인 24시간 전까지 무료 취소' },
  { value: 'standard',       label: '일반 (48h 전 100%, 24h 전 50%)', desc: '추천' },
  { value: 'strict',         label: '엄격 (72h 전 50%, 이후 환불 불가)', desc: '성수기·인기 숙소 권장' },
  { value: 'non_refundable', label: '환불 불가 (가격 할인)', desc: '대신 가격 ↓ 노출 시 강조' },
] as const

export default function SellerStayNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [amenitiesList, setAmenitiesList] = useState<Amenity[]>([])

  const [form, setForm] = useState({
    name: '',
    description: '',
    image_url: '',
    property_type: 'pension' as typeof PROPERTY_TYPES[number]['value'],
    star_rating: '' as '' | '1' | '2' | '3' | '4' | '5',
    total_rooms: 1,

    check_in_time: '15:00',
    check_out_time: '11:00',

    address: '',
    address_detail: '',
    postal_code: '',
    region_sido: '',
    region_sigungu: '',

    cancellation_policy: 'standard' as typeof CANCELLATION_POLICIES[number]['value'],
    custom_cancellation_text: '',
    house_rules: '',
    check_in_instructions: '',

    description_full: '',
    min_nights: 1,
    advance_booking_days: 90,

    amenities: [] as string[],
    room_amenities: [] as string[],
  })

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) { navigate('/seller/login'); return }
    api.get('/api/seller/stays-amenities', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.data?.success) setAmenitiesList(r.data.data || []) })
      .catch(() => { /* fail-soft */ })
  }, [navigate])

  function toggleAmenity(field: 'amenities' | 'room_amenities', code: string) {
    setForm((f) => {
      const cur = new Set(f[field])
      if (cur.has(code)) cur.delete(code); else cur.add(code)
      return { ...f, [field]: Array.from(cur) }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      toast.error('숙소명은 2자 이상 입력해주세요')
      return
    }
    setSubmitting(true)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.post('/api/seller/stays', {
        ...form,
        star_rating: form.star_rating ? Number(form.star_rating) : null,
        total_rooms: Number(form.total_rooms) || 1,
        min_nights: Number(form.min_nights) || 1,
        advance_booking_days: Number(form.advance_booking_days) || 90,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) {
        toast.success('숙소가 등록되었습니다 — 이제 객실을 추가하세요')
        navigate(`/seller/stays/${res.data.data.product_id}`)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '등록 실패')
    } finally { setSubmitting(false) }
  }

  const propertyAmenities = amenitiesList.filter((a) => a.category === 'property' || a.category === 'service')
  const roomAmenitiesList = amenitiesList.filter((a) => a.category === 'room')

  return (
    <SellerLayout title="숙소 등록">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="숙소 등록"
          subtitle="기본 정보 입력 후 다음 단계에서 객실/가격/캘린더를 추가합니다"
          icon={<Building2 className="h-5 w-5" />}
          actions={
            <button
              type="button"
              onClick={() => navigate('/seller/stays')}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />목록
            </button>
          }
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 기본 정보 */}
          <Section icon={<Building2 className="w-5 h-5 text-blue-600" />} title="기본 정보">
            <Field label="숙소명" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예) 제주 오션뷰 펜션"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </Field>
            <Field label="간단 설명">
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="목록에 노출되는 한 줄 설명"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <ImageUpload
              label="대표 이미지"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              tokenKey="seller_token"
              aspectRatio="video"
            />
            <Field label="숙소 타입" required>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PROPERTY_TYPES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, property_type: p.value })}
                    className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                      form.property_type === p.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl">{p.emoji}</div>
                    <div className={`text-xs font-bold mt-1 ${form.property_type === p.value ? 'text-blue-700' : 'text-gray-900'}`}>
                      {p.label}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
            {form.property_type === 'hotel' && (
              <Field label="호텔 등급 (성)">
                <select
                  value={form.star_rating}
                  onChange={(e) => setForm({ ...form, star_rating: e.target.value as typeof form.star_rating })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">선택 안 함</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}성</option>)}
                </select>
              </Field>
            )}
            <Field label="총 객실 수 (참고용)">
              <input
                type="number"
                min={1}
                value={form.total_rooms}
                onChange={(e) => setForm({ ...form, total_rooms: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">실제 예약 가능 객실은 다음 단계에서 객실 타입별로 등록</p>
            </Field>
          </Section>

          {/* 2. 위치 */}
          <Section icon={<MapPin className="w-5 h-5 text-rose-600" />} title="위치">
            <div className="grid grid-cols-2 gap-3">
              <Field label="시/도">
                <input
                  type="text"
                  value={form.region_sido}
                  onChange={(e) => setForm({ ...form, region_sido: e.target.value })}
                  placeholder="제주특별자치도"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
              <Field label="시/군/구">
                <input
                  type="text"
                  value={form.region_sigungu}
                  onChange={(e) => setForm({ ...form, region_sigungu: e.target.value })}
                  placeholder="서귀포시"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="주소">
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="중문관광로 72번길 35"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="상세 주소 (선택)">
              <input
                type="text"
                value={form.address_detail}
                onChange={(e) => setForm({ ...form, address_detail: e.target.value })}
                placeholder="2층"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
          </Section>

          {/* 3. 체크인 정책 */}
          <Section icon={<Clock className="w-5 h-5 text-amber-600" />} title="체크인 / 정책">
            <div className="grid grid-cols-2 gap-3">
              <Field label="체크인 시간">
                <input
                  type="time"
                  value={form.check_in_time}
                  onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
              <Field label="체크아웃 시간">
                <input
                  type="time"
                  value={form.check_out_time}
                  onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="최소 숙박 박수">
                <input
                  type="number"
                  min={1}
                  value={form.min_nights}
                  onChange={(e) => setForm({ ...form, min_nights: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
              <Field label="사전 예약 가능 일수">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.advance_booking_days}
                  onChange={(e) => setForm({ ...form, advance_booking_days: Number(e.target.value) || 90 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="취소 정책" required>
              <div className="space-y-2">
                {CANCELLATION_POLICIES.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      form.cancellation_policy === p.value
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancellation_policy"
                      value={p.value}
                      checked={form.cancellation_policy === p.value}
                      onChange={() => setForm({ ...form, cancellation_policy: p.value })}
                      className="mt-0.5 text-amber-500"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900">{p.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="추가 안내 (취소 정책)">
              <textarea
                value={form.custom_cancellation_text}
                onChange={(e) => setForm({ ...form, custom_cancellation_text: e.target.value })}
                rows={2}
                placeholder="예) 성수기 (7-8월) 환불 불가"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </Field>
            <Field label="하우스 룰">
              <textarea
                value={form.house_rules}
                onChange={(e) => setForm({ ...form, house_rules: e.target.value })}
                rows={3}
                placeholder="예) 흡연 불가 · 반려동물 불가 · 파티 금지 · 정숙 시간 22시-08시"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </Field>
            <Field label="체크인 안내">
              <textarea
                value={form.check_in_instructions}
                onChange={(e) => setForm({ ...form, check_in_instructions: e.target.value })}
                rows={2}
                placeholder="예) 리셉션에서 신분증 제시 / 비밀번호: 입실 시 문자 전송"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </Field>
          </Section>

          {/* 4. 시설 (어메니티) */}
          <Section icon={<Sparkles className="w-5 h-5 text-violet-600" />} title="시설 / 어메니티">
            <Field label="숙소 공통 시설">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {propertyAmenities.map((a) => {
                  const on = form.amenities.includes(a.code)
                  return (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => toggleAmenity('amenities', a.code)}
                      className={`p-2 rounded-lg border-2 text-center text-xs transition-all ${
                        on ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg">{a.icon_emoji}</div>
                      <div className="mt-0.5 font-semibold">{a.label_ko}</div>
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="객실 기본 시설">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {roomAmenitiesList.map((a) => {
                  const on = form.room_amenities.includes(a.code)
                  return (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => toggleAmenity('room_amenities', a.code)}
                      className={`p-2 rounded-lg border-2 text-center text-xs transition-all ${
                        on ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg">{a.icon_emoji}</div>
                      <div className="mt-0.5 font-semibold">{a.label_ko}</div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                ※ 객실 타입별로 추가/변경 가능 (다음 단계)
              </p>
            </Field>
          </Section>

          {/* Submit */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <p className="font-bold">다음 단계</p>
                <p className="mt-1">등록 완료 후 (1) 객실 타입 추가 (스탠다드/디럭스/스위트 등) (2) 평일/주말/공휴일 가격 설정 (3) 가용 캘린더 등록을 진행합니다.</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '숙소 등록 + 객실 설정으로 →'}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
