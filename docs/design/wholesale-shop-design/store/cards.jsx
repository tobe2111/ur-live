// ──────────────────────────────────────────────────────────────
// 상품 카드 — 실제 커머스 컨벤션 (스텝퍼 제거 · 코너 퀵담기 · 가격 앵커)
//  A 미니멀  ·  B 정보형  ·  C 도매 마진형
// ──────────────────────────────────────────────────────────────

// 코너 퀵담기 (이미지 우하단 원형 아이콘) — MOQ 단위로 담김
function QuickAdd({ p, onAdd }) {
  const [hit, setHit] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onAdd(p, p.moq); setHit(true); setTimeout(() => setHit(false), 1000); }}
      aria-label={p.name + " 담기"}
      className="absolute bottom-2.5 right-2.5 z-10 h-9 w-9 rounded-full flex items-center justify-center transition-colors"
      style={hit ? { background: T.ink, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                 : { background: "#fff", color: T.ink, boxShadow: "0 2px 8px rgba(0,0,0,0.14)" }}>
      {hit ? Icon.check("w-[18px] h-[18px]") : Icon.plus("w-[18px] h-[18px]")}
    </button>
  );
}

function CardImg({ p, onOpen, quick, onAdd, radius = "rounded-2xl" }) {
  return (
    <div className={"relative w-full aspect-square overflow-hidden " + radius} style={{ background: p.tone }}>
      <button onClick={() => onOpen(p)} aria-label={p.name + " 상세보기"} className="block w-full h-full">
        <Placeholder p={p} className="w-full h-full" />
      </button>
      {p.badge && <div className="absolute top-2.5 left-2.5 z-10"><CornerBadge p={p} /></div>}
      {quick && <QuickAdd p={p} onAdd={onAdd} />}
    </div>
  );
}

// 가격 라인 (할인% + 공급가) — 실제 커머스 위계
function Price({ p, size = 20, accent }) {
  const dr = discountRate(p.supply, p.retail);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-extrabold tabular-nums" style={{ fontSize: 14, color: T.brand }}>{dr}%</span>
      <span className="font-extrabold tracking-[-0.02em] tabular-nums" style={{ fontSize: size, color: accent || T.ink }}>{won(p.supply)}</span>
    </div>
  );
}

// ── A 미니멀 (오늘의집·무신사풍, 보더 없음) ──
function CardA({ p, onAdd, onOpen }) {
  return (
    <div className="group flex flex-col">
      <CardImg p={p} onOpen={onOpen} quick onAdd={onAdd} />
      <button onClick={() => onOpen(p)} className="mt-2.5 text-left text-[14px] leading-[1.4] line-clamp-2 min-h-[39px]" style={{ color: T.ink2 }}>{p.name}</button>
      <div className="mt-1"><Price p={p} /></div>
      <div className="mt-1 text-[12px] tabular-nums" style={{ color: T.ink4 }}>
        <span className="line-through">{won(p.retail)}</span>
        <span className="mx-1.5">·</span>최소 {p.moq}개
      </div>
    </div>
  );
}

// ── B 정보형 (쿠팡풍, 카드 보더 + 담기 버튼) ──
function CardB({ p, onAdd, onOpen }) {
  const [hit, setHit] = useState(false);
  const fire = (e) => { e.stopPropagation(); onAdd(p, p.moq); setHit(true); setTimeout(() => setHit(false), 1000); };
  return (
    <div className="group flex flex-col rounded-2xl bg-white overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{ border: "1px solid " + T.line, boxShadow: T.shSoft }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = T.shCard)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = T.shSoft)}>
      <CardImg p={p} onOpen={onOpen} radius="" />
      <div className="flex flex-col flex-1 p-3.5">
        <button onClick={() => onOpen(p)} className="text-left text-[14px] leading-[1.4] line-clamp-2 min-h-[39px]" style={{ color: T.ink2 }}>{p.name}</button>
        <div className="mt-1.5"><Price p={p} size={21} /></div>
        <div className="mt-0.5 text-[12px] tabular-nums" style={{ color: T.ink4 }}>권장 <span className="line-through">{won(p.retail)}</span></div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: T.ink3 }}>
          <span className="font-semibold" style={{ color: T.pos }}>무료배송</span>
          <span style={{ color: T.line }}>|</span>
          <span className="tabular-nums">{comma(p.sold)} 사입</span>
        </div>
        <button onClick={fire}
          className="mt-3 h-10 rounded-xl text-[14px] font-bold transition-colors whitespace-nowrap"
          style={hit ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink }}>
          {hit ? "담음 ✓" : "담기 · " + p.moq + "개"}
        </button>
      </div>
    </div>
  );
}

// ── C 도매 마진형 (마진을 한 줄로, 위젯 없이) ──
function CardC({ p, onAdd, onOpen }) {
  const mr = marginRate(p.supply, p.retail);
  const um = unitMargin(p.supply, p.retail);
  return (
    <div className="group flex flex-col">
      <CardImg p={p} onOpen={onOpen} quick onAdd={onAdd} />
      <button onClick={() => onOpen(p)} className="mt-2.5 text-left text-[14px] leading-[1.4] line-clamp-2 min-h-[39px]" style={{ color: T.ink2 }}>{p.name}</button>
      <div className="mt-1"><Price p={p} /></div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] tabular-nums whitespace-nowrap">
        <span className="font-bold" style={{ color: T.pos }}>마진 +{won(um)}</span>
        <span style={{ color: T.ink4 }}>({mr}%)</span>
        <span style={{ color: T.line }}>·</span>
        <span style={{ color: T.ink4 }}>재고 {comma(p.stock)}</span>
      </div>
    </div>
  );
}

function ProductCard({ variant = "A", ...props }) {
  if (variant === "B") return <CardB {...props} />;
  if (variant === "C") return <CardC {...props} />;
  return <CardA {...props} />;
}

// ── 가로 레일용 (미니멀 통일) ──
function MiniCard({ p, onAdd, onOpen, w = "w-[150px]", tag }) {
  return (
    <div className={"group shrink-0 " + w + " flex flex-col snap-start"}>
      <div className="relative">
        <CardImg p={p} onOpen={onOpen} quick onAdd={onAdd} />
        {tag && <div className="absolute top-2.5 right-2.5 z-10"><span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white whitespace-nowrap" style={{ background: "rgba(23,24,28,0.82)", backdropFilter: "blur(4px)" }}>{tag}</span></div>}
      </div>
      <button onClick={() => onOpen(p)} className="mt-2 text-left text-[13px] leading-[1.4] line-clamp-2 min-h-[36px]" style={{ color: T.ink2 }}>{p.name}</button>
      <div className="mt-0.5"><Price p={p} size={17} /></div>
    </div>
  );
}

Object.assign(window, { ProductCard, MiniCard, CardImg, QuickAdd, Price });
