// ──────────────────────────────────────────────────────────────
// 부가 화면·시트 — 검색 · 카테고리 · 마이 · 공급가요청 · OEM · 주문완료
// ──────────────────────────────────────────────────────────────

// 바텀시트 셸
function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[55] flex items-end justify-center bg-black/35" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-t-3xl bg-white p-5 pb-7 max-h-[88%] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: T.line }} />
        {children}
      </div>
    </div>
  );
}

// ── 검색 (전체화면 오버레이) ──
function SearchSheet({ open, onClose, onOpen }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current && inputRef.current.focus(), 50); } }, [open]);
  if (!open) return null;
  const popular = ["감귤", "원두", "핸드크림", "텀블러", "마스크팩", "양말"];
  const res = q.trim() ? PRODUCTS.filter((p) => p.name.includes(q.trim())) : [];
  return (
    <div className="absolute inset-0 z-[55] bg-white flex flex-col" style={{ color: T.ink }}>
      <div className="flex items-center gap-2 px-4 h-[60px] shrink-0" style={{ borderBottom: "1px solid " + T.line }}>
        <button onClick={onClose} aria-label="닫기" className="shrink-0 p-1" style={{ color: T.ink2 }}>{Icon.back("w-6 h-6")}</button>
        <div className="flex-1 flex items-center gap-2 rounded-full px-4 h-10" style={{ background: T.fill }}>
          {Icon.search("w-4 h-4")}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품 검색"
            className="flex-1 bg-transparent text-[15px] outline-none min-w-0" style={{ color: T.ink }} />
          {q && <button onClick={() => setQ("")} className="text-[18px] shrink-0" style={{ color: T.ink4 }}>✕</button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!q.trim() ? (
          <div>
            <div className="text-[13px] font-bold mb-2.5" style={{ color: T.ink3 }}>인기 검색어</div>
            <div className="flex flex-wrap gap-2">
              {popular.map((k) => (
                <button key={k} onClick={() => setQ(k)} className="rounded-full px-3.5 h-9 text-[13px] font-semibold whitespace-nowrap" style={{ background: T.fill, color: T.ink2 }}>{k}</button>
              ))}
            </div>
          </div>
        ) : res.length === 0 ? (
          <div className="text-center py-16 text-[14px]" style={{ color: T.ink3 }}>‘{q}’ 검색 결과가 없어요</div>
        ) : (
          <div className="space-y-0">
            <div className="text-[13px] mb-1" style={{ color: T.ink3 }}>{res.length}개 상품</div>
            {res.map((p, i) => (
              <button key={p.id} onClick={() => { onClose(); onOpen(p); }} className="w-full flex items-center gap-3 py-3 text-left" style={i ? { borderTop: "1px solid " + T.line } : {}}>
                <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid " + T.line }}><Placeholder p={p} className="w-full h-full" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium line-clamp-1" style={{ color: T.ink }}>{p.name}</span>
                  <span className="block text-[13px] mt-0.5" style={{ color: T.ink3 }}>{CAT_LABEL[p.cat]} · 재고 {comma(p.stock)}</span>
                </span>
                <span className="text-[16px] font-extrabold tabular-nums shrink-0" style={{ color: T.ink }}>{won(p.supply)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 카테고리 화면 ──
function CategoryScreen({ mode, setCat, goHome }) {
  const isMobile = mode === "mobile";
  const ICON = { food: "🍱", beauty: "💄", living: "🏠", fashion: "👕", digital: "🔌", life: "🧴" };
  const cats = CATEGORIES.filter((c) => c.id !== "all");
  return (
    <div className="min-h-full" style={{ background: "#fff", color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-24" : "pb-10")}>
        <ScreenTitle title="카테고리" sub="원하는 분류에서 사입하세요" />
        <div className={"grid gap-3 " + (isMobile ? "grid-cols-2" : "grid-cols-3")}>
          {cats.map((c) => {
            const n = PRODUCTS.filter((p) => p.cat === c.id).length;
            return (
              <button key={c.id} onClick={() => { setCat(c.id); goHome(); }}
                className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5" style={{ background: T.fill2, boxShadow: T.shSoft }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl text-[24px] shrink-0" style={{ background: "#fff" }}>{ICON[c.id]}</span>
                  <span className="min-w-0">
                  <span className="block text-[15px] font-bold whitespace-nowrap" style={{ color: T.ink }}>{c.label}</span>
                  <span className="block text-[12px] tabular-nums whitespace-nowrap" style={{ color: T.ink3 }}>{n}개 상품</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 마이 ──
function MyScreen({ mode, setScreen, onGrade, openSheet }) {
  const isMobile = mode === "mobile";
  const groups = [
    { title: "주문·정산", items: [["주문내역", "orders"], ["정산", "settle"], ["자료 발행", "docs"]] },
    { title: "공급가·소싱", items: [["공급가 매칭 요청", "match"], ["OEM/ODM 신청", "oem"]] },
    { title: "설정", items: [["알림 설정", null], ["배송지 관리", null], ["로그아웃", null]] },
  ];
  const go = (key) => { if (!key) return; if (key === "match" || key === "oem") openSheet(key); else setScreen(key); };
  return (
    <div className="min-h-full" style={{ background: T.fill, color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-24" : "pb-10")}>
        <div className="rounded-2xl bg-white p-5 mb-4" style={{ boxShadow: T.shSoft }}>
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-[17px] font-extrabold text-white shrink-0" style={{ background: T.brand }}>{ME.grade}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-extrabold" style={{ color: T.ink }}>{ME.company}</div>
              <div className="text-[13px] mt-0.5 truncate" style={{ color: T.ink3 }}>{ME.grade}등급 · {ME.marginLabel} · 사업자 123-45-67890</div>
            </div>
            <button onClick={onGrade} className="shrink-0 rounded-lg px-3 h-9 text-[13px] font-bold" style={{ background: T.brandSoft, color: T.brand }}>등급</button>
          </div>
        </div>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="text-[13px] font-bold mb-2 px-1" style={{ color: T.ink3 }}>{g.title}</div>
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: T.shSoft }}>
                {g.items.map(([label, key], i) => (
                  <button key={label} onClick={() => go(key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left whitespace-nowrap" style={i ? { borderTop: "1px solid " + T.line } : {}}>
                    <span className="text-[15px] whitespace-nowrap" style={{ color: label === "로그아웃" ? T.ink4 : T.ink }}>{label}</span>
                    {Icon.chevron("w-4 h-4 shrink-0")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 공급가 매칭 요청 ──
function MatchSheet({ open, onClose }) {
  const [cat, setCat] = useState("food");
  const [margin, setMargin] = useState(30);
  const [done, setDone] = useState(false);
  useEffect(() => { if (open) { setDone(false); setMargin(30); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose}>
      {done ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: T.posBg, color: T.pos }}>{Icon.check("w-6 h-6")}</div>
          <div className="text-[17px] font-bold" style={{ color: T.ink }}>요청이 접수됐어요</div>
          <div className="text-[14px] mt-1.5 leading-relaxed" style={{ color: T.ink3 }}>관리자가 희망 마진을 검토 후<br/>등급·공급가 반영 여부를 안내드려요</div>
          <button onClick={onClose} className="mt-5 w-full h-14 rounded-2xl text-[15px] font-bold text-white" style={{ background: T.ink }}>확인</button>
        </div>
      ) : (
        <>
          <h3 className="text-[20px] font-extrabold" style={{ color: T.ink }}>공급가 매칭 요청</h3>
          <p className="text-[13px] mt-1 mb-4 leading-relaxed" style={{ color: T.ink3 }}>판매가 대비 원하는 마진율을 알려주시면, 관리자가 제조사 공급가와 매칭해 등급에 반영할지 검토해요.</p>
          <div className="text-[13px] font-bold mb-2" style={{ color: T.ink2 }}>카테고리</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className="rounded-full px-3.5 h-9 text-[13px] font-semibold"
                style={cat === c.id ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink2 }}>{c.label}</button>
            ))}
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold" style={{ color: T.ink2 }}>희망 마진율</span>
            <span className="text-[18px] font-extrabold tabular-nums" style={{ color: T.brand }}>{margin}%</span>
          </div>
          <input type="range" min="15" max="60" value={margin} onChange={(e) => setMargin(+e.target.value)} className="w-full mb-5 accent-[#FF0033]" />
          <button onClick={() => setDone(true)} className="w-full h-14 rounded-2xl text-[16px] font-bold text-white" style={{ background: T.brand }}>요청 보내기</button>
        </>
      )}
    </Sheet>
  );
}

// ── OEM/ODM 신청 ──
function OemSheet({ open, onClose }) {
  const [cat, setCat] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { if (open) { setDone(false); setCat(""); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose}>
      {done ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: T.posBg, color: T.pos }}>{Icon.check("w-6 h-6")}</div>
          <div className="text-[17px] font-bold" style={{ color: T.ink }}>신청이 접수됐어요</div>
          <div className="text-[14px] mt-1.5 leading-relaxed" style={{ color: T.ink3 }}>유통스타트가 적합한 제조사를 찾아<br/>생산까지 연결·컨설팅해 드려요</div>
          <button onClick={onClose} className="mt-5 w-full h-14 rounded-2xl text-[15px] font-bold text-white" style={{ background: T.ink }}>확인</button>
        </div>
      ) : (
        <>
          <h3 className="text-[20px] font-extrabold" style={{ color: T.ink }}>OEM/ODM 신청</h3>
          <p className="text-[13px] mt-1 mb-4 leading-relaxed" style={{ color: T.ink3 }}>자사 브랜드 제품이 필요하신가요? 카테고리와 정보를 남기면 제조사 연결과 컨설팅을 지원해요.</p>
          <div className="text-[13px] font-bold mb-2" style={{ color: T.ink2 }}>희망 카테고리</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className="rounded-full px-3.5 h-9 text-[13px] font-semibold"
                style={cat === c.id ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink2 }}>{c.label}</button>
            ))}
          </div>
          {[["브랜드명 (선택)", "예: 한빛셀렉트"], ["희망 수량 / MOQ", "예: 1,000개"], ["연락처", "010-0000-0000"]].map(([l, ph]) => (
            <div key={l} className="mb-3">
              <div className="text-[13px] font-bold mb-1.5" style={{ color: T.ink2 }}>{l}</div>
              <input placeholder={ph} className="w-full rounded-xl px-3.5 h-12 text-[14px] outline-none" style={{ background: T.fill2, color: T.ink, border: "1px solid " + T.line }} />
            </div>
          ))}
          <button disabled={!cat} onClick={() => setDone(true)} className="mt-2 w-full h-14 rounded-2xl text-[16px] font-bold text-white transition-opacity" style={{ background: T.brand, opacity: cat ? 1 : 0.4 }}>상담 신청하기</button>
        </>
      )}
    </Sheet>
  );
}

// ── 주문 완료 (센터 모달) ──
function OrderComplete({ order, onClose, onOrders }) {
  if (!order) return null;
  const total = order.items.reduce((s, it) => s + byId(it.id).supply * it.q, 0);
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div className="w-full max-w-[380px] rounded-3xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: T.brand, color: "#fff" }}>{Icon.check("w-9 h-9")}</div>
        <div className="text-[20px] font-extrabold" style={{ color: T.ink }}>주문이 완료됐어요</div>
        <div className="text-[14px] mt-1.5" style={{ color: T.ink3 }}>선결제 후 제조사가 출고를 준비해요</div>
        <div className="mt-5 rounded-2xl p-4 text-left" style={{ background: T.fill2 }}>
          <div className="flex justify-between text-[13px] mb-1.5 whitespace-nowrap"><span style={{ color: T.ink3 }}>주문번호</span><span className="font-bold tabular-nums" style={{ color: T.ink }}>{order.no}</span></div>
          <div className="flex justify-between text-[13px] whitespace-nowrap"><span style={{ color: T.ink3 }}>결제 금액</span><span className="font-extrabold tabular-nums" style={{ color: T.ink }}>{won(total)}</span></div>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button onClick={onClose} className="flex-1 h-13 py-4 rounded-2xl text-[15px] font-bold" style={{ background: T.fill, color: T.ink }}>쇼핑 계속</button>
          <button onClick={onOrders} className="flex-1 h-13 py-4 rounded-2xl text-[15px] font-bold text-white" style={{ background: T.brand }}>주문내역 보기</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sheet, SearchSheet, CategoryScreen, MyScreen, MatchSheet, OemSheet, OrderComplete });
