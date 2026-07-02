// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 카카오맵 후기 보너스 버튼/모달(verbatim 추출). 동작 불변.
// 🗺️ 2026-07-02 (카카오맵 리뷰 게이미피케이션 — 대표 "추천대로"): 레벨 표시 + 대가표시 안내 +
//   OCR 즉시지급 문구 제거(지급 판정은 매장/운영팀 — 설계문서 §3-3).
import { useState, useEffect } from 'react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

type MyLevel = { level: number; label: string; approved_count: number; next_level: number | null; remaining: number | null }

export default function ReviewBonusButton({ voucherCode }: { voucherCode: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'url' | 'screenshot'>('url')
  const [reviewUrl, setReviewUrl] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [myLevel, setMyLevel] = useState<MyLevel | null>(null)

  useEffect(() => {
    if (!open || myLevel) return
    api.get('/api/review-bonus/my-level').then((res) => {
      if (res.data?.success && res.data.data) setMyLevel(res.data.data as MyLevel)
    }).catch(() => { /* fail-soft — 레벨 표시는 부가 정보 */ })
  }, [open, myLevel])

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
        className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center gap-1">
        ⭐ 카카오맵 후기 작성하고 보너스 받기
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">⭐ 카카오맵 후기 작성 보너스</h3>
            {myLevel && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-[#121212] rounded-xl px-3 py-2 mb-3">
                <span className="text-[11px] font-bold text-gray-900 dark:text-white">🏅 동네 리뷰어 Lv.{myLevel.level} · {myLevel.label}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {myLevel.next_level ? `Lv.${myLevel.next_level}까지 후기 ${myLevel.remaining}건` : '최고 레벨'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              매장 카카오맵 후기 작성하고 인증해주시면 보너스 딜 + 리뷰 점수(레벨) 지급.
              <br/>1) 카카오맵 앱에서 매장 검색 → 후기 작성
              <br/>2) 후기 페이지 URL 복사 또는 스크린샷 캡쳐
              <br/>3) 아래에 제출 → 매장/운영팀 확인 후 지급
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 mb-4 leading-relaxed">
              보너스는 별점·내용과 <b>무관하게</b> 방문 인증에 대해 지급돼요. 솔직하게 써주시고,
              후기에 &quot;포인트를 받고 작성했어요&quot; 같은 대가 표시를 남겨주시면 카카오맵 정책에도 안전해요.
            </p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              <button onClick={() => setMode('url')} className={`py-2 text-xs font-bold rounded ${mode === 'url' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>URL 제출</button>
              <button onClick={() => setMode('screenshot')} className={`py-2 text-xs font-bold rounded ${mode === 'screenshot' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>스크린샷 제출</button>
            </div>
            {mode === 'url' ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">카카오맵 후기 URL</label>
                <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://place.map.kakao.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-[#1A1A1A]" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">매장/운영팀 확인 후 1~3일 내 보너스 지급</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">후기 스크린샷</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])}
                  className="w-full text-xs" />
                {uploading && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">업로드 중...</p>}
                {screenshotUrl && screenshotUrl.startsWith('data:') && (
                  <img src={screenshotUrl} alt="preview" className="mt-2 max-h-40 rounded" />
                )}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">매장/운영팀 확인 후 1~3일 내 보너스 지급 (자동검증 통과 시 더 빨라요)</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200">취소</button>
              <button onClick={submit} disabled={submitting || uploading}
                className="py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold disabled:opacity-50">
                {submitting ? '제출 중...' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
