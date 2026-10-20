/**
 * 🏪 **업체 정보 한 페이지** — 불러오기·저장 오케스트레이션 (2026-09-16 대표 확정)
 *
 * > 대표: *"셀러대시보드에서 업체 정보 입력하는 페이지는 하나로 통일하고 보내준 당근 이미지처럼
 * > 구성해줄래? 굳이 분산할 필요없는 것들은 한 페이지로 모아주면 좋을 것 같아"*
 *
 * ## 왜 훅으로 빼는가
 * 이 화면은 **서로 다른 두 저장소**를 한 장으로 보여 준다:
 *   ① 매장(`seller_meta` canonical + `sellers` 라벨 + **그 매장의 모든 이용권 복사본**)
 *      → `GET/PATCH /api/seller/stores/:id/profile` (`store-profile.ts` 가 전파까지 SSOT)
 *   ② 셀러 프로필(소개·SNS·배너·브랜드 컬러) → `GET/PUT /api/seller/profile`
 *
 * 화면이 이걸 직접 엮으면 "무엇이 어디로 갔는지" 가 JSX 안에 흩어진다. 여기 한 곳에 둔다.
 *
 * ## ⚠️ 저장은 둘로 나간다 — 부분 성공을 숨기지 않는다
 * 한 번의 [저장]이 요청 두 개다. 하나만 실패했을 때 "저장 실패" 로 뭉치면 사장님은 **이미 저장된
 * 절반까지 다시 입력한다.** 그래서 어느 쪽이 실패했는지 그대로 돌려준다.
 *
 * ## ⚠️ 바뀐 것만 보낸다
 * 매장 PATCH 는 **빈 값을 무시**한다(`store-profile.ts` — 빈 문자열로 PIN 을 지우는 동작은
 * 지원하지 않는다). 안 건드린 칸까지 통째로 보내면 그 규칙에 기대게 되어, 규칙이 바뀌는 날
 * 조용히 덮어쓴다. 바뀐 키만 싣는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'

export interface StoreInfoForm {
  // ① 매장 (소비자에게 보이고, 이용권 복사본까지 전파된다)
  name: string
  address: string
  phone: string
  lat: string
  lng: string
  kakao_place_url: string
  // ① 운영 (비공개 — 소비자 화면에 안 나간다)
  verify_pin: string
  manager_phone: string
  // ② 유어샵 (소비자에게 보인다)
  bio: string
  profile_image: string
  banner_url: string
  brand_color: string
  sns_instagram: string
  sns_youtube: string
  sns_facebook: string
  sns_twitter: string
  website_url: string
  kakao_chat_link: string
}

export const EMPTY_FORM: StoreInfoForm = {
  name: '', address: '', phone: '', lat: '', lng: '', kakao_place_url: '',
  verify_pin: '', manager_phone: '',
  bio: '', profile_image: '', banner_url: '', brand_color: '',
  sns_instagram: '', sns_youtube: '', sns_facebook: '', sns_twitter: '',
  website_url: '', kakao_chat_link: '',
}

/** 매장 PATCH 로 가는 키 / 프로필 PUT 으로 가는 키 — 한 곳에서 가른다. */
const STORE_KEYS = ['name', 'address', 'phone', 'lat', 'lng', 'kakao_place_url', 'verify_pin', 'manager_phone'] as const
const SHOP_KEYS = ['bio', 'profile_image', 'banner_url', 'brand_color',
  'sns_instagram', 'sns_youtube', 'sns_facebook', 'sns_twitter', 'website_url', 'kakao_chat_link'] as const

export interface SaveOutcome {
  ok: boolean
  /** 매장 정보가 전파된 이용권 수 (0 이면 전파 대상 없음). */
  propagated: number
  /** 실패한 쪽만 담는다 — 부분 성공을 "전부 실패" 로 뭉개지 않기 위해. */
  failed: { store?: string; shop?: string }
}

export function useStoreInfo(sellerId: number | null) {
  const [form, setForm] = useState<StoreInfoForm>(EMPTY_FORM)
  const [initial, setInitial] = useState<StoreInfoForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** 저장하면 몇 개 이용권에 반영되는지 — 버튼이 미리 말해 준다. */
  const [productCount, setProductCount] = useState(0)
  /** 카카오 업종(예: "음식점 > 일식 > 돈까스,우동") — 미리보기 부제. 편집 대상 아님. */
  const [category, setCategory] = useState('')

  const set = useCallback(<K extends keyof StoreInfoForm>(k: K, v: StoreInfoForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
  }, [])

  useEffect(() => {
    if (!sellerId) return
    let alive = true
    setLoading(true); setLoadError(null)
    Promise.all([
      api.get(`/api/seller/stores/${sellerId}/profile`).catch((e) => ({ __err: e } as never)),
      api.get('/api/seller/profile').catch((e) => ({ __err: e } as never)),
    ]).then(([storeRes, shopRes]) => {
      if (!alive) return
      const next = { ...EMPTY_FORM }
      let anyOk = false

      const sd = (storeRes as { data?: { success?: boolean; data?: Record<string, unknown> } })?.data
      if (sd?.success) {
        anyOk = true
        const st = (sd.data?.store ?? {}) as Record<string, unknown>
        const str = (v: unknown) => (v == null ? '' : String(v))
        next.name = str(st.name); next.address = str(st.address); next.phone = str(st.phone)
        next.lat = str(st.lat); next.lng = str(st.lng)
        next.kakao_place_url = str(st.kakao_place_url); next.verify_pin = str(st.verify_pin)
        next.manager_phone = str(sd.data?.manager_phone)
        setProductCount(Number(sd.data?.product_count) || 0)
        setCategory(str(st.category))
      }

      const pd = (shopRes as { data?: { success?: boolean; data?: Record<string, unknown> } })?.data
      const p = (pd?.data ?? {}) as Record<string, unknown>
      if (pd?.success !== false && Object.keys(p).length > 0) {
        anyOk = true
        for (const k of SHOP_KEYS) next[k] = p[k] == null ? '' : String(p[k])
      }

      if (!anyOk) setLoadError('업체 정보를 불러오지 못했습니다')
      setForm(next); setInitial(next)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sellerId])

  /** 안 바뀌었으면 [저장]을 켜지 않는다 — 누를 게 없는 버튼은 눌러 보게 만든다. */
  const dirty = useMemo(
    () => (Object.keys(EMPTY_FORM) as (keyof StoreInfoForm)[]).some((k) => form[k] !== initial[k]),
    [form, initial],
  )

  /**
   * **전파되는 칸**이 바뀌었는가 — 저장 버튼이 "이용권 N개 반영" 을 말할지 정한다.
   * ⚠️ `dirty` 로 대신하면 소개글만 고쳐도 그 문구가 뜬다. 안 일어날 일을 예고하는 버튼은
   *    사장님이 저장을 망설이게 만든다(그리고 한 번 거짓말한 문구는 다음에도 안 믿는다).
   */
  const storeDirty = useMemo(() => STORE_KEYS.some((k) => form[k] !== initial[k]), [form, initial])

  const save = useCallback(async (): Promise<SaveOutcome> => {
    if (!sellerId) return { ok: false, propagated: 0, failed: { store: '매장을 찾을 수 없습니다' } }
    setSaving(true)
    const failed: SaveOutcome['failed'] = {}
    let propagated = 0

    const storePatch: Record<string, string> = {}
    for (const k of STORE_KEYS) if (form[k] !== initial[k]) storePatch[k] = form[k]
    const shopPatch: Record<string, string | null> = {}
    for (const k of SHOP_KEYS) if (form[k] !== initial[k]) shopPatch[k] = form[k] || null

    if (Object.keys(storePatch).length > 0) {
      try {
        const r = await api.patch(`/api/seller/stores/${sellerId}/profile`, storePatch)
        if (!r.data?.success) throw new Error(r.data?.error)
        propagated = Number(r.data.data?.propagated) || 0
      } catch (e) {
        failed.store = errText(e, '매장 정보 저장에 실패했습니다')
      }
    }
    if (Object.keys(shopPatch).length > 0) {
      try {
        const r = await api.put('/api/seller/profile', shopPatch)
        if (r.data?.success === false) throw new Error(r.data?.error)
      } catch (e) {
        failed.shop = errText(e, '유어샵 정보 저장에 실패했습니다')
      }
    }

    // 성공한 쪽만 기준선을 옮긴다 — 실패한 칸은 계속 '바뀜' 으로 남아 다시 저장할 수 있다.
    setInitial((prev) => {
      const next = { ...prev }
      if (!failed.store) for (const k of STORE_KEYS) next[k] = form[k]
      if (!failed.shop) for (const k of SHOP_KEYS) next[k] = form[k]
      return next
    })
    setSaving(false)
    return { ok: !failed.store && !failed.shop, propagated, failed }
  }, [sellerId, form, initial])

  return { form, set, setForm, loading, loadError, saving, dirty, storeDirty, save, productCount, category }
}

function errText(e: unknown, fallback: string): string {
  const r = (e as { response?: { data?: { error?: string } }; message?: string })
  return r?.response?.data?.error || r?.message || fallback
}
