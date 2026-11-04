/**
 * ⑥ 사업자등록증 — 2026-11-03 대표 확정 시안(*"응 모두 해줘"*). `/store/biz-cert`
 *
 * 대시보드 사업자 정보(긴 폼 10칸)의 **첫 절반**만: 사진(찍기·앨범) + 사업자번호(자동 하이픈 · 국세청 확인).
 * 상호·대표자·업태·통신판매업 번호는 '더 적기'로 종전 화면에 남긴다(그 폼을 두 벌로 만들지 않는다).
 * 서버 계약은 종전 그대로다 — 사진은 등록증 전용 자리(`/api/upload/business-cert`), 제출은
 * `/api/seller/business-registration/submit`(그 함수가 사진 주소를 다시 검사하고 '확인 중' 으로 둔다).
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { toast } from '@/hooks/useToast'
import { compressForDocument } from '@/lib/image-compress'
import { BUSINESS_CERT_MAX_FILE_BYTES } from '@/shared/upload-limits'
import { formatBusinessNumber } from '@/shared/business-number-input'
import StoreStepShell from './StoreStepShell'
import { STORE_BANK_PATH } from './first-voucher-path'

export default function StoreBizCertPage() {
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [bno, setBno] = useState('')
  const [nts, setNts] = useState<{ valid: boolean | null; message?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  // 이미 적어 둔 번호가 있으면 채운다(가입 때 적었을 수 있다).
  useEffect(() => {
    api.get('/api/seller/business-info', { headers })
      .then((r) => { const n = r.data?.data?.business_number; if (n) setBno(formatBusinessNumber(String(n))) })
      .catch(() => { /* 빈 칸으로 시작 */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(file: File) {
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    try {
      const prepared = await compressForDocument(file).catch(() => file)
      if (prepared.size > BUSINESS_CERT_MAX_FILE_BYTES) { toast.error('이미지가 너무 커요 — 다시 찍거나 다른 사진을 골라 주세요'); setPreview(''); return }
      const fd = new FormData()
      fd.append('file', prepared)
      const r = await api.post('/api/upload/business-cert', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = r.data?.data?.url || r.data?.url
      if (!url) throw new Error(r.data?.error || '업로드 실패')
      setImageUrl(url)
    } catch (e: any) {
      setPreview('')
      toast.error(e?.response?.data?.error || '사진을 올리지 못했어요. 다시 시도해 주세요')
    } finally { setUploading(false) }
  }

  async function verify() {
    const clean = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(clean)) { toast.error('사업자번호는 숫자 10자리예요'); return }
    setVerifying(true); setNts(null)
    try {
      const r = await api.post('/api/seller/stores/verify-business', { business_number: clean })
      setNts(r.data?.data || null)
    } catch (e: any) {
      setNts({ valid: null, message: e?.response?.data?.error || '지금은 확인할 수 없어요' })
    } finally { setVerifying(false) }
  }

  async function submit() {
    if (!imageUrl || submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/business-registration/submit', { image_url: imageUrl, business_number: bno || undefined }, { headers })
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success('사업자등록증을 보냈어요 — 확인되면 알려 드릴게요')
      navigate(STORE_BANK_PATH, { replace: true })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || '보내지 못했어요. 잠시 뒤 다시 눌러 주세요')
    } finally { setSubmitting(false) }
  }

  const fileProps = { type: 'file', accept: 'image/jpeg,image/png,image/webp', className: 'hidden' } as const
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }

  return (
    <StoreStepShell step={1} seoTitle="사업자등록증" title="사업자등록증을 올려 주세요" lead="승인 담당이 사진으로 확인해요. 승인되면 메인에 노출돼요."
      footer={<>
        <button type="button" onClick={() => void submit()} disabled={!imageUrl || uploading || submitting}
          className={`ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40${submitting ? ' ur-busy-ring !opacity-100' : ''}`}>
          {submitting ? '보내는 중…' : '제출하고 다음'}
        </button>
        {!imageUrl && <p className="mt-2 text-center text-[12px] text-ink-soft">{uploading ? '사진을 올리는 중이에요' : '등록증 사진을 올려 주세요'}</p>}
      </>}>
      <input ref={cameraRef} {...fileProps} capture="environment" onChange={onPick} data-testid="biz-cert-camera" />
      <input ref={albumRef} {...fileProps} onChange={onPick} data-testid="biz-cert-album" />
      <div className="mt-5 rounded-2xl border-[1.5px] border-dashed border-line bg-wash overflow-hidden">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="올린 사업자등록증" className={`w-full max-h-56 object-contain ${uploading ? 'opacity-60' : ''}`} />
            <button type="button" onClick={() => albumRef.current?.click()} className="absolute right-2 bottom-2 h-8 px-3 rounded-full bg-black/60 text-white text-[13px]">다시 고르기</button>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => cameraRef.current?.click()} className="h-10 px-4 rounded-full bg-brand text-white text-[15px] font-medium">사진 찍기</button>
              <button type="button" onClick={() => albumRef.current?.click()} className="h-10 px-4 rounded-full border-[1.5px] border-line text-[15px] font-medium">앨범에서 고르기</button>
            </div>
            <span className="text-[12px] text-ink-soft">글자가 잘 보이게 · 큰 사진은 자동으로 줄여요</span>
          </div>
        )}
      </div>

      <label className="mt-5 block">
        <span className="block mb-2 text-[13px] text-ink-soft">사업자등록번호</span>
        <span className="flex gap-2">
          <input value={bno} onChange={(e) => { setBno(formatBusinessNumber(e.target.value)); setNts(null) }} placeholder="000-00-00000" inputMode="numeric" maxLength={12}
            className="flex-1 min-w-0 h-[52px] px-4 rounded-xl border-[1.5px] border-line bg-transparent text-[16px] tracking-wide text-gray-900 dark:text-white placeholder:text-ink-faint focus:border-brand focus:outline-none" />
          <button type="button" onClick={() => void verify()} disabled={verifying || !bno} className="h-[52px] px-4 rounded-xl border-[1.5px] border-line text-[15px] font-medium disabled:opacity-40">
            {verifying ? '확인 중…' : '국세청 확인'}
          </button>
        </span>
      </label>
      {nts && (
        <p className={`mt-2 text-[13px] ${nts.valid === true ? 'text-tone-ok' : nts.valid === false ? 'text-tone-bad' : 'text-ink-soft'}`}>
          {nts.valid === true ? `국세청에 등록된 번호예요${nts.message ? ` (${nts.message})` : ''}` : nts.valid === false ? '조회되지 않는 번호예요. 번호를 확인해 주세요' : (nts.message || '지금은 확인할 수 없어요. 제출하면 담당이 확인해요')}
        </p>
      )}

      <Link to="/seller/business-info?from=my" className="mt-5 flex items-center py-4 border-y border-rule">
        <span className="flex-1">
          <span className="block text-[15px] font-medium">상호·대표자·업태 더 적기</span>
          <span className="block mt-1 text-[13px] text-ink-soft">선택 · 통신판매업 번호도 여기서</span>
        </span>
        <ChevronRight size={18} strokeWidth={1.6} className="text-ink-soft" aria-hidden="true" />
      </Link>
    </StoreStepShell>
  )
}
