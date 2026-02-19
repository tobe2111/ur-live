"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const data = [
  { date: "1M", price: 142 },
  { date: "2M", price: 155 },
  { date: "3M", price: 148 },
  { date: "4M", price: 162 },
  { date: "5M", price: 151 },
  { date: "6M", price: 172 },
  { date: "7M", price: 165 },
  { date: "8M", price: 158 },
  { date: "9M", price: 175 },
  { date: "10M", price: 168 },
  { date: "11M", price: 159 },
  { date: "12M", price: 159 },
]

const periods = ["1M", "3M", "6M", "1Y", "ALL"] as const

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md bg-foreground px-3 py-1.5 shadow-sm">
        <p className="text-xs font-semibold text-background">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    )
  }
  return null
}

export function MarketPriceChart() {
  const [activePeriod, setActivePeriod] = useState<(typeof periods)[number]>("1Y")

  return (
    <div className="px-5 py-6">
      <h2 className="text-sm font-bold text-foreground">Market Price Trend</h2>

      {/* Period tabs */}
      <div className="mt-3 flex gap-1">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              activePeriod === period
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `$${v}`}
              domain={["dataMin - 10", "dataMax + 10"]}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeDasharray: "4 4",
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: "hsl(var(--destructive))",
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-secondary p-3.5">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Recent Transaction
          </p>
          <p className="mt-1 text-base font-bold text-foreground">$159,000</p>
        </div>
        <div className="rounded-lg bg-secondary p-3.5">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Price Change
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <p className="text-base font-bold text-destructive">-7.6%</p>
            <span className="text-[10px] text-muted-foreground">vs last month</span>
          </div>
        </div>
      </div>
    </div>
  )
}
