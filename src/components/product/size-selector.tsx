"use client"

import { useState } from "react"

const sizes = [
  { label: "230", price: "$148" },
  { label: "240", price: "$152" },
  { label: "250", price: "$155" },
  { label: "260", price: "$159" },
  { label: "270", price: "$162" },
  { label: "280", price: "$169" },
  { label: "290", price: "$175" },
  { label: "300", price: "$182" },
]

export function SizeSelector() {
  const [selectedSize, setSelectedSize] = useState("260")

  return (
    <div className="px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Select Size</h2>
        <span className="text-xs text-muted-foreground">All prices are in USD</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {sizes.map((size) => (
          <button
            key={size.label}
            onClick={() => setSelectedSize(size.label)}
            className={`flex flex-col items-center rounded-lg border py-2.5 transition-all ${
              selectedSize === size.label
                ? "border-foreground bg-foreground"
                : "border-border bg-background hover:border-foreground/30"
            }`}
          >
            <span
              className={`text-sm font-semibold ${
                selectedSize === size.label
                  ? "text-background"
                  : "text-foreground"
              }`}
            >
              {size.label}
            </span>
            <span
              className={`mt-0.5 text-[10px] ${
                selectedSize === size.label
                  ? "text-background/70"
                  : "text-destructive"
              }`}
            >
              {size.price}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
