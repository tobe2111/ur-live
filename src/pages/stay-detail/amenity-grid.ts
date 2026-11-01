/**
 * 🏨 숙소 '서비스 및 부대시설' 그리드 (2026-10-31 대표 — 여기어때 화면: *"숙소의 경우에는 이렇게 나타내면 좋을 것 같은데?
 *    없으면 없다고 표시되고, 그만큼 숙소 이용권 업로드할 때도 선택이 되어야겠지?"*).
 *
 * 대표 시설 11칸을 **항상 같은 순서로** 보여 주고, 숙소가 고르지 않은 칸은 '없음'으로 흐리게 둔다.
 * 판정은 아이콘과 같은 `amenityKind`(낱말 → 종류) 하나다 — 두 벌이면 아이콘은 수영장인데 칸은 '없음' 인 날이 온다.
 *
 * 입력은 두 모양이 섞여 있다(실측): 데모·어드민 시드는 한글 낱말(`"무료 주차"`), 셀러 등록 폼은 코드(`"parking_free"`).
 * 그리드 밖 시설(TV·냉장고·발코니 …)은 `extras` 로 따로 돌려준다 — 코드면 한글 라벨로 바꿔서(코드 그대로 노출 금지).
 *
 * ⚠️ 시설 정보가 **하나도 없으면** 칸을 '없음'으로 칠하지 않는다(`known=false`) — 모르는 것과 없는 것은 다르다.
 */
import { amenityKind, type AmenityKind } from './amenity-meta'

export type GridKind = Exclude<AmenityKind, 'default'>

/** 대표 시설 칸 — 순서가 화면 순서다. 아이콘은 `AmenityIcon` 의 같은 종류. */
export const STAY_AMENITY_GRID: ReadonlyArray<{ kind: GridKind; label: string }> = [
  { kind: 'parking', label: '주차' },
  { kind: 'wifi', label: '와이파이' },
  { kind: 'breakfast', label: '조식' },
  { kind: 'pool', label: '수영장' },
  { kind: 'spa', label: '스파·사우나' },
  { kind: 'gym', label: '피트니스' },
  { kind: 'fire', label: '바비큐' },
  { kind: 'kitchen', label: '취사' },
  { kind: 'air', label: '냉난방' },
  { kind: 'pet', label: '반려동물' },
  { kind: 'nosmoke', label: '금연' },
]

/** 셀러 등록 폼(`stay_property_amenities.code`)의 코드 → 한글. 그리드 밖으로 빠지는 코드만 쓰인다. */
const CODE_LABEL: Record<string, string> = {
  tv: 'TV', refrigerator: '냉장고', washer: '세탁기', shower: '샤워실', balcony: '발코니',
  ocean_view: '오션뷰', mountain_view: '마운틴뷰', city_view: '시티뷰', smoking: '흡연실',
  concierge: '컨시어지', luggage: '짐 보관', shuttle: '셔틀 서비스', reception_24: '24시간 리셉션', elevator: '엘리베이터',
}

/** 코드·한글이 섞인 목록 하나를 읽는다(JSON 배열 문자열 · 배열 · 빈 값). */
export function parseAmenities(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String).filter(Boolean) : [] } catch { return [] }
}

/** 셀러 폼 코드 중 `amenityKind` 낱말 판정이 놓치는 둘(`non_smoking`·`heating`)만 보탠다(흡연실 `smoking` 은 원래 금연에 안 걸린다 — 시험이 고정). */
function kindOf(item: string): AmenityKind {
  if (item === 'non_smoking') return 'nosmoke'
  if (item === 'heating') return 'air'
  return amenityKind(item)
}

export function stayAmenityGrid(items: string[]): {
  known: boolean
  cells: Array<{ kind: GridKind; label: string; has: boolean }>
  extras: string[]
} {
  const have = new Set<AmenityKind>()
  const extras: string[] = []
  for (const it of items) {
    const k = kindOf(it)
    if (k === 'default') {
      const label = CODE_LABEL[it] ?? it
      if (!extras.includes(label)) extras.push(label)
    } else have.add(k)
  }
  return {
    known: items.length > 0,
    cells: STAY_AMENITY_GRID.map(c => ({ ...c, has: have.has(c.kind) })),
    extras,
  }
}
