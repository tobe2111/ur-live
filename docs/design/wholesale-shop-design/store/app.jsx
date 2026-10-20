// ──────────────────────────────────────────────────────────────
// 헤더 · 하단탭 · 스토어 셸 — TDS 정제
// ──────────────────────────────────────────────────────────────

function Logo({ small }) {
  return (
    <div className="flex items-center gap-1.5 select-none shrink-0 whitespace-nowrap">
      <span className={"font-extrabold tracking-[-0.02em] " + (small ? "text-[18px]" : "text-[20px]")} style={{ color: T.ink }}>
        유통<span style={{ color: T.brand }}>스타트</span>
      </span>
      <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none whitespace-nowrap" style={{ background: T.fill, color: T.ink2 }}>도매</span>
    </div>
  );
}

// 등급 안내 — 바텀시트
function GradeSheet({ open, onClose, onMatch }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-3xl bg-white p-5 pb-7" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: T.line }} />
        <h3 className="text-[20px] font-extrabold" style={{ color: T.ink }}>회원 등급 안내</h3>
        <p className="text-[14px] mt-1 mb-4" style={{ color: T.ink3 }}>사입 실적이 쌓이면 등급이 올라 공급가가 더 낮아져요.</p>
        <div className="space-y-2">
          {GRADE_INFO.map((g) => (
            <div key={g.g} className="flex items-center gap-3.5 rounded-2xl p-3.5" style={g.cur ? { background: T.brandBg } : { background: T.fill2 }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full font-extrabold text-white shrink-0"
                style={{ background: g.cur ? T.brand : (g.special ? "#7C8698" : T.ink4), fontSize: g.special ? 18 : 16 }}>{g.mark}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold whitespace-nowrap" style={{ color: T.ink }}>{g.g === "특별가" ? "특별가 등급" : g.g + "등급"} {g.cur && <span className="text-[12px] font-bold" style={{ color: T.brand }}>· 내 등급</span>}</div>
                <div className="text-[13px] truncate" style={{ color: T.ink3 }}>{g.desc}</div>
              </div>
              <div className="text-[14px] font-bold shrink-0" style={{ color: g.cur ? T.brand : T.ink2 }}>{g.margin}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { onClose(); onMatch && onMatch(); }} className="mt-3 w-full flex items-center justify-between rounded-2xl p-3.5 text-left" style={{ background: T.fill }}>
          <div className="min-w-0">
            <div className="text-[14px] font-bold" style={{ color: T.ink }}>더 좋은 공급가 요청하기</div>
            <div className="text-[12px] mt-0.5 truncate" style={{ color: T.ink3 }}>원하는 마진%를 제출하면 관리자가 검토해요</div>
          </div>
          {Icon.chevron("w-5 h-5 shrink-0")}
        </button>
        <button onClick={onClose} className="mt-3 w-full h-14 rounded-2xl text-[16px] font-bold text-white active:brightness-95" style={{ background: T.ink }}>확인</button>
      </div>
    </div>
  );
}

function Header({ mode, cartCount, setScreen, onGrade, cat, setCat, onSearch }) {
  if (mode === "mobile") {
    return (
      <header className="sticky top-0 z-30 bg-white" style={{ borderBottom: "1px solid " + T.line }}>
        <div className="flex items-center gap-2.5 px-5 h-[56px]">
          <button onClick={() => setScreen("home")} className="shrink-0"><Logo small /></button>
          <button onClick={onSearch} className="flex-1 flex items-center gap-2 rounded-full px-3.5 h-9 min-w-0" style={{ background: T.fill }}>
            {Icon.search("w-4 h-4")}
            <span className="text-[14px] whitespace-nowrap" style={{ color: T.ink3 }}>상품 검색</span>
          </button>
          <button onClick={onGrade} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: T.brand }} aria-label="내 등급">{ME.grade}</button>
          <button onClick={() => setScreen("cart")} className="relative shrink-0" aria-label="장바구니">
            {Icon.cart("w-7 h-7")}
            {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: T.brand }}>{cartCount}</span>}
          </button>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-30 bg-white" style={{ borderBottom: "1px solid " + T.line }}>
      <div className="flex items-center gap-5 px-7 h-[68px]">
        <button onClick={() => setScreen("home")} className="shrink-0"><Logo /></button>
        <div onClick={onSearch} className="flex-1 max-w-[460px] flex items-center gap-2.5 rounded-2xl px-4 h-12 min-w-0 cursor-text" style={{ background: T.fill }}>
          {Icon.search("w-5 h-5")}
          <input readOnly placeholder="어떤 상품을 사입하시나요?" className="flex-1 bg-transparent text-[15px] outline-none min-w-0 cursor-text" style={{ color: T.ink }} />
        </div>
        <button onClick={onGrade} className="flex items-center gap-2 rounded-2xl px-3.5 h-11 shrink-0 whitespace-nowrap" style={{ background: T.brandBg }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full font-extrabold text-[12px] text-white" style={{ background: T.brand }}>{ME.grade}</span>
          <span className="text-[14px] font-bold" style={{ color: T.ink }}>{ME.grade}등급 · {ME.marginLabel}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0" style={{ color: T.ink2 }}>
          <button onClick={() => setScreen("cart")} className="relative flex flex-col items-center gap-0.5 w-16 py-1 rounded-xl hover:bg-black/[0.03]" aria-label="장바구니">
            <div className="relative">{Icon.cart("w-6 h-6")}
              {cartCount > 0 && <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: T.brand }}>{cartCount}</span>}
            </div>
            <span className="text-[11px] font-medium">장바구니</span>
          </button>
          <button onClick={() => setScreen("orders")} className="flex flex-col items-center gap-0.5 w-16 py-1 rounded-xl hover:bg-black/[0.03]">{Icon.list("w-6 h-6")}<span className="text-[11px] font-medium">주문내역</span></button>
          <button onClick={() => setScreen("settle")} className="flex flex-col items-center gap-0.5 w-16 py-1 rounded-xl hover:bg-black/[0.03]">{Icon.bell("w-6 h-6")}<span className="text-[11px] font-medium">정산</span></button>
          <button onClick={() => setScreen("docs")} className="flex flex-col items-center gap-0.5 w-16 py-1 rounded-xl hover:bg-black/[0.03]">{Icon.doc("w-6 h-6")}<span className="text-[11px] font-medium">거래명세서</span></button>
        </div>
      </div>
      <div className="px-7 pb-2.5">
        <CatChips cat={cat} setCat={setCat} mode="desktop" />
      </div>
    </header>
  );
}

function BottomTab({ screen, setScreen, cartCount }) {
  const tabs = [
    { id: "home", label: "홈", icon: Icon.home, to: "home" },
    { id: "cat", label: "카테고리", icon: Icon.grid, to: "cat" },
    { id: "cart", label: "장바구니", icon: Icon.cart, to: "cart", badge: cartCount },
    { id: "orders", label: "주문내역", icon: Icon.list, to: "orders" },
    { id: "my", label: "마이", icon: Icon.user, to: "my" },
  ];
  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 bg-white flex" style={{ borderTop: "1px solid " + T.line }}>
      {tabs.map((t) => {
        const active = (t.id === "home" && screen === "home") || (t.id === "cart" && screen === "cart") || (t.id === "cat" && screen === "cat") || (t.id === "orders" && (screen === "orders" || screen === "docs" || screen === "settle")) || (t.id === "my" && screen === "my");
        return (
          <button key={t.id} onClick={() => setScreen(t.to)} className="relative flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-3"
            style={{ color: active ? T.ink : T.ink4 }}>
            <div className="relative">{t.icon("w-6 h-6")}
              {t.badge > 0 && <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: T.brand }}>{t.badge}</span>}
            </div>
            <span className="text-[11px] font-semibold">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── 푸터 (TDS 라이트 톤) ──
function Footer({ mode }) {
  const links = ["회사소개", "이용약관", "개인정보취급방침", "책임의 한계 및 법적고지", "입점 문의", "자주 묻는 질문"];
  const legal = [
    "리스터코퍼레이션  ·  대표이사 정지원",
    "본사 : 서울특별시 강남구 남부순환로359길 14, 3층(도곡동)",
    "인천 물류센터 : 인천광역시 부평구 주부토로 236, U1센터 C동 109호",
    "고객센터 및 제휴문의 : jiwon@ur-team.com",
  ];
  const toTop = (e) => { const sc = e.currentTarget.closest("[data-scroll]"); if (sc) sc.scrollTo({ top: 0, behavior: "smooth" }); };
  const isMobile = mode === "mobile";

  const linkRow = (
    <div className={"flex flex-wrap items-center " + (isMobile ? "gap-x-4 gap-y-2 justify-center" : "gap-x-6")}>
      {links.map((l) => (
        <button key={l} className="text-[13px] whitespace-nowrap hover:underline"
          style={{ color: l === "개인정보취급방침" ? T.ink : T.ink2, fontWeight: l === "개인정보취급방침" ? 700 : 500 }}>{l}</button>
      ))}
    </div>
  );

  const support = (
    <div>
      <div className="text-[12px] font-bold mb-1" style={{ color: T.ink3 }}>고객센터</div>
      <div className="text-[24px] font-extrabold tracking-[-0.02em] tabular-nums" style={{ color: T.ink }}>0503-7151-4726</div>
      <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: T.ink3 }}>평일 09:00 – 18:00 (주말·공휴일 휴무)<br/>고객센터 및 제휴문의 : jiwon@ur-team.com</div>
    </div>
  );

  if (isMobile) {
    return (
      <footer className="pt-7 pb-24 px-5" style={{ background: T.fill2, borderTop: "1px solid " + T.line }}>
        {linkRow}
        <div className="my-5" style={{ borderTop: "1px solid " + T.line }} />
        <div className="text-center">{support}</div>
        <div className="my-5" style={{ borderTop: "1px solid " + T.line }} />
        <div className="space-y-1 text-center">
          {legal.map((t, i) => <div key={i} className="text-[11px] leading-relaxed" style={{ color: T.ink4 }}>{t}</div>)}
        </div>
        <p className="text-[11px] mt-4 text-center leading-relaxed" style={{ color: T.ink4 }}>
          리스터코퍼레이션은 통신판매중개자이며, 일부 상품은 통신판매의 당사자가 아닙니다. 검증 제조사가 공급하는 상품·거래정보 및 거래에 대한 책임은 각 공급 주체에 있습니다.
        </p>
        <p className="text-[11px] mt-2 text-center" style={{ color: T.ink4 }}>© 2026 Lister Corporation.</p>
      </footer>
    );
  }

  return (
    <footer style={{ background: T.fill2, borderTop: "1px solid " + T.line }}>
      <div className="px-7 h-14 flex items-center justify-between" style={{ borderBottom: "1px solid " + T.line }}>
        {linkRow}
        <button onClick={toTop} className="flex items-center gap-1 text-[13px] font-semibold shrink-0 whitespace-nowrap" style={{ color: T.ink2 }}>
          TOP <span style={{ color: T.brand }}>↑</span>
        </button>
      </div>
      <div className="px-7 py-7 flex gap-10">
        <div className="flex-1 min-w-0">
          <div className="mb-3"><Logo /></div>
          <div className="space-y-1">
            {legal.map((t, i) => <div key={i} className="text-[12px] leading-relaxed" style={{ color: T.ink3 }}>{t}</div>)}
          </div>
          <p className="text-[12px] mt-3 leading-relaxed max-w-[680px]" style={{ color: T.ink4 }}>
            리스터코퍼레이션은 통신판매중개자이며, 일부 상품은 통신판매의 당사자가 아닙니다. 검증 제조사가 공급하는 상품·거래정보 및 거래에 대한 책임은 각 공급 주체에 있습니다.
          </p>
          <p className="text-[12px] mt-2" style={{ color: T.ink4 }}>© 2026 Lister Corporation. All Rights Reserved.</p>
        </div>
        <div className="shrink-0 pl-10" style={{ borderLeft: "1px solid " + T.line }}>{support}</div>
        <div className="shrink-0">
          <button className="flex flex-col items-start justify-between w-[150px] h-full rounded-2xl p-4 text-left" style={{ background: "#fff", border: "1px solid " + T.line }}>
            <span className="text-[15px] font-extrabold leading-tight" style={{ color: T.ink }}>제조회원<br/>센터</span>
            <span className="text-[12px] font-semibold mt-3 flex items-center gap-0.5" style={{ color: T.brand }}>바로가기 →</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

function StoreApp({ mode, store }) {
  const { screen, setScreen, cat, setCat, cardVariant, cart, addItem, setItemQty, removeItem,
    current, openDetail, cartCount, toast, detailQty, setDetailQty, placeOrder, clearCart } = store;
  const [gradeOpen, setGradeOpen] = useState(false);
  const [sheet, setSheet] = useState(null);          // 'search' | 'match' | 'oem'
  const [complete, setComplete] = useState(null);    // 주문완료 order
  const doCartOrder = () => { if (!cart.length) return; const o = placeOrder(cart); clearCart(); setComplete(o); };
  const doBuyNow = () => { const o = placeOrder([{ id: current.id, qty: detailQty }]); setComplete(o); };

  return (
    <div className="relative h-full flex flex-col bg-white overflow-hidden" style={{ fontFamily: "Pretendard, sans-serif", color: T.ink }}>
      <Header mode={mode} cartCount={cartCount} setScreen={setScreen} onGrade={() => setGradeOpen(true)} cat={cat} setCat={setCat} onSearch={() => setSheet("search")} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]" data-scroll>
        {screen === "home" && <HomeScreen mode={mode} cat={cat} setCat={setCat} cardVariant={cardVariant} onAdd={addItem} onOpen={openDetail} onGrade={() => setGradeOpen(true)} onOem={() => setSheet("oem")} />}
        {screen === "detail" && <DetailScreen mode={mode} product={current} qty={detailQty} setQty={setDetailQty} onAdd={addItem} onOpen={openDetail} onBack={() => setScreen("home")} onBuy={doBuyNow} />}
        {screen === "cart" && <CartScreen mode={mode} cart={cart} setItemQty={setItemQty} removeItem={removeItem} onOpen={openDetail} goHome={() => setScreen("home")} onOrder={doCartOrder} />}
        {screen === "orders" && <OrdersScreen mode={mode} onOpen={openDetail} onAdd={addItem} />}
        {screen === "settle" && <SettlementScreen mode={mode} />}
        {screen === "docs" && <DocsScreen mode={mode} />}
        {screen === "cat" && <CategoryScreen mode={mode} setCat={setCat} goHome={() => setScreen("home")} />}
        {screen === "my" && <MyScreen mode={mode} setScreen={setScreen} onGrade={() => setGradeOpen(true)} openSheet={setSheet} />}
        {(mode === "desktop" ? screen !== "detail" && screen !== "cart" : screen === "home") && <Footer mode={mode} />}
      </div>

      {/* 하단 영역: 화면별 */}
      {mode === "mobile" && ["home", "cat", "my", "orders", "settle", "docs"].includes(screen) && <BottomTab screen={screen} setScreen={setScreen} cartCount={cartCount} />}
      {mode === "mobile" && screen === "detail" && <DetailActionBar p={current} qty={detailQty} setQty={setDetailQty} onAdd={addItem} onBuy={doBuyNow} />}
      {mode === "mobile" && screen === "cart" && <CartActionBar cart={cart} onOrder={doCartOrder} />}

      <GradeSheet open={gradeOpen} onClose={() => setGradeOpen(false)} onMatch={() => setSheet("match")} />
      <SearchSheet open={sheet === "search"} onClose={() => setSheet(null)} onOpen={openDetail} />
      <MatchSheet open={sheet === "match"} onClose={() => setSheet(null)} />
      <OemSheet open={sheet === "oem"} onClose={() => setSheet(null)} />
      <OrderComplete order={complete} onClose={() => setComplete(null)} onOrders={() => { setComplete(null); setScreen("orders"); }} />

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-[60] rounded-2xl text-white text-[14px] font-bold px-5 py-3 flex items-center gap-2 whitespace-nowrap" style={{ background: T.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {Icon.check("w-5 h-5")} 장바구니에 담았어요
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Logo, GradeSheet, Header, BottomTab, StoreApp });
