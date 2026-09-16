/**
 * 🍽️ 영업신고증 업로드 — 셀러 대시보드 '서류' 탭.
 *
 * 2026-09-16 (대표 *"영업신고증도 사진 크기 문제 없지? 남은거 다 해줘"*).
 *
 * ## 사업자등록증과 무엇이 다른가
 * - **사업자등록증**(`sellers.business_registration_image_url`) = 세무서가 준 것. 현금 정산·원천징수
 *   면제의 근거라 **정산 대상자**를 정한다.
 * - **영업신고증**(이 파일) = 구청이 준 것. *"이 소재지에서 음식을 팔아도 된다"* 를 증명한다.
 *   정산과 무관하고, 대신 **공개 인허가 원장(`store_prospects`)에 관리번호가 실려 있어** 대조가 된다.
 *
 * ## 🚚 저장 자리 — `seller_meta` K-V (sellers ALTER 금지)
 * `sellers` 는 **정확히 100컬럼 = D1 결과셋 한도**다(CLAUDE.md). 새 셀러 메타는 여기로 온다.
 *
 * ⚠️ 키 이름을 `business_license_url` 로 **쓰지 않았다** — 레포 안에서 그 이름은 이미
 * *사업자등록증*을 가리킨다(`suppliers.business_license_url`, `wholesale.routes`, 가입 폼).
 * 같은 이름을 다른 서류에 쓰면 둘이 언제 갈렸는지 아무도 모른다. ⇒ `food_permit_url`.
 *
 * ## 📄 사진 크기 — 거절하지 않고 줄여서 올린다
 * 폰 카메라 원본은 3~8MB 가 예사라 서버 상한(10MB)보다 **압축 전 상한**에 먼저 걸린다.
 * 2026-09-15 에 가입 폼(`BusinessCertUpload`)이 정확히 그 문제로 *"5MB 이하만"* 하고 막아섰고,
 * 사장님이 할 수 있는 일이 없었다. 여기선 처음부터 `compressForDocument`(2MB / 2400px) 를 태운다.
 * 가드: `scripts/mutations/cert-upload-compress.mjs`.
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { compressForDocument } from '@/lib/image-compress'
import { DashboardCard } from '@/components/dashboard'

/** 서버 상한과 같은 값 — 압축 후에도 이걸 넘으면 올려 봐야 413 이다. */
const SERVER_MAX_BYTES = 10 * 1024 * 1024

export default function FoodPermitUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    api.get('/api/seller/business-info')
      .then((r) => { if (alive) setUrl(r.data?.data?.food_permit_url || '') })
      .catch(() => { /* 없으면 빈칸에서 시작한다 — 조회 실패가 업로드를 막을 이유는 없다 */ })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  async function save(next: string) {
    try {
      await api.post('/api/seller/food-permit', { url: next })
      setUrl(next)
      toast.success(next ? '영업신고증이 저장됐어요' : '삭제했어요')
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '저장에 실패했어요')
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 올릴 수 있어요 (JPG / PNG / WebP)'); return }
    setBusy(true)
    try {
      // 📄 줄여서 올린다 — 거절이 아니라 압축이 답이다(위 주석 참조)
      const prepared = await compressForDocument(file).catch(() => file)
      if (prepared.size > SERVER_MAX_BYTES) {
        toast.error('이미지가 너무 커요 — 다시 찍거나 다른 사진을 골라주세요')
        return
      }
      const fd = new FormData()
      fd.append('file', prepared)
      const res = await fetch('/api/upload/business-cert', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string; data?: { url: string } }
      if (data?.success && data.data?.url) await save(data.data.url)
      else toast.error(data?.error || '업로드에 실패했어요')
    } catch {
      toast.error('업로드 중 오류가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardCard
      title="영업신고증"
      subtitle="구청이 발급한 영업신고증 — 소재지에서 영업해도 된다는 증명입니다 (선택)"
    >
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" />

        {url && (
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={url} alt="영업신고증" className="max-h-64 mx-auto rounded shadow-sm hover:opacity-90 transition-opacity" />
              <p className="text-[11px] text-brand-text mt-2 text-center hover:underline">원본 크기로 열기 →</p>
            </a>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !loaded}
            className="ur-btn ur-btn-md ur-btn-secondary disabled:opacity-60"
          >
            {busy
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 업로드 중…</span>
              : url ? '다른 이미지로 교체' : '영업신고증 이미지 첨부'}
          </button>
          {url && (
            <button type="button" onClick={() => save('')} className="text-[13px] text-gray-500">삭제</button>
          )}
        </div>

        <div className="rounded-lg bg-white border border-rule p-3 text-xs text-gray-700 space-y-1">
          <p><strong>왜 받나요?</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>등록하신 매장 소재지와 서류의 소재지가 같은지 확인합니다</li>
            <li>관리번호가 공개 인허가 원장에 있으면 확인이 더 빨라집니다</li>
          </ul>
          <p className="mt-2">사진이 커도 괜찮아요 — 올리면서 자동으로 줄입니다.</p>
        </div>
      </div>
    </DashboardCard>
  )
}
