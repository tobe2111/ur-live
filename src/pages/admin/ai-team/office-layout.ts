/**
 * 🏢 사무실 평면도 (2026-11-26 대표 "메타버스처럼 직원들이 움직이고 그런거 있잖아 사무실에서").
 *   좌표는 SVG viewBox 1000×620 기준. 방 · 책상 자리 · 복도 · 쉬는 곳을 순수 데이터로 둔다(시험 대상).
 *   걷는 길은 복도를 따라간다: 지금 자리 → 가까운 복도 → (다른 층이면 가운데 통로로 갈아탐) → 목적지.
 */

export interface Pt { x: number; y: number }
export interface Room { id: string; name: string; x: number; y: number; w: number; h: number; floor: string; teams: string[] }

export const VIEW = { w: 1000, h: 620 }

/** 본부별 색 — 몸통 색으로 어느 본부 사람인지 보인다. */
export const DEPT_COLOR: Record<string, string> = {
  ceo: '#1F2937',
  'ceo-office': '#6D28D9',
  growth: '#1C69EF',
  ops: '#0F9D6B',
  product: '#D97706',
  support: '#DB2777',
}

export const ROOMS: Room[] = [
  { id: 'meeting', name: '회의실', x: 20, y: 20, w: 220, h: 150, floor: '#EEF2F7', teams: [] },
  { id: 'lounge', name: '탕비실', x: 260, y: 20, w: 240, h: 150, floor: '#F4EFE6', teams: [] },
  { id: 'secretary', name: '5F 비서실', x: 520, y: 20, w: 220, h: 150, floor: '#F1ECFB', teams: ['ceo-office'] },
  { id: 'ceo', name: '6F 대표실', x: 760, y: 20, w: 220, h: 150, floor: '#EDEFF3', teams: ['ceo'] },
  { id: 'growth', name: '4F 성장본부', x: 20, y: 210, w: 470, h: 170, floor: '#EAF1FE', teams: ['sales', 'partnerships', 'marketing'] },
  { id: 'opsroom', name: '3F 운영본부', x: 510, y: 210, w: 470, h: 170, floor: '#E7F6EF', teams: ['support', 'ops'] },
  { id: 'product', name: '2F 제품본부', x: 20, y: 430, w: 470, h: 170, floor: '#FDF3E3', teams: ['planning', 'design', 'dev'] },
  { id: 'support', name: '1F 경영지원 · 품질·보안실', x: 510, y: 430, w: 470, h: 170, floor: '#FCEEF5', teams: ['finance', 'legal', 'qa'] },
]

/** 팀 → 본부 색 키 */
export const TEAM_DEPT: Record<string, string> = {
  ceo: 'ceo', 'ceo-office': 'ceo-office',
  sales: 'growth', partnerships: 'growth', marketing: 'growth',
  support: 'ops', ops: 'ops',
  planning: 'product', design: 'product', dev: 'product',
  finance: 'support', legal: 'support', qa: 'support',
}

/** 방 안 책상 자리: 방 폭을 팀 수로 나눠 가운데 아래쪽에 둔다. 사람은 책상 바로 아래(의자)에 앉는다. */
export function deskOf(team: string): { desk: Pt; seat: Pt } | null {
  const room = ROOMS.find(r => r.teams.includes(team))
  if (!room) return null
  const i = room.teams.indexOf(team)
  const n = room.teams.length
  const x = Math.round(room.x + (room.w * (i + 1)) / (n + 1))
  const deskY = room.y + Math.round(room.h * 0.45)
  return { desk: { x, y: deskY }, seat: { x, y: deskY + 34 } }
}

/** 복도 두 줄(위·아래 층 사이)과 가운데 세로 통로 */
export const CORRIDOR_Y = [190, 405] as const
export const AISLE_X = 500

/** 쉬는 곳·보고 자리 — 한 자리에 한 명만 선다(OfficeView 가 자리를 맡는다). 이름표 폭(약 55)보다 넓게 띄운다.
 *  ⚠️ 비서실 보고 자리는 비서실장 의자(630,121)와 떨어뜨린다 — 겹치면 둘이 한 사람처럼 보인다. */
export const SPOTS = {
  secretaryDrop: [{ x: 565, y: 120 }, { x: 700, y: 120 }] as Pt[],
  coffee: [{ x: 290, y: 105 }, { x: 350, y: 105 }, { x: 410, y: 105 }, { x: 470, y: 105 }] as Pt[],
  meeting: [{ x: 45, y: 92 }, { x: 215, y: 92 }] as Pt[],
}

function nearestCorridor(p: Pt): number {
  return Math.abs(p.y - CORRIDOR_Y[0]) <= Math.abs(p.y - CORRIDOR_Y[1]) ? CORRIDOR_Y[0] : CORRIDOR_Y[1]
}

/** a → b 걷는 길(도착점 포함, 출발점 제외). 같은 복도면 한 번 꺾고, 다르면 가운데 통로로 갈아탄다. */
export function route(a: Pt, b: Pt): Pt[] {
  const ca = nearestCorridor(a)
  const cb = nearestCorridor(b)
  const path: Pt[] = [{ x: a.x, y: ca }]
  if (ca !== cb) path.push({ x: AISLE_X, y: ca }, { x: AISLE_X, y: cb })
  path.push({ x: b.x, y: cb }, b)
  return path
}
