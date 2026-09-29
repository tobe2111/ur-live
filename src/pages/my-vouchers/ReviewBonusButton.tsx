// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 카카오맵 후기 보너스 버튼/모달(verbatim 추출). 동작 불변.
import { useState } from 'react'
import { StarIcon } from '@/components/icons/urdeal-icons'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

export default function ReviewBonusButton(
  { voucherCode, restaurantName, restaurantAddress }:
  { voucherCode: string; restaurantName?: string | null; restaurantAddress?: string | null },
) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'url' | 'screenshot'>('url')
  const [reviewUrl, setReviewUrl] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function uploadScreenshot(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하만'); return }
    setUploading(true)
    try {
      // 🛠️ 2026-06-17 (기술부채 청산): DataURL(멀티MB base64 를 POST 본문/DB 에 저장하던 임시) →
      //   검증된 R2 업로드 endpoint(/api/upload/image, 유저 쿠키 인증)로. 응답 URL 만 제출.
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.data?.url
      if (res.data?.success && url) setScreenshotUrl(url)
      else toast.error(res.data?.error || '업로드 실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '업로드 실패')
    } finally { setUploading(false) }
  }

  async function submit() {
    if (mode === 'url' && !reviewUrl) { toast.error('URL 입력'); return }
    if (mode === 'screenshot' && !screenshotUrl) { toast.error('스크린샷 업로드'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/review-bonus/submit', {
        voucher_code: voucherCode,
        review_url: mode === 'url' ? reviewUrl : undefined,
        screenshot_url: mode === 'screenshot' ? screenshotUrl : undefined,
      })
      if (res.data?.success) {
        toast.success(res.data.message || '제출됨')
        setOpen(false)
      } else toast.error(res.data?.error || '실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '실패')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="mt-4 w-full py-2 rounded-xl bg-brand text-white text-[12px] font-bold flex items-center justify-center gap-1">
        ⭐ 카카오맵 후기 작성하고 보너스 받기
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2"><StarIcon className="w-4 h-4 inline-block align-[-3px] mr-1 text-gray-400" aria-hidden="true" />카카오맵 후기 작성 보너스</h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">
              매장 카카오맵 후기 작성하고 인증해주시면 보너스 딜 지급 (기본 1,000딜).
              <br/>1) 카카오맵 앱에서 매장 검색 → 후기 작성
              <br/>2) 후기 페이지 URL 복사 또는 스크린샷 캡쳐
              <br/>3) 아래에 제출
            </p>
            {/* 🗺️ 어느 매장 후기인지 못 찾아 헤매지 않게 — 매장명과 카카오맵 검색 링크를 바로 준다. */}
            {restaurantName && (
              <div className="mb-4 p-2 rounded-xl bg-gray-50 dark:bg-[#1D1F29]">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">{restaurantName}</p>
                {restaurantAddress && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate mt-1">{restaurantAddress}</p>
                )}
                <a
                  href={`https://map.kakao.com/?q=${encodeURIComponent(restaurantName)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-2 text-[12px] font-bold text-gray-900 dark:text-white underline"
                >카카오맵에서 이 매장 찾기 →</a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1 mb-3">
              <button onClick={() => setMode('url')} className={`py-2 text-[12px] font-bold rounded ${mode === 'url' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-200'}`}>URL 제출</button>
              <button onClick={() => setMode('screenshot')} className={`py-2 text-[12px] font-bold rounded ${mode === 'screenshot' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-200'}`}>스크린샷 (AI 자동 검증)</button>
            </div>
            {mode === 'url' ? (
              <div>
                <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">카카오맵 후기 URL</label>
                <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://place.map.kakao.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[15px] text-gray-900 dark:text-white dark:bg-[#1D1F29]" />
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">어드민 검증 후 1~3일 내 보너스 지급</p>
              </div>
            ) : (
              <div>
                <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">후기 스크린샷</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])}
                  className="w-full text-[12px]" />
                {uploading && <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">업로드 중...</p>}
                {screenshotUrl && screenshotUrl.startsWith('data:') && (
                  <img src={screenshotUrl} alt="preview" className="mt-2 max-h-40 rounded" />
                )}
                <p className="text-[12px] text-emerald-600 mt-1">AI 가 매장명/후기 내용 확인 시 즉시 보너스 지급</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="py-2 border border-rule-strong rounded-lg text-[15px] font-bold text-gray-700 dark:text-gray-200">취소</button>
              <button onClick={submit} disabled={submitting || uploading}
                className="py-2 bg-brand text-white rounded-lg text-[15px] font-bold disabled:opacity-50">
                {submitting ? '제출 중...' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
