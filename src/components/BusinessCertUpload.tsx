/**
 * 🏭 2026-06-04 사업자등록증 이미지 업로드 (회원가입 문서).
 *   미인증 가입 단계에서 사용 → 공개 엔드포인트 POST /api/upload/business-cert (rate-limit + 이미지 검증).
 *   업로드 성공 시 URL 을 onChange 로 반환 → 가입 payload 의 business_license_url 로 전송.
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { compressForDocument } from '@/lib/image-compress'
import type { OcrPrefill } from '@/shared/ocr-prefill'

export default function BusinessCertUpload({ value, onChange, required, hideLabel, onRead }: {
  value: string
  onChange: (url: string) => void
  required?: boolean
  hideLabel?: boolean
  /**
   * 🔍 2026-09-16: `onRead` 를 주면 서버에 **읽어 달라고 함께 부탁한다**(`ocr=1`).
   * 안 주면 요청 본문이 종전과 byte-동일이라 기존 호출부(도매·제조 가입)는 추론 비용 0.
   */
  onRead?: (ocr: OcrPrefill) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      // 📄 2026-09-15: 종전엔 10MB 넘으면 **그냥 거절**했다 — 폰 사진은 그걸 쉽게 넘는데 사장님이
      //   할 수 있는 일이 없었다(가입이 거기서 막힌다). 거절 대신 줄여서 올린다.
      const prepared = await compressForDocument(file).catch(() => file)
      if (prepared.size > 10 * 1024 * 1024) { toast.error('이미지가 너무 커요 — 다시 찍거나 다른 사진을 골라주세요'); return }
      const fd = new FormData()
      fd.append('file', prepared)
      if (onRead) fd.append('ocr', '1')
      const res = await fetch('/api/upload/business-cert', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string; data?: { url: string; ocr?: OcrPrefill | null } }
      if (data?.success && data.data?.url) {
        onChange(data.data.url)
        // ⚠️ 못 읽어도 업로드는 성공이다 — 그때는 아무 말도 하지 않는다(손으로 치면 되고,
        //   "읽기 실패" 라고 하면 사장님이 사진을 다시 찍으려 든다).
        if (onRead && data.data.ocr) onRead(data.data.ocr)
        else toast.success('사업자등록증이 업로드됐어요')
      }
      else toast.error(data?.error || '업로드에 실패했어요')
    } catch { toast.error('업로드 중 오류가 발생했어요') } finally { setBusy(false) }
  }

  return (
    <div>
      {/* 🔴 2026-09-16: 호출부가 이미 라벨을 갖고 있으면 **여기서 또 그리면 안 된다.**
          셀러 가입 화면에서 `Field` 라벨("사업자등록증 사본") 바로 아래 이 라벨이 겹쳐
          "사업자등록증 (선택)" 이 한 번 더 떴다 — 대표가 빼라고 한 그 `(선택)` 이
          **다른 문으로 되살아난 것**이다(렌더 실측으로 잡았다). */}
      {!hideLabel && (
        <label className="block text-[13px] font-semibold mb-1.5">
          사업자등록증 {required ? <span className="text-[#111827]">*</span> : <span className="text-[#B6BCC4] font-normal">(선택)</span>}
        </label>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#ECEEF1] p-2.5">
          <img src={value} alt="사업자등록증" className="w-14 h-14 rounded-lg object-cover border border-[#ECEEF1]" />
          <span className="flex-1 text-[13px] text-[#11875A] font-semibold">업로드 완료</span>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-[13px] text-[#4E5560] font-medium">다시 선택</button>
          <button type="button" onClick={() => onChange('')} className="text-[13px] text-[#8A929E]">삭제</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD2DA] text-[14px] font-semibold text-[#4E5560] disabled:opacity-60">
          <ImagePlus className="h-4 w-4" aria-hidden />
          {busy ? (onRead ? '읽는 중…' : '업로드 중…') : '사업자등록증 사진 올리기'}
        </button>
      )}
    </div>
  )
}
