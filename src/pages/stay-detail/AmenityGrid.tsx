import { lazy, Suspense } from 'react'
import { stayAmenityGrid } from './amenity-grid'

const AmenityIcon = lazy(() => import('./AmenityIcon'))

/** 🏨 서비스 및 부대시설 — 대표 시설 11칸 + 그 밖의 시설 한 줄(2026-10-31). 판정은 `amenity-grid.ts`. */
export default function AmenityGrid({ items }: { items: string[] }) {
  const { known, cells, extras } = stayAmenityGrid(items)
  return (
    <>
      <ul className="mt-4 grid grid-cols-4 lg:grid-cols-6 gap-x-2 gap-y-5" data-amenity-grid>
        {cells.map(c => {
          const off = known && !c.has
          return (
            <li key={c.kind} data-has={c.has ? '1' : '0'} className="flex flex-col items-center text-center gap-2">
              <Suspense fallback={<span className="w-6 h-6 inline-block" aria-hidden />}>
                <AmenityIcon kind={c.kind} className={`w-6 h-6 ${c.has ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`} />
              </Suspense>
              <span className={`text-[12px] leading-tight ${c.has ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {c.label}
                {off && <span className="block mt-1 text-gray-400 dark:text-gray-500">없음</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {!known && <p className="mt-4 text-[13px] text-gray-500 dark:text-gray-400">숙소가 아직 시설 정보를 등록하지 않았어요.</p>}
      {extras.length > 0 && (
        <p className="mt-5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          <span className="text-gray-700 dark:text-gray-200 font-medium">그 밖의 시설</span>{'  '}{extras.join(', ')}
        </p>
      )}
    </>
  )
}
