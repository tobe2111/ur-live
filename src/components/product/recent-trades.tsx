import { ChevronRight } from "lucide-react"

const trades = [
  { size: "260", price: "$159", date: "25/02/15" },
  { size: "270", price: "$162", date: "25/02/14" },
  { size: "250", price: "$155", date: "25/02/14" },
  { size: "280", price: "$169", date: "25/02/13" },
  { size: "260", price: "$158", date: "25/02/13" },
]

export function RecentTrades() {
  return (
    <div className="px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Recent Trades</h2>
        <button className="flex items-center gap-0.5 text-xs text-muted-foreground">
          View All
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-3">
        {/* Table header */}
        <div className="flex items-center border-b border-border py-2">
          <span className="flex-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            Size
          </span>
          <span className="flex-1 text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            Trade Price
          </span>
          <span className="flex-1 text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            Date
          </span>
        </div>

        {/* Rows */}
        {trades.map((trade, i) => (
          <div
            key={i}
            className="flex items-center border-b border-border py-3"
          >
            <span className="flex-1 text-xs font-medium text-foreground">
              {trade.size}
            </span>
            <span className="flex-1 text-right text-xs font-semibold text-foreground">
              {trade.price}
            </span>
            <span className="flex-1 text-right text-xs text-muted-foreground">
              {trade.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
