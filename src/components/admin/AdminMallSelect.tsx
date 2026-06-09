/**
 * 🏬 2026-06-09 멀티-몰 테넌시 — 어드민 몰 선택 드롭다운 (재사용).
 *   슈퍼-어드민이 도매 콘텐츠(배너/상품/제안 등)를 몰별로 보거나 스탬프할 때 사용.
 *   값 '' = 전체/미지정(기존 무필터 뷰 보존 — default-mall-identical). 그 외 = 특정 mall_id.
 *   /api/admin/wholesale-malls 에서 몰 목록 fetch(staleTime 길게 — 거의 안 변함). 라이트 고정 테마.
 *
 *   몰이 1개(기본 몰만)면 드롭다운을 렌더하지 않음 → 단일 몰 환경 UI 불변(additive).
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'

export interface AdminMallOption {
  id: number
  slug: string
  name: string
  host: string | null
  active: number
}

/** 어드민 몰 목록 — /api/admin/wholesale-malls. 거의 안 변하므로 길게 캐시. */
export function useAdminMalls() {
  return useApiQuery<AdminMallOption[]>(
    ['admin', 'wholesale-malls'],
    '/api/admin/wholesale-malls',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (r: any) => (r?.success ? ((r.malls ?? []) as AdminMallOption[]) : []),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  )
}

interface AdminMallSelectProps {
  /** 선택된 mall_id 문자열 ('' = 전체/미지정). */
  value: string
  onChange: (value: string) => void
  /** '전체' 옵션 라벨. */
  allLabel?: string
  className?: string
}

/**
 * 몰 선택 드롭다운. 몰이 ≤1개면 null 반환(단일 몰 환경 UI 불변).
 */
export default function AdminMallSelect({ value, onChange, allLabel = '전체 몰', className = '' }: AdminMallSelectProps) {
  const { data: malls } = useAdminMalls()
  const list = malls ?? []
  // 기본 몰 1개만 있으면 드롭다운 숨김 — 단일 몰 환경에선 표시할 이유 없음(additive 불변).
  if (list.length <= 1) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={'h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-gray-400 ' + className}
      aria-label="몰 선택"
    >
      <option value="">{allLabel}</option>
      {list.map((m) => (
        <option key={m.id} value={String(m.id)}>
          {m.name}{m.active ? '' : ' (비활성)'}
        </option>
      ))}
    </select>
  )
}
