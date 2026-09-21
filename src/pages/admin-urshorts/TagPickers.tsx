import { URSHORTS_REGION_KEYS, shortsRegionLabel } from '@/shared/urshorts-regions'
import { VOUCHER_CATEGORIES, VOUCHER_CATEGORY_LABEL } from '@/shared/constants/voucher-categories'

/**
 * 🏷️ 어드민 — 영상 한 편의 **도시·종류** 고르기 (2026-09-21).
 *
 * ## 왜 화면에 두는가
 * 자동 분류는 제목·설명글·태그에서 뽑는 추정이고 실측 수율이 **10편 중 7편**이다. 나머지는
 * 사람이 고쳐야 하는데, 고칠 자리가 없으면 그 영상은 영영 '전체' 에만 남는다.
 * 그리고 전체 보기 화면의 칩 줄은 **값이 둘 이상일 때만** 그려지므로, 분류가 도는지 여부를
 * 소비자 화면만 봐서는 알 수 없다 — **여기가 그걸 눈으로 확인하는 자리**이기도 하다.
 *
 * 🔴 빈 값(`''`)은 **지우기**다. 비워 두면 다음 '다시 분류' 가 그 칸을 채운다
 *    (서버는 빈 칸만 채우므로, 사람이 고른 값은 자동 분류가 덮지 않는다).
 */
export default function TagPickers({
  regionSi, category, onChange,
}: {
  regionSi: string | null
  category: string | null
  onChange: (patch: { region_si?: string | null; category?: string | null }) => void
}) {
  const sel = 'shrink-0 rounded-lg border border-rule bg-white px-1.5 py-2 text-[11.5px] font-semibold text-gray-700'
  return (
    <>
      <select
        aria-label="도시"
        value={regionSi ?? ''}
        onChange={(e) => onChange({ region_si: e.target.value || null })}
        className={`${sel} ${regionSi ? '' : 'text-gray-400'}`}
      >
        <option value="">도시?</option>
        {URSHORTS_REGION_KEYS.map((k) => (
          <option key={k} value={k}>{shortsRegionLabel(k)}</option>
        ))}
      </select>
      <select
        aria-label="종류"
        value={category ?? ''}
        onChange={(e) => onChange({ category: e.target.value || null })}
        className={`${sel} ${category ? '' : 'text-gray-400'}`}
      >
        <option value="">종류?</option>
        {VOUCHER_CATEGORIES.map((c) => (
          <option key={c} value={c}>{VOUCHER_CATEGORY_LABEL[c]?.short ?? c}</option>
        ))}
      </select>
    </>
  )
}
