"use client"

import { ArrowLeft } from "lucide-react"

export function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-50 bg-card">
      <div className="mx-auto flex h-14 max-w-lg items-center px-5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold text-foreground">
          주문서
        </h1>
        <div className="w-10" />
      </div>
    </header>
  )
}
