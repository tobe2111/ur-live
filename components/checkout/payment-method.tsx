"use client"

export function PaymentMethod() {
  return (
    <section className="bg-card px-5 py-6">
      <h2 className="text-[17px] font-bold text-foreground">결제 수단</h2>
      <div className="mt-4">
        {/* TossPayments widget - DO NOT MODIFY */}
        <div id="payment-method" className="min-h-[100px]" />
      </div>
    </section>
  )
}
