import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardCard } from '@/components/dashboard'
import { Loader2 } from 'lucide-react'

// 🛡️ 2026-06-10: SellerBusinessInfoPage 탭화 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-19: 사업자등록증 업로드 섹션 (사용자 요청).
export default function BizRegSection({ imageUrl, status, rejectReason, uploading, submitting, onFileChange, onSubmit }: {
  imageUrl: string
  status: 'none' | 'pending' | 'verified' | 'rejected'
  rejectReason: string
  uploading: boolean
  submitting: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
}) {
  return (
    <DashboardCard
      title="사업자등록증 검증"
      subtitle="현금 정산 + 8.8% 원천징수 면제를 위해 사업자등록증 등록 + 어드민 검증 필요"
    >
      <div className="space-y-4">
        {/* 현재 상태 배지 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">현재 상태:</span>
          {status === 'verified' && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">✅ 검증 완료</Badge>
          )}
          {status === 'pending' && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">⏳ 검증 대기 중</Badge>
          )}
          {status === 'rejected' && (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">❌ 반려 — 재제출 필요</Badge>
          )}
          {status === 'none' && (
            <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">미등록</Badge>
          )}
        </div>

        {/* 반려 사유 표시 */}
        {status === 'rejected' && rejectReason && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
            <strong>반려 사유:</strong> {rejectReason}
          </div>
        )}

        {/* 미리보기 */}
        {imageUrl && (
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={imageUrl}
                alt="사업자등록증"
                className="max-h-64 mx-auto rounded shadow-sm hover:opacity-90 transition-opacity"
              />
              <p className="text-[11px] text-blue-600 mt-2 text-center hover:underline">
                원본 크기로 열기 →
              </p>
            </a>
          </div>
        )}

        {/* 파일 선택 — verified 가 아니면 재업로드 가능 */}
        {status !== 'verified' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {imageUrl ? '다른 이미지로 교체' : '사업자등록증 이미지 업로드'}
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-500">JPG / PNG / WebP, 최대 5MB</p>
            {uploading && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> 업로드 중...
              </p>
            )}
          </div>
        )}

        {/* 제출 버튼 — 업로드된 이미지가 있을 때 + verified 가 아닐 때 */}
        {status !== 'verified' && imageUrl && (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 제출 중...
              </span>
            ) : (
              '🚀 어드민 검증 신청'
            )}
          </Button>
        )}

        {/* 안내 */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
          <p><strong>왜 사업자등록증이 필요한가요?</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>현금 정산 가능 (없으면 딜 환급만)</li>
            <li>8.8% 원천징수 면제 (사업소득으로 처리)</li>
            <li>법적 사업자 인증 — 신뢰도 ↑</li>
          </ul>
          <p className="mt-2">검증은 영업일 기준 1-2일 소요됩니다.</p>
        </div>
      </div>
    </DashboardCard>
  )
}
