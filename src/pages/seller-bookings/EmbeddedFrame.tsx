/** 🗓️ 2026-11-04 예약 화면 하나 — 안에 들어간 화면은 바깥 틀(SellerLayout)을 다시 그리지 않는다. */
export function EmbeddedFrame({ children }: { title?: string; children: React.ReactNode }) {
  return <>{children}</>
}
