/**
 * 공통 상품등록 폼 (BlogPay 스타일)
 * - Seller, Agency, Admin 공통 사용
 * - 섹션별 아코디언 카드 UI
 * - 역할별 필드 가시성 제어 (공급가는 어드민만 수정 가능)
 * - 결제수단 섹션 제거
 */
import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import ProductOptionForm, { ProductOption } from '@/components/ProductOptionForm'

export type UserRole = 'seller' | 'agency' | 'admin'

export interface ProductFormData {
  name: string
  description: string
  long_description: string
  price: string
  compare_at_price: string  // 이전 판매가
  supply_price: string       // 공급가 (어드민 전용)
  stock: string
  image_url: string
  detail_images: string[]
  category: string
  product_type: string
  is_active: boolean
  is_taxable: boolean
  is_displayed: boolean
  shipping_type: 'shippable' | 'non_shippable'
  shipping_fee: string
  sale_period_enabled: boolean
  sale_start_at: string
  sale_end_at: string
  display_category: string
  // 식사권 전용
  restaurant_name?: string
  restaurant_address?: string
  restaurant_phone?: string
  voucher_terms?: string
  voucher_expiry?: string
  group_buy_target?: string
  group_buy_deadline?: string
  store_verify_pin?: string
  // 라이브 전용
  live_stream_id?: string
  live_only_price?: string
  live_price_enabled?: boolean
}

export const EMPTY_FORM: ProductFormData = {
  name: '',
  description: '',
  long_description: '',
  price: '',
  compare_at_price: '',
  supply_price: '',
  stock: '999',
  image_url: '',
  detail_images: [],
  category: 'lifestyle',
  product_type: 'live',
  is_active: true,
  is_taxable: true,
  is_displayed: true,
  shipping_type: 'shippable',
  shipping_fee: '3000',
  sale_period_enabled: false,
  sale_start_at: '',
  sale_end_at: '',
  display_category: '',
}

const CATEGORIES = [
  { value: 'fashion', label: '패션' },
  { value: 'beauty', label: '뷰티' },
  { value: 'food', label: '식품' },
  { value: 'electronics', label: '전자기기' },
  { value: 'lifestyle', label: '라이프스타일' },
  { value: 'meal_voucher', label: '맛집 식사권' },
]

interface SectionCardProps {
  title: string
  required?: boolean
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}

function SectionCard({ title, required, summary, defaultOpen = true, children }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1">
          <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
          {required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {summary && <span className="text-[12px] text-gray-500">{summary}</span>}
          {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
        active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

interface Props {
  role: UserRole
  formData: ProductFormData
  setFormData: (data: ProductFormData | ((prev: ProductFormData) => ProductFormData)) => void
  productOptions: ProductOption[]
  setProductOptions: (opts: ProductOption[]) => void
  isEdit?: boolean
}

export default function ProductRegistrationForm({
  role, formData, setFormData, productOptions, setProductOptions, isEdit,
}: Props) {
  const canEditSupplyPrice = role === 'admin'
  const update = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const isMealVoucher = formData.category === 'meal_voucher'

  return (
    <div className="space-y-4">
      {/* ── 표준 카테고리 ── */}
      <SectionCard title="표준 카테고리" summary={formData.category ? CATEGORIES.find(c => c.value === formData.category)?.label : '설정안함'}>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => update('category', cat.value)}
              className={`py-3 rounded-lg text-sm font-medium border-2 transition-all ${
                formData.category === cat.value
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── 전시 카테고리 (라이브 스트림 등) ── */}
      {role !== 'agency' && (
        <SectionCard title="전시 카테고리" summary={formData.display_category || '설정안함'} defaultOpen={false}>
          <input
            type="text"
            value={formData.display_category}
            onChange={e => update('display_category', e.target.value)}
            placeholder="예: 신상품, 베스트, 특가"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
          />
        </SectionCard>
      )}

      {/* ── 상품명 ── */}
      <SectionCard title="상품명" required summary={formData.name ? `${formData.name.length}자` : '설정안함'}>
        <input
          type="text"
          value={formData.name}
          onChange={e => update('name', e.target.value)}
          placeholder="상품명을 입력하세요."
          maxLength={100}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
        />
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">추가 상품 설명</label>
          <input
            type="text"
            value={formData.description}
            onChange={e => update('description', e.target.value)}
            placeholder="추가 상품 설명을 입력하세요."
            maxLength={200}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
          />
        </div>
      </SectionCard>

      {/* ── 상품가격 ── */}
      <SectionCard
        title="상품가격"
        required
        summary={formData.price ? `${Number(formData.price).toLocaleString()}원` : '설정안함'}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">판매가 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.price}
                onChange={e => update('price', e.target.value)}
                placeholder="0"
                min={0}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">이전 판매가</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.compare_at_price}
                onChange={e => update('compare_at_price', e.target.value)}
                placeholder="0"
                min={0}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
              공급가
              {!canEditSupplyPrice && <span className="text-[10px] text-gray-400">(플랫폼 고정)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.supply_price}
                onChange={e => update('supply_price', e.target.value)}
                placeholder="0"
                min={0}
                disabled={!canEditSupplyPrice}
                className={`flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none ${
                  canEditSupplyPrice
                    ? 'border-gray-200 text-gray-900 focus:border-gray-400'
                    : 'border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed'
                }`}
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 재고수량 ── */}
      <SectionCard
        title="재고수량"
        summary={`${formData.stock || 0}개 / ${formData.is_active ? '판매중' : '판매중지'}`}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">수량</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.stock}
                onChange={e => update('stock', e.target.value)}
                min={0}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
              <span className="text-sm text-gray-500">개</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">판매상태</label>
            <select
              value={formData.is_active ? '1' : '0'}
              onChange={e => update('is_active', e.target.value === '1')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
            >
              <option value="1">판매중</option>
              <option value="0">판매중지</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">'0'으로 설정 시 품절상품으로 표시됩니다.</p>
      </SectionCard>

      {/* ── 이미지 ── */}
      <SectionCard
        title="이미지"
        required
        summary={`${formData.image_url ? 1 + formData.detail_images.length : 0}/5`}
      >
        <p className="text-xs text-gray-600 mb-2">대표 이미지</p>
        <ImageUpload
          value={formData.image_url}
          onChange={(url) => update('image_url', url)}
        />
        <p className="text-xs text-gray-600 mt-4 mb-2">상세 이미지 (최대 4장)</p>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <ImageUpload
              key={i}
              value={formData.detail_images[i] || ''}
              onChange={(url) => {
                const arr = [...formData.detail_images]
                arr[i] = url
                update('detail_images', arr.filter(Boolean))
              }}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── 상세설명 ── */}
      <SectionCard title="상세설명" summary={formData.long_description ? `${formData.long_description.length}자` : '설정안함'} defaultOpen={false}>
        <textarea
          value={formData.long_description}
          onChange={e => update('long_description', e.target.value)}
          placeholder="상품 상세설명을 입력하세요. 긴 설명이 가능합니다."
          rows={8}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-y"
        />
      </SectionCard>

      {/* ── 옵션 ── */}
      <SectionCard
        title="옵션"
        summary={productOptions.length > 0 ? `${productOptions.length}개 옵션` : '설정안함'}
        defaultOpen={false}
      >
        <ProductOptionForm
          options={productOptions}
          onChange={setProductOptions}
        />
      </SectionCard>

      {/* ── 배송비 ── */}
      <SectionCard
        title="배송비"
        summary={
          formData.shipping_type === 'non_shippable'
            ? '미배송상품'
            : `기본배송비 ${Number(formData.shipping_fee || 0).toLocaleString()}원`
        }
        defaultOpen={false}
      >
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">배송여부</label>
          <div className="flex gap-2">
            <TabButton
              active={formData.shipping_type === 'shippable'}
              onClick={() => update('shipping_type', 'shippable')}
            >
              배송상품
            </TabButton>
            <TabButton
              active={formData.shipping_type === 'non_shippable'}
              onClick={() => update('shipping_type', 'non_shippable')}
            >
              미배송상품
            </TabButton>
          </div>
        </div>
        {formData.shipping_type === 'shippable' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">기본배송비</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.shipping_fee}
                onChange={e => update('shipping_fee', e.target.value)}
                min={0}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 판매기간 설정 ── */}
      <SectionCard
        title="판매기간 설정"
        summary={formData.sale_period_enabled ? '사용' : '사용안함'}
        defaultOpen={false}
      >
        <div className="flex gap-2 mb-3">
          <TabButton active={!formData.sale_period_enabled} onClick={() => update('sale_period_enabled', false)}>
            사용안함
          </TabButton>
          <TabButton active={formData.sale_period_enabled} onClick={() => update('sale_period_enabled', true)}>
            사용
          </TabButton>
        </div>
        {formData.sale_period_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">시작일시</label>
              <input
                type="datetime-local"
                value={formData.sale_start_at}
                onChange={e => update('sale_start_at', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">종료일시</label>
              <input
                type="datetime-local"
                value={formData.sale_end_at}
                onChange={e => update('sale_end_at', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 맛집 식사권 (카테고리 선택 시만) ── */}
      {isMealVoucher && (
        <SectionCard title="맛집 식사권 정보" required defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">맛집명 *</label>
              <input
                type="text"
                value={formData.restaurant_name || ''}
                onChange={e => update('restaurant_name', e.target.value)}
                placeholder="예: 홍대 삼겹살집"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">맛집 주소 *</label>
              <input
                type="text"
                value={formData.restaurant_address || ''}
                onChange={e => update('restaurant_address', e.target.value)}
                placeholder="서울시 마포구 와우산로 1"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">맛집 전화번호</label>
              <input
                type="tel"
                value={formData.restaurant_phone || ''}
                onChange={e => update('restaurant_phone', e.target.value)}
                placeholder="02-1234-5678"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">사용조건</label>
              <textarea
                value={formData.voucher_terms || ''}
                onChange={e => update('voucher_terms', e.target.value)}
                placeholder="예: 2인 이상 주문 시 사용 가능, 주말 제외"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">만료일</label>
                <input
                  type="date"
                  value={formData.voucher_expiry || ''}
                  onChange={e => update('voucher_expiry', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">매장 확인 PIN</label>
                <input
                  type="text"
                  value={formData.store_verify_pin || ''}
                  onChange={e => update('store_verify_pin', e.target.value)}
                  placeholder="4자리 숫자"
                  maxLength={4}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">공동구매 목표</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.group_buy_target || ''}
                    onChange={e => update('group_buy_target', e.target.value)}
                    min={0}
                    placeholder="10"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                  />
                  <span className="text-sm text-gray-500">명</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">공동구매 마감</label>
                <input
                  type="datetime-local"
                  value={formData.group_buy_deadline || ''}
                  onChange={e => update('group_buy_deadline', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── 기타설정 ── */}
      <SectionCard
        title="기타설정"
        summary={`${formData.is_taxable ? '과세' : '비과세'} / ${formData.is_displayed ? '전시' : '미전시'}`}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">과세여부</label>
            <div className="flex gap-2">
              <TabButton active={formData.is_taxable} onClick={() => update('is_taxable', true)}>과세</TabButton>
              <TabButton active={!formData.is_taxable} onClick={() => update('is_taxable', false)}>비과세</TabButton>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">전시여부</label>
            <div className="flex gap-2">
              <TabButton active={formData.is_displayed} onClick={() => update('is_displayed', true)}>전시</TabButton>
              <TabButton active={!formData.is_displayed} onClick={() => update('is_displayed', false)}>미전시</TabButton>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
