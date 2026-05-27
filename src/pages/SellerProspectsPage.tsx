/**
 * 🛡️ 2026-05-27 (영업 검증 Layer 2 UI): 영업자 (agency / influencer) 가 매장 영입 사전 등록.
 *
 * - POST /api/prospects — 매장 정보 사전 등록 (사장님 가입 전)
 * - 사장님 가입 시 phone/email 자동 매칭 → introduced_by_X_id 자동
 * - 첫 매출 발생 시 commission lock-in (Layer 4 cron)
 *
 * 흐름:
 *   영업자 → 매장 방문 → 이 페이지에서 사전 등록 → 사장님이 가입 → 매출 발생 → commission 활성
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'

interface Prospect {
  id: number
  store_name: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  business_address: string | null
  status: 'visiting' | 'converted' | 'expired'
  converted_seller_id: number | null
  first_sale_at: string | null
  commission_locked_at: string | null
  expires_at: string | null
  created_at: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  visiting: { label: '영입 중', color: 'bg-amber-100 text-amber-700' },
  converted: { label: '가입 완료', color: 'bg-green-100 text-green-700' },
  expired: { label: '만료', color: 'bg-gray-100 text-gray-500' },
}

export default function SellerProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [introducerType, setIntroducerType] = useState<'agency' | 'influencer'>('influencer')
  const [form, setForm] = useState({
    store_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    business_address: '',
    notes: '',
    proof_image_url: '',  // 🛡️ 2026-05-27 (영업 검증 Layer 3): 매장 방문 증빙 (간판/명함 사진)
  })
  const [uploadingProof, setUploadingProof] = useState(false)

  async function uploadProof(file: File) {
    if (uploadingProof) return
    setUploadingProof(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (r.data?.success && r.data?.url) {
        setForm(f => ({ ...f, proof_image_url: r.data.url }))
        toast.success('증빙 사진 업로드됨')
      } else {
        toast.error('업로드 실패')
      }
    } catch {
      toast.error('업로드 실패')
    } finally {
      setUploadingProof(false)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/api/prospects/mine')
      if (r.data?.success) setProspects(r.data.data || [])
    } catch {
      toast.error('목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 토큰 유형 추정 — agency_token 있으면 agency, 아니면 influencer
    if (localStorage.getItem('agency_token')) setIntroducerType('agency')
    load()
  }, [])

  async function submit() {
    if (!form.contact_phone && !form.contact_email) {
      toast.error('연락처 (전화 또는 이메일) 중 하나는 필수')
      return
    }
    try {
      const r = await api.post('/api/prospects', {
        ...form,
        introducer_type: introducerType,
      })
      if (r.data?.success) {
        toast.success('매장 사전 등록 완료')
        setShowAdd(false)
        setForm({ store_name: '', contact_name: '', contact_phone: '', contact_email: '', business_address: '', notes: '', proof_image_url: '' })
        load()
      }
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'ALREADY_CLAIMED') {
        toast.error('이미 다른 영업자가 영입 중인 매장입니다')
      } else {
        toast.error(err?.response?.data?.error || '등록 실패')
      }
    }
  }

  async function remove(id: number) {
    if (!confirm('이 prospect 를 회수할까요?')) return
    try {
      const r = await api.delete(`/api/prospects/${id}`)
      if (r.data?.success) {
        toast.success('회수됨')
        load()
      }
    } catch {
      toast.error('회수 실패')
    }
  }

  return (
    <>
      <SEO title="매장 영입 관리 - 유어딜" description="사장님 영입 사전 등록 + commission 추적" url="/agency/prospects" />
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">🤝 매장 영입 관리</h1>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-lg"
            >
              + 매장 사전 등록
            </button>
          </div>
        </header>

        {/* 가이드 */}
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
            <strong>💡 영업 가이드</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-0.5">
              <li>매장 방문 / 미팅 후 "+ 매장 사전 등록" 클릭</li>
              <li>사장님 전화 또는 이메일 입력 (자동 매칭용)</li>
              <li>사장님이 30일 안에 가입하면 자동 introduced_by 매핑</li>
              <li>매장 첫 매출 발생 시 commission 6개월 활성</li>
            </ol>
          </div>
        </div>

        {/* 목록 */}
        <div className="max-w-3xl mx-auto px-4 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-sm text-gray-500">아직 등록한 prospect 가 없습니다</p>
            </div>
          ) : (
            prospects.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.visiting
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {p.store_name || '(매장명 없음)'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {p.contact_name && <span>{p.contact_name} · </span>}
                        {p.contact_phone || p.contact_email}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                  </div>
                  {p.business_address && (
                    <p className="text-[11px] text-gray-500 mt-1">📍 {p.business_address}</p>
                  )}
                  {p.status === 'converted' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                      {p.first_sale_at ? (
                        <span className="text-green-600 font-bold">✅ 첫 매출 발생 — commission 활성</span>
                      ) : (
                        <span>⏳ 첫 매출 대기 중</span>
                      )}
                    </div>
                  )}
                  {p.status === 'visiting' && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        만료: {p.expires_at ? new Date(p.expires_at).toLocaleDateString('ko-KR') : '없음'}
                      </span>
                      <button
                        onClick={() => remove(p.id)}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        회수
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 등록 모달 */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-3">
              <h2 className="text-lg font-bold text-gray-900">매장 사전 등록</h2>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">매장명 (선택)</label>
                <input
                  value={form.store_name}
                  onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
                  placeholder="예: 홍대 매운돈까스"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">사장님 성함 (선택)</label>
                <input
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">전화 또는 이메일 (필수)</label>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 mb-2"
                />
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">매장 주소 (선택)</label>
                <input
                  value={form.business_address}
                  onChange={(e) => setForm((f) => ({ ...f, business_address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">영업 메모 (선택)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="만남 일시 / 미팅 내용 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 resize-none"
                />
              </div>
              {/* 🛡️ 2026-05-27 (영업 검증 Layer 3): 매장 방문 증빙 — 간판 / 명함 사진. */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">매장 방문 증빙 (권장)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProof(f) }}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-pink-100 file:text-pink-700 hover:file:bg-pink-200"
                />
                {form.proof_image_url && (
                  <img src={form.proof_image_url} alt="증빙" className="mt-2 w-full h-32 object-cover rounded-lg" />
                )}
                {uploadingProof && <p className="text-[11px] text-gray-400 mt-1">⏳ 업로드 중...</p>}
                <p className="text-[11px] text-gray-500 mt-1">매장 간판 또는 명함 사진 — admin 검증 시 commission lock-in 가속</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-900 text-sm font-bold rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={submit}
                  className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-lg"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 mt-4 text-center">
          <Link to="/seller" className="text-xs text-gray-500 hover:underline">← 셀러 대시보드</Link>
        </div>
      </div>
    </>
  )
}
