"use client"

import { CheckoutHeader } from "@/components/checkout/checkout-header"
import { ShippingInfo } from "@/components/checkout/shipping-info"
import { OrderItems } from "@/components/checkout/order-items"
import { PaymentMethod } from "@/components/checkout/payment-method"
import { AgreementSection } from "@/components/checkout/agreement-section"
import { OrderSummary } from "@/components/checkout/order-summary"
import { MobilePayBar } from "@/components/checkout/mobile-pay-bar"

function Divider() {
  return <div className="h-2 bg-secondary" />
}

export default function CheckoutPage() {
  const productTotal = 69700
  const shippingFee = 0
  const discount = 15200
  const totalPrice = productTotal - discount + shippingFee

  const handlePayment = () => {
    console.log("Processing payment...")
  }

  return (
    <div className="min-h-screen bg-secondary">
      <CheckoutHeader />

      <main className="mx-auto max-w-lg pb-24 lg:max-w-5xl lg:pb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-5 lg:px-5 lg:py-6">
          {/* Left column */}
          <div className="flex flex-1 flex-col lg:overflow-hidden lg:rounded-3xl">
            <ShippingInfo />
            <Divider />
            <OrderItems />
            <Divider />
            <PaymentMethod />
            <Divider />
            <AgreementSection />
          </div>

          {/* Right column - Order summary (desktop only) */}
          <div className="hidden lg:block lg:w-[360px]">
            <div className="sticky top-20 overflow-hidden rounded-3xl">
              <OrderSummary
                productTotal={productTotal}
                shippingFee={shippingFee}
                discount={discount}
                onPayment={handlePayment}
              />
            </div>
          </div>
        </div>

        {/* Mobile order summary */}
        <div className="lg:hidden">
          <Divider />
          <OrderSummary
            productTotal={productTotal}
            shippingFee={shippingFee}
            discount={discount}
            onPayment={handlePayment}
          />
        </div>
      </main>

      <MobilePayBar
        totalPrice={totalPrice}
        onPayment={handlePayment}
      />
    </div>
  )
}
