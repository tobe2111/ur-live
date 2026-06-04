// ──────────────────────────────────────────────────────────────
// 상품 상세 — 고급화 (수량 구간 단가표 · 하단 고정 액션바)
// ──────────────────────────────────────────────────────────────

// 큰 담기 버튼 (Button 컴포넌트 미사용 — 직접 클래스)
function BigAdd({ p, qty, onAdd, label = "장바구니", className = "" }) {
  const [hit, setHit] = useState(false);
  const fire = () => { onAdd(p, qty); setHit(true); setTimeout(() => setHit(false), 1100); };
  return (
    <button onClick={fire}
      className={"inline-flex items-center justify-center gap-1.5 h-14 rounded-2xl text-[16px] font-bold whitespace-nowrap transition-colors active:brightness-95 " + className}
      style={hit ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink }}>
      {hit ? <>{Icon.check("w-5 h-5")} 담음</> : label}
    </button>
  );
}

function OrderBtn({ className = "", onClick }) {
  return (
    <button onClick={onClick} className={"inline-flex items-center justify-center h-14 rounded-2xl text-[16px] font-bold text-white whitespace-nowrap active:brightness-95 " + className}
      style={{ background: T.brand }}>바로 주문</button>
  );
}

function KV({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between px-4 h-12 whitespace-nowrap">
      <span className="text-[14px]" style={{ color: T.ink3 }}>{label}</span>
      <span className="text-[15px] font-bold tabular-nums" style={{ color: accent || T.ink }}>{value}</span>
    </div>
  );
}

// 수량 구간별 단가표 (B2B 핵심)
function TierTable({ p }) {
  const tiers = priceTiers(p);
  const base = tiers[0].unit;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid " + T.line }}>
      <div className="flex items-center justify-between px-4 h-10 whitespace-nowrap" style={{ background: T.fill2 }}>
        <span className="text-[12px] font-bold" style={{ color: T.ink2 }}>수량 구간별 단가</span>
        <span className="text-[12px]" style={{ color: T.ink3 }}>많이 살수록 ↓</span>
      </div>
      {tiers.map((t, i) => {
        const cur = i === 0;
        const save = base - t.unit;
        return (
          <div key={t.label} className="flex items-center justify-between px-4 h-12 whitespace-nowrap"
            style={{ borderTop: "1px solid " + T.line, background: cur ? T.brandSoft : "#fff" }}>
            <span className="text-[14px] font-semibold" style={{ color: cur ? T.brand : T.ink }}>{t.label}
              {cur && <span className="ml-1.5 text-[11px] font-bold" style={{ color: T.brand }}>현재</span>}
            </span>
            <span className="flex items-baseline gap-2">
              {save > 0 && <span className="text-[12px] font-semibold tabular-nums" style={{ color: T.pos }}>개당 -{won(save)}</span>}
              <span className="text-[15px] font-extrabold tabular-nums" style={{ color: cur ? T.brand : T.ink }}>{won(t.unit)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DetailScreen({ mode, product, qty, setQty, onAdd, onOpen, onBack, onBuy }) {
  const p = product || byId(7);
  const [tab, setTab] = useState("desc");
  const [thumb, setThumb] = useState(0);
  useEffect(() => { setThumb(0); setTab("desc"); }, [p.id]);

  const um = unitMargin(p.supply, p.retail);
  const mr = marginRate(p.supply, p.retail);
  const dr = discountRate(p.supply, p.retail);
  const reco = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id).slice(0, 6);
  const isMobile = mode === "mobile";
  const tabs = [{ id: "desc", label: "상세설명" }, { id: "ship", label: "배송" }, { id: "settle", label: "정산" }, { id: "return", label: "반품·교환" }];

  const gallery = (
    <div className={isMobile ? "" : "w-[46%] shrink-0"}>
      <div className="relative aspect-square rounded-2xl overflow-hidden" style={{ border: "1px solid " + T.line }}>
        <Placeholder p={p} big className="w-full h-full" />
        {p.badge && <div className="absolute top-3.5 left-3.5 z-10"><CornerBadge p={p} /></div>}
      </div>
      <div className="mt-2.5 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-[58px] h-[58px] rounded-xl shrink-0" style={{ background: i === thumb ? T.fill : T.fill2, border: "1px solid " + (i === thumb ? T.ink4 : T.line) }} onClick={() => setThumb(i)} />
        ))}
      </div>
    </div>
  );

  const info = (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap" style={{ background: T.fill, color: T.ink2 }}>{CAT_LABEL[p.cat]}</span>
        {p.badge === "deal" && <Countdown dday={p.dday || "D-1"} className="ml-1" />}
      </div>
      <h1 className={"font-extrabold tracking-[-0.01em] leading-snug " + (isMobile ? "text-[21px]" : "text-[26px]")} style={{ color: T.ink }}>{p.name}</h1>

      {/* 가격 */}
      <div className="mt-4 flex items-center gap-2 whitespace-nowrap">
        <GradeChip size="md" />
        <span className="text-[13px]" style={{ color: T.ink3 }}>개당 공급가</span>
      </div>
      <div className="mt-1.5 flex items-end gap-2.5">
        <span className={"font-extrabold tracking-[-0.02em] tabular-nums leading-none " + (isMobile ? "text-[34px]" : "text-[42px]")} style={{ color: T.ink }}>{won(p.supply)}</span>
        <span className="text-[15px] font-bold tabular-nums mb-1" style={{ color: T.ink3 }}>-{dr}%</span>
      </div>
      <div className="mt-1.5 text-[14px] tabular-nums whitespace-nowrap" style={{ color: T.ink4 }}>
        권장 소비자가 <span className="line-through">{won(p.retail)}</span>
        <span className="mx-2" style={{ color: T.line }}>|</span>
        박스 {p.moq}개 <span className="font-semibold" style={{ color: T.ink2 }}>{won(boxPrice(p))}</span>
      </div>

      {/* 마진 여력 */}
      <div className="mt-3.5 flex items-center gap-2 rounded-2xl p-3.5 whitespace-nowrap" style={{ background: T.posBg }}>
        {Icon.check("w-5 h-5")}
        <span className="text-[14px] font-bold" style={{ color: T.pos }}>개당 마진 +{won(um)} <span className="font-extrabold">({mr}%)</span></span>
        <span className="ml-auto text-[13px] font-medium" style={{ color: T.pos }}>박스 +{won(um * p.moq)}</span>
      </div>

      {/* 수량 구간 단가표 */}
      <div className="mt-3.5"><TierTable p={p} /></div>

      {/* 정보 리스트 */}
      <div className="mt-3.5 rounded-2xl overflow-hidden" style={{ background: T.fill2 }}>
        <KV label="재고" value={comma(p.stock) + "개"} accent={p.stock < 200 ? "#C2620C" : null} />
        <div style={{ borderTop: "1px solid " + T.line }} />
        <KV label="최소 주문 (MOQ)" value={p.moq + "개 단위"} />
        <div style={{ borderTop: "1px solid " + T.line }} />
        <KV label="정산 주기" value={p.badge === "best" ? "익일 정산 (브랜드)" : "7일 정산 (일반)"} />
      </div>

      {/* 데스크톱 인라인 CTA */}
      {!isMobile && (
        <>
          <div className="mt-5 flex items-center gap-3">
            <Stepper value={qty} onChange={setQty} step={p.moq} min={p.moq} />
            <div className="flex-1 text-right whitespace-nowrap">
              <span className="text-[13px] mr-2" style={{ color: T.ink3 }}>합계</span>
              <span className="text-[20px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: T.ink }}>{won(p.supply * qty)}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2.5">
            <BigAdd p={p} qty={qty} onAdd={onAdd} className="px-7" />
            <OrderBtn className="flex-1" onClick={onBuy} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-full" style={{ color: T.ink, background: "#fff" }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-3 " + (isMobile ? "pb-28" : "pb-10")}>
        <button onClick={onBack} className="flex items-center gap-1 text-[14px] font-medium mb-3 -ml-1 whitespace-nowrap" style={{ color: T.ink2 }}>
          {Icon.back("w-5 h-5")} 목록
        </button>
        <div className={isMobile ? "space-y-5" : "flex gap-8"}>{gallery}{info}</div>

        {/* 섹션 탭 */}
        <div className="mt-8 flex gap-1" style={{ borderBottom: "1px solid " + T.line }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3.5 py-2.5 text-[15px] font-bold -mb-px transition-colors whitespace-nowrap"
              style={tab === t.id ? { color: T.ink, borderBottom: "2px solid " + T.ink } : { color: T.ink4, borderBottom: "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="py-5 text-[15px] leading-relaxed" style={{ color: T.ink2 }}>
          {tab === "desc" && (
            <div className="space-y-4">
              <p>검증된 제조사가 공급하는 <b style={{ color: T.ink }}>{p.name}</b> 입니다. 대량 사입에 최적화된 단위 포장으로, 소매 판매 시 충분한 마진 여력을 확보할 수 있어요.</p>
              <div className="grid grid-cols-2 gap-2.5 max-w-lg">
                {["국내 검증 제조사 공급", p.moq + "개 단위 박스 포장", "상온 보관 · 직사광선 회피", "유통기한 제조일 +12개월"].map((x) => (
                  <div key={x} className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[14px]" style={{ background: T.fill2, color: T.ink2 }}>
                    <span style={{ color: T.pos }}>{Icon.check("w-4 h-4 mt-0.5")}</span>{x}
                  </div>
                ))}
              </div>
              <div className="rounded-2xl h-44 overflow-hidden" style={{ border: "1px solid " + T.line }}>
                <Placeholder p={p} className="w-full h-full" />
              </div>
            </div>
          )}
          {tab === "ship" && <p>주문 확정 후 1~2 영업일 내 출고됩니다. 박스 단위로 합포장되며, 50만원 이상 사입 시 배송비가 무료예요. 도서산간은 추가 배송비가 발생할 수 있어요.</p>}
          {tab === "settle" && (<div className="space-y-2"><p><b style={{ color: T.ink }}>브랜드 상품</b>은 출고 익일, <b style={{ color: T.ink }}>일반 상품</b>은 출고 후 7일에 정산돼요.</p><p style={{ color: T.ink3 }}>본 상품은 <b style={{ color: T.brand }}>{p.badge === "best" ? "익일 정산(브랜드)" : "7일 정산(일반)"}</b> 대상입니다.</p></div>)}
          {tab === "return" && <p>단순 변심 반품은 미개봉 박스 단위에 한해 출고일로부터 7일 내 가능합니다. 식품·위생용품은 개봉 시 교환·반품이 제한돼요.</p>}
        </div>

        <section className="mt-2">
          <SectionHead title="같은 카테고리" sub={CAT_LABEL[p.cat]} />
          <Rail>{reco.map((x) => <MiniCard key={x.id} p={x} onAdd={onAdd} onOpen={onOpen} w={isMobile ? "w-[152px]" : "w-[166px]"} />)}</Rail>
        </section>
      </div>
    </div>
  );
}

// 모바일 하단 고정 액션바
function DetailActionBar({ p, qty, setQty, onAdd, onBuy }) {
  return (
    <div className="absolute bottom-0 inset-x-0 z-40 bg-white px-4 pt-2.5 pb-4" style={{ borderTop: "1px solid " + T.line, boxShadow: T.shUp }}>
      <div className="flex items-center justify-between mb-2.5 px-1 whitespace-nowrap">
        <Stepper value={qty} onChange={setQty} step={p.moq} min={p.moq} size="sm" />
        <div className="text-right">
          <span className="text-[12px] mr-1.5" style={{ color: T.ink3 }}>합계</span>
          <span className="text-[19px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: T.ink }}>{won(p.supply * qty)}</span>
        </div>
      </div>
      <div className="flex gap-2.5">
        <BigAdd p={p} qty={qty} onAdd={onAdd} className="px-6" />
        <OrderBtn className="flex-1" onClick={onBuy} />
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen, DetailActionBar, BigAdd, OrderBtn });
