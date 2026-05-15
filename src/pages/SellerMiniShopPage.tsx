/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 미니샵 설정 페이지.
 *
 * mallpro 의 "메인페이지 커스터마이징" 따라잡기.
 *
 * 설정 항목:
 *   - 헤더 배너 이미지 URL (1280x320 권장)
 *   - 브랜드 컬러 (#RRGGBB)
 *   - 외부 라이브 URL (TikTok / Instagram / Facebook — 다채널 송출 시)
 *
 * URL: /seller/mini-shop
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Image as ImageIcon, ExternalLink, Save, Loader2, Eye, Upload } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { compressForUpload } from '@/lib/image-compress'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface Form {
  banner_url: string
  brand_color: string
  external_live_tiktok: string
  external_live_instagram: string
  external_live_facebook: string
}

const PRESET_COLORS = [
  '#EC4899', // 핑크 (기본)
  '#F43F5E', // 로즈
  '#F59E0B', // 앰버
  '#10B981', // 에메랄드
  '#3B82F6', // 블루
  '#8B5CF6', // 바이올렛
  '#0F172A', // 검정 (high-end)
  '#FAFAFA', // 화이트 (minimal)
]

export default function SellerMiniShopPage() {
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const [form, setForm] = useState<Form>({
    banner_url: '',
    brand_color: '',
    external_live_tiktok: '',
    external_live_instagram: '',
    external_live_facebook: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [sellerSlug, setSellerSlug] = useState<string | null>(null)

  // 🛡️ 2026-05-15: 배너 직접 업로드 — compressForUpload (WebP 1280px ≤500KB) + Data URL.
  async function handleBannerUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('10MB 이하 이미지만 가능합니다')
      return
    }
    setUploadingBanner(true)
    try {
      // 1280×320 권장 — width 1920 max, quality 85
      const compressed = await compressForUpload(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, toWebP: true })
      const reader = new FileReader()
      reader.onload = () => {
        update('banner_url', reader.result as string)
        toast.success('배너 업로드 완료 — 저장 버튼 눌러주세요')
      }
      reader.onerror = () => toast.error('이미지 읽기 실패')
      reader.readAsDataURL(compressed)
    } catch (err) {
      toast.error('이미지 처리 실패')
      if (import.meta.env.DEV) console.error(err)
    } finally {
      setUploadingBanner(false)
    }
  }

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    api.get('/api/seller/profile', { headers })
      .then(r => {
        const d = r.data?.data || r.data
        setForm({
          banner_url: d?.banner_url || '',
          brand_color: d?.brand_color || '',
          external_live_tiktok: d?.external_live_tiktok || '',
          external_live_instagram: d?.external_live_instagram || '',
          external_live_facebook: d?.external_live_facebook || '',
        })
        setSellerSlug(d?.username || String(d?.id || ''))
      })
      .catch(() => toast.error('프로필 로드 실패'))
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    // 클라이언트 검증
    const urlFields: Array<keyof Form> = ['banner_url', 'external_live_tiktok', 'external_live_instagram', 'external_live_facebook']
    for (const k of urlFields) {
      const v = form[k]
      if (v && !/^https?:\/\//i.test(v)) {
        toast.error(`${k} 는 http:// 또는 https:// 로 시작해야 합니다`)
        return
      }
    }
    if (form.brand_color && !/^#[0-9A-Fa-f]{6}$/.test(form.brand_color)) {
      toast.error('브랜드 컬러는 #RRGGBB 형식 (예: #EC4899)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        banner_url: form.banner_url || null,
        brand_color: form.brand_color || null,
        external_live_tiktok: form.external_live_tiktok || null,
        external_live_instagram: form.external_live_instagram || null,
        external_live_facebook: form.external_live_facebook || null,
      }
      const res = await api.put('/api/seller/profile', payload, { headers })
      if (res.data?.success !== false) {
        toast.success('✅ 미니샵 설정 저장 완료')
      } else {
        toast.error(res.data?.error || '저장 실패')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SellerLayout title="미니샵 설정"><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div></SellerLayout>
  }

  return (
    <SellerLayout title="미니샵 설정">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="미니샵 설정"
          subtitle="셀러 페이지를 본인 브랜드에 맞게 커스터마이징"
          icon={<Palette className="h-5 w-5" />}
        />

        {/* 미리보기 링크 */}
        {sellerSlug && (
          <a
            href={`/profile/${sellerSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl p-3 border border-gray-200 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-medium text-gray-700">내 미니샵 미리보기</span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          </a>
        )}

        {/* 1. 배너 이미지 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-pink-500" />
            <h3 className="text-base font-bold text-gray-900">헤더 배너 이미지</h3>
          </div>
          <p className="text-[11px] text-gray-500">셀러 페이지 상단에 표시 — 1280×320 권장 (와이드 가로)</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={form.banner_url.startsWith('data:') ? '(업로드된 이미지)' : form.banner_url}
              onChange={e => update('banner_url', e.target.value)}
              placeholder="https://i.ibb.co/.../banner.jpg 또는 직접 업로드"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              disabled={form.banner_url.startsWith('data:')}
            />
            <label className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-bold cursor-pointer">
              {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingBanner ? '처리 중' : '업로드'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingBanner}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleBannerUpload(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {form.banner_url && (
            <div className="rounded-xl overflow-hidden border border-gray-200 aspect-[4/1] bg-gray-100">
              <img src={form.banner_url} alt="banner preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* 2. 브랜드 컬러 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-pink-500" />
            <h3 className="text-base font-bold text-gray-900">브랜드 컬러</h3>
          </div>
          <p className="text-[11px] text-gray-500">셀러 페이지 메인 그라디언트 / 강조 색상 — 배너 이미지 없으면 그라디언트로 fallback</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => update('brand_color', c)}
                className={`aspect-square rounded-lg border-2 transition-all ${form.brand_color === c ? 'border-gray-900 ring-2 ring-pink-200 scale-105' : 'border-gray-200 hover:border-gray-300'}`}
                style={{ background: c }}
                aria-label={`색상 ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.brand_color}
              onChange={e => update('brand_color', e.target.value)}
              placeholder="#EC4899"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:border-pink-500 focus:outline-none"
            />
            <input
              type="color"
              value={form.brand_color || '#EC4899'}
              onChange={e => update('brand_color', e.target.value.toUpperCase())}
              className="w-12 h-11 rounded-lg border border-gray-300 cursor-pointer"
              aria-label="컬러 피커"
            />
            {form.brand_color && (
              <button onClick={() => update('brand_color', '')} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-xs">초기화</button>
            )}
          </div>
        </div>

        {/* 3. 외부 라이브 URL */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-pink-500" />
            <h3 className="text-base font-bold text-gray-900">다채널 라이브 URL</h3>
          </div>
          <p className="text-[11px] text-gray-500">
            PRISM/OBS 다채널 송출 시 본인 TikTok/Instagram/Facebook 라이브 URL.
            <br />라이브 진행 중일 때 셀러 페이지에 "여기서도 라이브 중" 배지 표시됩니다.
          </p>
          {[
            { key: 'external_live_tiktok' as const, label: '🎵 TikTok Live URL', placeholder: 'https://www.tiktok.com/@username/live' },
            { key: 'external_live_instagram' as const, label: '📷 Instagram Live URL', placeholder: 'https://www.instagram.com/username/live/' },
            { key: 'external_live_facebook' as const, label: '📘 Facebook Live URL', placeholder: 'https://www.facebook.com/username/live/' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type="url"
                value={form[field.key]}
                onChange={e => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
          ))}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </SellerLayout>
  )
}
