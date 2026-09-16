/**
 * 🏪 **업체 정보 — 한 페이지** (2026-09-16 대표 확정, 당근비즈니스 시안)
 *
 * > 대표: *"셀러대시보드에서 업체 정보 입력하는 페이지는 하나로 통일하고 보내준 당근 이미지처럼
 * > 구성해줄래? 굳이 분산할 필요없는 것들은 한 페이지로 모아주면 좋을 것 같아"*
 *
 * ## 무엇을 모았나 (실측 — 종전엔 세 곳이었다)
 * | 종전 | 무엇이 있었나 |
 * |---|---|
 * | `/seller/stores` → [정보] **모달** | 이름·주소·전화·좌표·확인 PIN·담당자 전화 |
 * | `/seller/mini-shop` (유어샵 설정) | 배너 이미지·브랜드 컬러 (+ **죽은** 라이브 URL 3개) |
 * | `/seller/profile` (셀러 프로필) | 대표 이미지·소개·SNS 4종·홈페이지·카톡 링크 |
 *
 * 셋 다 답하는 질문이 하나다 — *"손님에게 우리 가게가 어떻게 보이는가."* 그래서 한 장이다.
 *
 * ## 무엇을 **안** 모았나 (성격이 다르다 — 섞으면 더 나빠진다)
 *   - `/seller/business-info` — 사업자 정보·정산 계좌·등록증. **심사와 돈**이다. 당근도 증빙 서류는
 *     따로 두고, 계좌는 소유자만 바꿀 수 있으며 PIN 인증이 붙는다. 매대 정보와 한 [저장]에 묶으면
 *     가게 이름을 고치다 계좌 인증 창이 뜬다.
 *   - `/seller/stores` — 매장 **목록·추가·삭제·위임**. 여러 매장을 다루는 화면이다.
 *   - `/seller/profile` 의 배송 설정·보안 PIN·카카오 연동 — 계정·운영이다.
 *
 * ## ⚠️ 저장은 두 곳으로 나간다
 * 매장(전파 포함)과 유어샵은 **저장소가 다르다**(`useStoreInfo` 주석 참조). 한쪽만 실패하면
 * 그쪽만 말하고 그쪽 값만 '안 저장됨' 으로 남긴다 — 뭉치면 이미 저장된 절반까지 다시 입력한다.
 *
 * ## ⚠️ 매장 이름·주소·전화를 고치면 **그 매장의 이용권 전부**가 따라 바뀐다
 * 서버(`store-profile.ts`)가 전파까지 SSOT 다. 그 사실을 저장 버튼이 미리 말한다.
 */
import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import DashboardCard from '@/components/dashboard/DashboardCard'
import SellerBottomBar from '@/components/seller-layout/SellerBottomBar'
import BrandLoader from '@/components/brand/BrandLoader'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { toast } from '@/hooks/useToast'
import { formatPhone, isValidMobilePhone } from '@/utils/format-phone'
import { Loader2, Map, MapPin, Store } from 'lucide-react'
import { useStoreInfo, type StoreInfoForm } from './seller-store-info/useStoreInfo'
import StorePreviewCard from './seller-store-info/StorePreviewCard'
import ImageField from './seller-store-info/ImageField'

const INPUT = 'w-full rounded-lg border border-rule px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400'

/** 당근 시안의 브랜드 컬러 견본 — 자유 입력도 그대로 받는다. */
const SWATCHES = ['#1C69EF', '#0F172A', '#374151', '#0E7C66', '#B45309', '#9333EA']

export default function SellerStoreInfoPage() {
  const [sp] = useSearchParams()
  // 기본은 **지금 전환해 둔 매장**이다. `?id=` 는 매장 목록에서 다른 매장을 바로 열 때만 쓴다.
  const sellerId = useMemo(() => {
    const q = Number(sp.get('id'))
    if (Number.isFinite(q) && q > 0) return q
    const ls = Number(typeof window !== 'undefined' ? localStorage.getItem('seller_id') : 0)
    return Number.isFinite(ls) && ls > 0 ? ls : null
  }, [sp])

  const { form, set, loading, loadError, saving, dirty, storeDirty, save, productCount, category } = useStoreInfo(sellerId)
  const [showMap, setShowMap] = useState(false)
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  function pickPlace(p: KakaoPlace) {
    set('name', p.place_name || form.name)
    set('address', p.road_address_name || p.address_name || form.address)
    if (p.phone) set('phone', p.phone)
    set('lat', p.y || ''); set('lng', p.x || '')
    if (p.id) set('kakao_place_url', `https://place.map.kakao.com/${p.id}`)
    setShowMap(false)
  }

  async function onSave() {
    if (saving) return
    if (!form.name.trim()) { toast.error('매장 이름을 입력해주세요'); return }
    if (form.manager_phone && !isValidMobilePhone(form.manager_phone)) {
      toast.error('담당자 전화번호는 휴대폰 번호(01x)로 입력해주세요'); return
    }
    if (form.brand_color && !/^#[0-9A-Fa-f]{6}$/.test(form.brand_color)) {
      toast.error('브랜드 컬러는 #RRGGBB 형식이에요 (예: #1C69EF)'); return
    }
    const r = await save()
    if (r.ok) {
      toast.success(r.propagated > 0
        ? `저장했어요 — 이용권 ${r.propagated}개에 함께 반영됐습니다`
        : '저장했어요')
      return
    }
    // 부분 성공을 숨기지 않는다 — 어느 쪽이 안 됐는지 그대로.
    toast.error([r.failed.store, r.failed.shop].filter(Boolean).join(' · ') || '저장에 실패했어요')
  }

  const saveLabel = saving ? '저장 중…'
    : productCount > 0 && storeDirty ? `저장 (이용권 ${productCount}개 반영)`
    : '저장'

  if (!sellerId) {
    return (
      <SellerLayout title="업체 정보">
        <div className="mx-auto max-w-5xl">
          <DashboardCard>
            <p className="text-sm text-gray-600">
              먼저 매장을 등록해 주세요. <Link to="/seller/stores" className="font-semibold text-brand-text underline">매장 관리로 가기</Link>
            </p>
          </DashboardCard>
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="업체 정보">
      <SEO title="업체 정보 - 유어딜 셀러" description="매장 정보와 유어샵 소개를 한 곳에서" noindex />
      {loading ? <BrandLoader forceLight /> : (
        <div className="mx-auto max-w-5xl">
          {loadError && (
            <p className="mb-3 rounded-xl border border-rule bg-white px-4 py-3 text-sm text-tone-bad">{loadError}</p>
          )}

          {/* 당근 시안: 왼쪽 편집 / 오른쪽 미리보기. 폰은 한 줄로 쌓되 **폼이 먼저** —
              작은 화면에서 미리보기가 위에 있으면 고칠 칸까지 매번 스크롤해야 한다. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4">
              <DashboardCard title="기본 정보" subtitle="손님이 보는 가게 이름·주소·전화번호예요">
                <div className="space-y-3">
                  <Field label="매장 이름">
                    <input value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="주소">
                    <input value={form.address} onChange={(e) => set('address', e.target.value)} className={INPUT} />
                    {form.lat && form.lng && (
                      <p className="mt-1 flex items-center gap-0.5 text-[10px] text-tone-ok">
                        <MapPin className="h-3 w-3" /> 좌표 {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
                      </p>
                    )}
                    <button type="button" onClick={() => setShowMap((v) => !v)}
                      className="ur-btn ur-btn-sm ur-btn-secondary mt-2">
                      <Map className="h-3.5 w-3.5" aria-hidden="true" />
                      {showMap ? '지도 접기' : '지도에서 위치 선택'}
                    </button>
                    {showMap && (
                      <div className="mt-2 rounded-lg border border-rule p-2">
                        <KakaoMapPicker
                          kakaoJsKey={KAKAO_JS_KEY}
                          selectedPlace={form.lat && form.lng ? { name: form.name, address: form.address, lat: form.lat, lng: form.lng } : null}
                          onSelect={pickPlace}
                        />
                      </div>
                    )}
                  </Field>
                  <Field label="전화번호">
                    <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" className={INPUT} />
                  </Field>
                </div>
              </DashboardCard>

              <DashboardCard title="소개" subtitle="유어샵(내 가게 페이지)에 그대로 나와요">
                <div className="space-y-4">
                  <ImageField label="대표 이미지" aspect="square"
                    value={form.profile_image} onChange={(v) => set('profile_image', v)} />
                  <ImageField label="배너 이미지" hint="가로로 긴 사진이 잘 어울려요 (권장 1280×320)"
                    value={form.banner_url} onChange={(v) => set('banner_url', v)} />
                  <Field label="소개글">
                    <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4}
                      placeholder="어떤 가게인지 손님에게 한두 문장으로 알려 주세요."
                      className={`${INPUT} resize-y`} />
                  </Field>
                  <Field label="브랜드 컬러">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SWATCHES.map((c) => (
                        <button key={c} type="button" onClick={() => set('brand_color', c)}
                          aria-label={`색상 ${c}`} style={{ background: c }}
                          className={`h-7 w-7 rounded-full border ${form.brand_color === c ? 'ring-2 ring-offset-1 ring-brand border-transparent' : 'border-rule'}`} />
                      ))}
                      <input value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                        placeholder="#1C69EF" className={`${INPUT} ml-1 w-28`} />
                    </div>
                  </Field>
                </div>
              </DashboardCard>

              <DashboardCard title="홈페이지 · SNS 링크" subtitle="유어샵에 버튼으로 붙어요">
                <div className="grid gap-3 sm:grid-cols-2">
                  <LinkField label="홈페이지" k="website_url" form={form} set={set} ph="https://" />
                  <LinkField label="카카오톡 채널" k="kakao_chat_link" form={form} set={set} ph="http://pf.kakao.com/..." />
                  <LinkField label="인스타그램" k="sns_instagram" form={form} set={set} ph="https://instagram.com/..." />
                  <LinkField label="유튜브" k="sns_youtube" form={form} set={set} ph="https://youtube.com/@..." />
                  <LinkField label="페이스북" k="sns_facebook" form={form} set={set} ph="https://facebook.com/..." />
                  <LinkField label="X (트위터)" k="sns_twitter" form={form} set={set} ph="https://x.com/..." />
                </div>
              </DashboardCard>

              {/* 🔒 손님 화면에 안 나가는 칸 — 미리보기에도 일부러 안 넣는다(위 부품 주석). */}
              <DashboardCard title="운영 정보" subtitle="손님에게는 보이지 않아요">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="매장 확인 PIN" hint="비우면 기존 값을 그대로 둬요">
                    <input value={form.verify_pin} onChange={(e) => set('verify_pin', e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="담당자 전화번호" hint="매장 대표번호와 별개예요">
                    <input value={formatPhone(form.manager_phone)} onChange={(e) => set('manager_phone', e.target.value)}
                      placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" className={INPUT} />
                  </Field>
                </div>
              </DashboardCard>

              <p className="px-1 text-[11px] text-gray-400">
                사업자 정보 · 정산 계좌 · 등록증은{' '}
                <Link to="/seller/business-info" className="font-semibold text-brand-text underline">사업자 정보</Link>
                에서 따로 관리해요.
              </p>
            </div>

            {/* PC 는 스크롤을 따라오는 미리보기 + 저장. 당근 시안의 오른쪽 열이다. */}
            <aside className="space-y-3 lg:sticky lg:top-4">
              <StorePreviewCard form={form} category={category} />
              <button type="button" onClick={onSave} disabled={!dirty || saving}
                className="ur-btn ur-btn-lg ur-btn-primary hidden w-full disabled:opacity-40 lg:flex">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saveLabel}
              </button>
              {!dirty && !saving && (
                <p className="hidden text-center text-[11px] text-gray-400 lg:block">바뀐 내용이 없어요</p>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* 폰은 고정 바 — 페이지마다 손으로 여백을 맞추면 반드시 어긋난다(부품이 스페이서까지 맡는다). */}
      {!loading && (
        <SellerBottomBar>
          <button type="button" onClick={onSave} disabled={!dirty || saving}
            className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveLabel}
          </button>
        </SellerBottomBar>
      )}
    </SellerLayout>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-gray-700">{label}</label>
      {hint && <p className="mb-1 text-[11px] text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

function LinkField({ label, k, form, set, ph }: {
  label: string
  k: keyof StoreInfoForm
  form: StoreInfoForm
  set: <K extends keyof StoreInfoForm>(k: K, v: StoreInfoForm[K]) => void
  ph: string
}) {
  return (
    <Field label={label}>
      <input value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value as StoreInfoForm[typeof k])}
        placeholder={ph} inputMode="url" className={INPUT} />
    </Field>
  )
}
