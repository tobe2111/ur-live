/**
 * 📈 대시보드 차트 — 직접 그린 SVG (2026-10-11, recharts 대체 — 대표 "다 해줘")
 *
 * 왜: 어드민 매출 분석·셀러 분석 화면 차트 셋을 위해 recharts(+redux·immer·d3) 가 **charts 청크 388 KB raw** 를
 *   실었다. 쓰는 것은 막대 하나·선 둘·원 하나뿐이다. 같은 모양을 SVG 로 직접 그리면 그 청크가 통째로 사라진다.
 *
 * 무엇을 지키나(종전과 같은 것): 반응형 폭 · 가로 눈금 점선 · 축 글자 · 손가락/마우스를 올린 자리의 값 표시 ·
 *   빈 데이터에서 안 깨짐. 대시보드 화면이라 라이트 고정이다(`dark:` 금지 — 대시보드 테마 규칙).
 *
 * 숫자는 한 곳에서 잰다: 위치는 `scaleY`/`xAt` 하나로만 계산한다(눈금·막대·선·툴팁이 같은 자를 쓴다).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const AXIS = '#6B7280'
const GRID = '#E5E7EB'
const PAD = { top: 12, right: 12, bottom: 28, left: 48 }

/** 행에서 값 하나 — 숫자가 아니면 0. */
const num = (row: object, key: string): number => Number((row as Record<string, unknown>)[key]) || 0
const str = (row: object, key: string): string => String((row as Record<string, unknown>)[key] ?? '')

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((es) => setW(Math.round(es[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** 보기 좋은 최댓값과 눈금(0 포함 5칸). 값이 전부 0 이면 1 로 둔다(0 으로 나누기 방지). */
export function niceTicks(max: number, count = 4): number[] {
  const m = max > 0 ? max : 1
  const raw = m / count
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p
  const ticks: number[] = []
  for (let v = 0; v <= m + step * 0.0001; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  if (ticks[ticks.length - 1] < m) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x - 70, 0), Math.max(width - 140, 0))
  return (
    <div
      className="pointer-events-none absolute z-10 w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 shadow-lift"
      style={{ left, top: Math.max(y - 56, 0) }}
    >
      {children}
    </div>
  )
}

interface Frame { width: number; height: number; innerW: number; innerH: number }
function frame(width: number, height: number): Frame {
  return { width, height, innerW: Math.max(width - PAD.left - PAD.right, 1), innerH: Math.max(height - PAD.top - PAD.bottom, 1) }
}

function Axes({ f, ticks, top, yFormat, labels, every }: {
  f: Frame; ticks: number[]; top: number; yFormat: (v: number) => string; labels: { x: number; text: string }[]; every: number
}) {
  const yOf = (v: number) => PAD.top + f.innerH - (v / top) * f.innerH
  return (
    <g fontSize={11} fill={AXIS}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={PAD.left + f.innerW} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={yOf(t)} textAnchor="end" dominantBaseline="middle">{yFormat(t)}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % every === 0 ? (
        // 글자 가운데를 그 점에 두되, 반 폭만큼 안쪽으로 가둔다 — 그냥 두면 마지막 날짜가 오른쪽 끝에서 잘리고(실측),
        // 끝 글자만 'end' 로 붙이면 이웃 글자와 겹친다(실측). 11px 글자 반 폭 ≈ 글자 수 × 3.3px.
        <text key={i} x={Math.min(Math.max(l.x, l.text.length * 3.3 + 2), f.width - l.text.length * 3.3 - 2)} y={f.height - 8} textAnchor="middle">{l.text}</text>
      ) : null))}
    </g>
  )
}

/** 가로축 글자가 겹치지 않게 몇 개마다 하나씩 보여 줄지. */
function labelEvery(n: number, innerW: number, maxChars: number): number {
  // 글자 폭으로 잰다(11px ≈ 글자당 6.6px + 여백 12px) — 고정 간격이면 날짜(10자)가 서로 겹친다(실측).
  const fit = Math.max(Math.floor(innerW / (maxChars * 6.6 + 12)), 1)
  return Math.max(Math.ceil(n / fit), 1)
}

export interface Series<T> { key: keyof T & string; color: string; width?: number; label: string }

export function SvgBarChart<T extends object>({ data, xKey, series, height, yFormat, tip }: {
  data: T[]; xKey: keyof T & string; series: Series<T>; height: number
  yFormat: (v: number) => string; tip: (row: T) => ReactNode
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const f = frame(width, height)
  const values = data.map((d) => num(d, series.key))
  const ticks = useMemo(() => niceTicks(Math.max(0, ...values)), [values.join(',')])
  const top = ticks[ticks.length - 1] || 1
  const slot = f.innerW / Math.max(data.length, 1)
  const barW = Math.max(Math.min(slot * 0.7, 48), 1)
  const xAt = (i: number) => PAD.left + slot * i + slot / 2
  const yOf = (v: number) => PAD.top + f.innerH - (v / top) * f.innerH
  return (
    <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.label}>
          <Axes f={f} ticks={ticks} top={top} yFormat={yFormat} every={labelEvery(data.length, f.innerW, Math.max(0, ...data.map((d) => str(d, xKey).length)))}
            labels={data.map((d, i) => ({ x: xAt(i), text: str(d, xKey) }))} />
          {values.map((v, i) => (
            <rect key={i} x={xAt(i) - barW / 2} y={yOf(v)} width={barW} height={Math.max(PAD.top + f.innerH - yOf(v), 0)}
              rx={4} fill={series.color} opacity={hover === null || hover === i ? 1 : 0.55} />
          ))}
          {data.map((_, i) => (
            <rect key={`h${i}`} x={PAD.left + slot * i} y={PAD.top} width={slot} height={f.innerH} fill="transparent"
              onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          ))}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={xAt(hover)} y={yOf(values[hover])} width={width}>{tip(data[hover])}</Tooltip>
      )}
    </div>
  )
}

export function SvgLineChart<T extends object>({ data, xKey, series, height, yFormat, xFormat, tip, dots, legend }: {
  data: T[]; xKey: keyof T & string; series: Series<T>[]; height: number
  yFormat: (v: number) => string; xFormat?: (v: string) => string; tip: (row: T) => ReactNode
  dots?: boolean; legend?: boolean
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const legendH = legend ? 20 : 0
  const f = frame(width, height - legendH)
  const all = data.flatMap((d) => series.map((s) => num(d, s.key)))
  const ticks = useMemo(() => niceTicks(Math.max(0, ...all)), [all.join(',')])
  const top = ticks[ticks.length - 1] || 1
  const n = data.length
  const xAt = (i: number) => PAD.left + (n <= 1 ? f.innerW / 2 : (f.innerW * i) / (n - 1))
  const yOf = (v: number) => PAD.top + f.innerH - (v / top) * f.innerH
  const pick = (clientX: number, rectLeft: number) => {
    if (n === 0) return
    const x = clientX - rectLeft - PAD.left
    setHover(Math.min(Math.max(Math.round(n <= 1 ? 0 : (x / f.innerW) * (n - 1)), 0), n - 1))
  }
  return (
    <div ref={ref} className="relative w-full" style={{ height }}
      onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
      onTouchStart={(e) => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect().left)}
      onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height - legendH} role="img" aria-label={series.map((s) => s.label).join(' · ')}>
          <Axes f={f} ticks={ticks} top={top} yFormat={yFormat} every={labelEvery(n, f.innerW, Math.max(0, ...data.map((d) => (xFormat ? xFormat(str(d, xKey)) : str(d, xKey)).length)))}
            labels={data.map((d, i) => ({ x: xAt(i), text: xFormat ? xFormat(str(d, xKey)) : str(d, xKey) }))} />
          {series.map((s) => (
            <g key={s.key}>
              <polyline fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeLinejoin="round" strokeLinecap="round"
                points={data.map((d, i) => `${xAt(i)},${yOf(num(d, s.key))}`).join(' ')} />
              {dots && data.map((d, i) => <circle key={i} cx={xAt(i)} cy={yOf(num(d, s.key))} r={3} fill="#fff" stroke={s.color} strokeWidth={2} />)}
            </g>
          ))}
          {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + f.innerH} stroke={GRID} />}
        </svg>
      )}
      {legend && (
        <div className="flex justify-center gap-4 text-[12px] text-gray-600">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={xAt(hover)} y={yOf(num(data[hover], series[0].key))} width={width}>{tip(data[hover])}</Tooltip>
      )}
    </div>
  )
}

export function SvgPieChart<T extends object>({ data, valueKey, nameKey, colors, height, tip }: {
  data: T[]; valueKey: keyof T & string; nameKey: keyof T & string; colors: string[]; height: number; tip: (row: T) => ReactNode
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + (num(d, valueKey)), 0)
  const r = Math.min(90, height / 2 - 30, width / 2 - 70)
  const cx = width / 2
  const cy = height / 2
  let acc = 0
  const slices = data.map((d, i) => {
    const v = num(d, valueKey)
    const a0 = total > 0 ? (acc / total) * Math.PI * 2 : 0
    acc += v
    const a1 = total > 0 ? (acc / total) * Math.PI * 2 : 0
    return { i, v, a0, a1, name: str(d, nameKey), color: colors[i % colors.length] }
  })
  const pt = (a: number, rr: number) => [cx + rr * Math.sin(a), cy - rr * Math.cos(a)] as const
  return (
    <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && r > 0 && total > 0 && (
        <svg width={width} height={height} role="img" aria-label="카테고리별 매출">
          {slices.map((s) => {
            if (s.v <= 0) return null
            const full = s.a1 - s.a0 >= Math.PI * 2 - 1e-6
            const [x0, y0] = pt(s.a0, r)
            const [x1, y1] = pt(s.a1, r)
            const large = s.a1 - s.a0 > Math.PI ? 1 : 0
            const d = full
              ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
              : `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
            const mid = (s.a0 + s.a1) / 2
            const [lx, ly] = pt(mid, r + 14)
            const pct = Math.round((s.v / total) * 100)
            return (
              <g key={s.i} onMouseEnter={() => setHover(s.i)} onTouchStart={() => setHover(s.i)}>
                <path d={d} fill={s.color} stroke="#fff" strokeWidth={1} opacity={hover === null || hover === s.i ? 1 : 0.6} />
                {pct >= 3 && (
                  <text x={lx} y={ly} fontSize={11} fill={AXIS} textAnchor={Math.sin(mid) >= 0 ? 'start' : 'end'} dominantBaseline="middle">
                    {s.name} {pct}%
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && data[hover] && <Tooltip x={cx} y={cy} width={width}>{tip(data[hover])}</Tooltip>}
    </div>
  )
}
