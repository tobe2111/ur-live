// ──────────────────────────────────────────────────────────────
// 장바구니 — TDS 정제
// ──────────────────────────────────────────────────────────────
function CartScreen({ mode, cart, setItemQty, removeItem, onOpen, goHome, onOrder }) {
  const isMobile = mode === "mobile";
  const items = cart.map((c) => ({ ...byId(c.id), qty: c.qty })).filter((x) => x.id);
  const subtotal = items.reduce((s, x) => s + x.supply * x.qty, 0);
  const retailTotal = items.reduce((s, x) => s + x.retail * x.qty, 0);
  const marginTotal = retailTotal - subtotal;
  const shipping = subtotal >= 500000 || subtotal === 0 ? 0 : 3000;
  const totalQty = items.reduce((s, x) => s + x.qty, 0);

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-full flex flex-col items-center justify-center py-24 text-center" style={{ color: T.ink }}>
        <div className="text-[48px] mb-3">🧺</div>
        <div className="text-[17px] font-bold">담은 상품이 없어요</div>
        <div className="text-[14px] mt-1.5" style={{ color: T.ink3 }}>마음에 드는 상품을 담아보세요</div>
        <button onClick={goHome} className="mt-5 px-7 h-12 rounded-xl text-[15px] font-bold text-white" style={{ background: T.brand }}>상품 둘러보기</button>
      </div>
    );
  }

  const SummaryRows = () => (
    <dl className="space-y-2.5 text-[15px] whitespace-nowrap">
      <div className="flex justify-between"><dt style={{ color: T.ink3 }}>상품 합계 (공급가)</dt><dd className="font-bold tabular-nums" style={{ color: T.ink }}>{won(subtotal)}</dd></div>
      <div className="flex justify-between"><dt style={{ color: T.ink3 }}>총 수량</dt><dd className="tabular-nums" style={{ color: T.ink2 }}>{comma(totalQty)}개</dd></div>
      <div className="flex justify-between"><dt style={{ color: T.ink3 }}>예상 배송비</dt><dd className="tabular-nums" style={{ color: T.ink2 }}>{shipping === 0 ? "무료" : won(shipping)}</dd></div>
      <div className="flex justify-between"><dt className="font-semibold" style={{ color: T.pos }}>예상 마진 여력</dt><dd className="font-extrabold tabular-nums" style={{ color: T.pos }}>+{won(marginTotal)}</dd></div>
    </dl>
  );

  const rows = (
    <div className="space-y-0">
      {items.map((x, idx) => (
        <div key={x.id} className="flex gap-3.5 py-4" style={idx ? { borderTop: "1px solid " + T.line } : {}}>
          <button onClick={() => onOpen(x)} className="w-[68px] h-[68px] shrink-0 rounded-2xl overflow-hidden" style={{ background: x.tone }}>
            <Placeholder p={x} className="w-full h-full" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => onOpen(x)} className="text-left text-[15px] font-medium line-clamp-1" style={{ color: T.ink }}>{x.name}</button>
              <button onClick={() => removeItem(x.id)} aria-label="삭제" style={{ color: T.ink4 }} className="shrink-0 hover:opacity-60">{Icon.trash("w-5 h-5")}</button>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <GradeChip /><span className="text-[16px] font-extrabold tabular-nums" style={{ color: T.ink }}>{won(x.supply)}</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <Stepper value={x.qty} onChange={(v) => setItemQty(x.id, v)} step={x.moq} min={x.moq} size="sm" />
              <span className="text-[16px] font-extrabold tabular-nums" style={{ color: T.ink }}>{won(x.supply * x.qty)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white min-h-full" style={{ color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-36" : "pb-10")}>
        <h1 className="text-[22px] font-extrabold tracking-tight mb-1">장바구니</h1>
        <p className="text-[14px] mb-4" style={{ color: T.ink3 }}>검증된 제조사 직배송 · 선결제 주문</p>

        <div className={isMobile ? "" : "flex gap-8 items-start"}>
          <div className="flex-1 min-w-0">
            <div className="mb-3 rounded-2xl p-3.5" style={{ background: T.fill2 }}>
              <div className="flex items-center justify-between mb-2.5 whitespace-nowrap">
                <span className="text-[13px] font-bold" style={{ color: T.ink2 }}>대량 주문</span>
                <span className="text-[12px]" style={{ color: T.ink4 }}>양식 다운 → 작성 → 업로드</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: "#fff", color: T.ink2, border: "1px solid " + T.line }}>
                  {Icon.doc("w-4 h-4")} 주문 양식 다운로드
                </button>
                <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: T.ink, color: "#fff" }}>
                  {Icon.upload("w-4 h-4")} 작성본 업로드
                </button>
              </div>
            </div>
            {rows}
          </div>

          {!isMobile && (
            <div className="w-[320px] shrink-0 sticky top-4">
              <div className="rounded-2xl p-5" style={{ background: T.fill2 }}>
                <div className="text-[16px] font-extrabold mb-3.5">주문 요약</div>
                <SummaryRows />
                <div className="my-4" style={{ borderTop: "1px solid " + T.line }} />
                <div className="flex justify-between items-baseline whitespace-nowrap">
                  <span className="text-[15px] font-semibold" style={{ color: T.ink2 }}>결제 예정</span>
                  <span className="text-[24px] font-extrabold tabular-nums">{won(subtotal + shipping)}</span>
                </div>
                <button onClick={onOrder} className="mt-4 w-full h-14 rounded-2xl text-[16px] font-bold text-white active:brightness-95" style={{ background: T.brand }}>주문하기 (선결제)</button>
                <p className="mt-3 text-[12px] text-center leading-relaxed" style={{ color: T.ink4 }}>선결제 후 제조사 출고 → 정산 주기에 따라 매출 정산</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 모바일 하단 결제 바
function CartActionBar({ cart, onOrder }) {
  const items = cart.map((c) => ({ ...byId(c.id), qty: c.qty })).filter((x) => x.id);
  if (!items.length) return null;
  const subtotal = items.reduce((s, x) => s + x.supply * x.qty, 0);
  const shipping = subtotal >= 500000 ? 0 : 3000;
  return (
    <div className="absolute bottom-0 inset-x-0 z-40 bg-white px-5 pt-3 pb-4" style={{ borderTop: "1px solid " + T.line, boxShadow: "0 -6px 20px -12px rgba(0,0,0,0.18)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[14px]" style={{ color: T.ink3 }}>결제 예정 · 배송비 {shipping === 0 ? "무료" : won(shipping)}</span>
        <span className="text-[20px] font-extrabold tabular-nums" style={{ color: T.ink }}>{won(subtotal + shipping)}</span>
      </div>
      <button onClick={onOrder} className="w-full h-14 rounded-2xl text-[16px] font-bold text-white active:brightness-95" style={{ background: T.brand }}>주문하기 (선결제)</button>
    </div>
  );
}

Object.assign(window, { CartScreen, CartActionBar });
