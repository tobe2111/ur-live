// ──────────────────────────────────────────────────────────────
// 홈 — B2B 도매 (사입 대시보드 · 빠른 재주문 · 정제된 섹션)
// ──────────────────────────────────────────────────────────────

function Gap() { return <div className="h-2.5" style={{ background: T.fill }} />; }

function SectionHead({ title, sub, onMore }) {
  return (
    <div className="flex items-center justify-between mb-3.5 whitespace-nowrap">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[18px] font-extrabold tracking-[-0.01em]" style={{ color: T.ink }}>{title}</h3>
        {sub && <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: T.ink3 }}>{sub}</span>}
      </div>
      <button onClick={onMore} className="flex items-center gap-0.5 text-[13px] font-medium shrink-0" style={{ color: T.ink3 }}>
        전체 {Icon.chevron("w-4 h-4")}
      </button>
    </div>
  );
}

function Rail({ children }) {
  return <div className="flex gap-3.5 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>;
}

function CatChips({ cat, setCat, mode }) {
  return (
    <div className={"flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden " + (mode === "mobile" ? "px-5 py-3" : "")}>
      {CATEGORIES.map((c) => {
        const on = cat === c.id;
        return (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="shrink-0 rounded-full px-4 h-9 text-[14px] font-semibold transition-colors whitespace-nowrap"
            style={on ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink2 }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 사입 현황 대시보드 ──
function Dashboard({ mode, onGrade }) {
  const d = DASHBOARD;
  const progress = Math.min(100, Math.round((1 - d.nextGrade / 15000000) * 100));
  const metrics = [
    { k: "이번달 사입액", v: won(d.monthSpend) },
    { k: "정산 예정 (7일)", v: won(d.settleSoon) },
    { k: "미정산", v: won(d.unsettled) },
  ];
  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: T.shCard }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-extrabold text-white shrink-0" style={{ background: T.brand }}>{ME.grade}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate" style={{ color: T.ink }}>{ME.company} · <span style={{ color: T.brand }}>{ME.grade}등급</span> 단가 적용중</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: T.ink3 }}>모든 단가는 회원님 등급 기준 공급가예요</div>
        </div>
        <button onClick={onGrade} className="text-[13px] font-semibold shrink-0 flex items-center gap-0.5 whitespace-nowrap" style={{ color: T.ink2 }}>등급 {Icon.chevron("w-4 h-4")}</button>
      </div>

      <div className="mt-4 rounded-xl p-3.5" style={{ background: T.fill2 }}>
        <div className="flex items-center justify-between text-[12px] mb-2 whitespace-nowrap">
          <span style={{ color: T.ink2 }}>B등급 승급까지</span>
          <span className="font-bold tabular-nums" style={{ color: T.ink }}>+{won(DASHBOARD.nextGrade)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: T.line }}>
          <div className="h-full rounded-full" style={{ width: progress + "%", background: T.brand }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <div key={m.k} className={"px-1 " + (i ? "pl-3" : "")} style={i ? { borderLeft: "1px solid " + T.line } : {}}>
            <div className="text-[12px] whitespace-nowrap" style={{ color: T.ink3 }}>{m.k}</div>
            <div className="text-[15px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: T.ink }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 빠른 재주문 항목 ──
function ReorderItem({ r, onOpen, onAdd }) {
  const p = byId(r.id);
  const [done, setDone] = useState(false);
  return (
    <div className="shrink-0 w-[230px] flex flex-col rounded-2xl bg-white p-3 snap-start" style={{ border: "1px solid " + T.line, boxShadow: T.shSoft }}>
      <div className="flex gap-3">
        <button onClick={() => onOpen(p)} className="w-12 h-12 shrink-0 rounded-xl overflow-hidden" style={{ border: "1px solid " + T.line }}>
          <Placeholder p={p} className="w-full h-full" />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onOpen(p)} className="block text-left text-[13px] font-medium line-clamp-1" style={{ color: T.ink }}>{p.name}</button>
          <div className="text-[12px] mt-0.5 tabular-nums" style={{ color: T.ink3 }}>{r.date} 사입 · {r.box}개</div>
        </div>
      </div>
      <button onClick={() => { onAdd(p, r.box); setDone(true); setTimeout(() => setDone(false), 1000); }}
        className="mt-2.5 h-9 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
        style={done ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink }}>
        {done ? <>{Icon.check("w-4 h-4")} 담음</> : <>같은 수량 재주문</>}
      </button>
    </div>
  );
}

// 서비스 정체성 히어로 (메인 최상단 — 다크 스테이트먼트)
function BrandHero({ mode }) {
  const isMobile = mode === "mobile";
  const props = ["검증 제조사 직공급", "내 등급 전용 공급가", "익일·7일 정산"];
  return (
    <div className={"rounded-2xl overflow-hidden " + (isMobile ? "p-5" : "p-7")} style={{ background: T.ink, color: "#fff" }}>
      <div className="flex items-center gap-1.5 mb-2.5 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.brand }} />
        <span className="text-[12px] font-bold" style={{ color: "#C2C7CE" }}>유통스타트 도매몰 · 제조사–유통사 B2B 플랫폼</span>
      </div>
      <h2 className={"font-extrabold tracking-[-0.02em] leading-[1.28] " + (isMobile ? "text-[21px]" : "text-[28px]")}>
        검증된 제조사 상품을<br />
        <span style={{ color: "#FF4D66" }}>내 등급 공급가</span>로 사입하세요
      </h2>
      <p className={"mt-2.5 leading-relaxed " + (isMobile ? "text-[13px]" : "text-[14px]")} style={{ color: "#A7AEB6" }}>
        공급사는 숨기고 가격은 투명하게 — 대량 사입에 최적화된 도매 전용 가격.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {props.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap" style={{ background: "rgba(255,255,255,0.09)", color: "#E5E8EB" }}>
            <span style={{ color: "#37D699" }}>{Icon.check("w-3.5 h-3.5")}</span>{t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────────── 홈 ─────────────
function HomeScreen({ mode, cat, setCat, cardVariant, onAdd, onOpen, onGrade, onOem }) {
  const [sort, setSort] = useState("rec");
  const [dealOnly, setDealOnly] = useState(false);
  let list = PRODUCTS.filter((p) => (cat === "all" || p.cat === cat) && (!dealOnly || p.badge === "deal" || p.badge === "discount"));
  list = [...list].sort((a, b) =>
    sort === "low" ? a.supply - b.supply :
    sort === "margin" ? marginRate(b.supply, b.retail) - marginRate(a.supply, a.retail) :
    b.sold - a.sold);
  const SORTS = [["rec", "인기순"], ["low", "낮은 공급가"], ["margin", "높은 마진"]];
  const isMobile = mode === "mobile";
  const cols = isMobile ? "grid-cols-2" : "grid-cols-4";
  const px = isMobile ? "px-5" : "px-7";
  const railW = isMobile ? "w-[152px]" : "w-[166px]";

  return (
    <div className="min-h-full" style={{ color: T.ink, background: "#fff" }}>
      {isMobile && (
        <div className="bg-white sticky top-[56px] z-20" style={{ borderBottom: "1px solid " + T.line }}>
          <CatChips cat={cat} setCat={setCat} mode={mode} />
        </div>
      )}

      <div className={"pt-4 pb-5 space-y-3 " + px}>
        <BrandHero mode={mode} />
        <Dashboard mode={mode} onGrade={onGrade} />
        <button onClick={onOem} className="w-full flex items-center gap-3.5 rounded-2xl p-4 text-left" style={{ border: "1px solid " + T.line, background: "#fff" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px] shrink-0" style={{ background: T.fill }}>🏭</span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold truncate" style={{ color: T.ink }}>자사 브랜드 제품이 필요하세요?</div>
            <div className="text-[12px] mt-0.5 truncate" style={{ color: T.ink3 }}>OEM/ODM 제조사 연결·컨설팅 신청</div>
          </div>
          {Icon.chevron("w-5 h-5 shrink-0")}
        </button>
      </div>

      <Gap />
      <section className={"py-6 " + px}>
        <SectionHead title="빠른 재주문" sub="최근 사입한 상품" />
        <Rail>{REORDER.map((r) => <ReorderItem key={r.id} r={r} onOpen={onOpen} onAdd={onAdd} />)}</Rail>
      </section>

      <Gap />
      <section className={"py-6 " + px}>
        <SectionHead title="마감 임박 단가" sub="재고 소진 시 종료" />
        <Rail>{SECTION.deal.map((id) => <MiniCard key={id} p={byId(id)} onAdd={onAdd} onOpen={onOpen} w={railW} />)}</Rail>
      </section>

      <Gap />
      <section className={"py-6 " + px}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[18px] font-extrabold tracking-[-0.01em]" style={{ color: T.ink }}>회원님 전용 공급</h3>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: T.ink, color: "#fff" }}>선정 회원 전용</span>
        </div>
        <p className="text-[13px] mb-3.5" style={{ color: T.ink3 }}>유통스타트가 한빛유통님께만 공개하는 상품이에요</p>
        <Rail>{SECTION.excl.map((id) => <MiniCard key={id} p={byId(id)} onAdd={onAdd} onOpen={onOpen} w={railW} tag="전용" />)}</Rail>
      </section>

      <Gap />
      <section className={"py-6 " + px}>
        <SectionHead title="신규 입고" sub="이번 주" />
        <Rail>{SECTION.fresh.map((id) => <MiniCard key={id} p={byId(id)} onAdd={onAdd} onOpen={onOpen} w={railW} />)}</Rail>
      </section>

      <Gap />
      <section className={"pt-6 pb-8 " + px}>
        <SectionHead title={cat === "all" ? "전체 상품" : CAT_LABEL[cat]} sub={comma(list.length) + "개"} />
        <div className="flex items-center justify-between gap-2 mb-3 whitespace-nowrap">
          <div className="flex gap-1.5">
            {SORTS.map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)} className="rounded-full px-3 h-8 text-[12px] font-bold"
                style={sort === k ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink3 }}>{l}</button>
            ))}
          </div>
          <button onClick={() => setDealOnly((v) => !v)} className="flex items-center gap-1 text-[12px] font-bold shrink-0" style={{ color: dealOnly ? T.brand : T.ink3 }}>
            <span className="flex h-4 w-4 items-center justify-center rounded" style={dealOnly ? { background: T.brand, color: "#fff" } : { border: "1.5px solid " + T.ink4 }}>{dealOnly ? "✓" : ""}</span>
            특가만
          </button>
        </div>
        <button className="mb-4 w-full flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: T.fill, color: T.ink2 }}>
          {Icon.doc("w-4 h-4")} 단가표 엑셀 다운로드 <span style={{ color: T.ink4 }}>(C·A·B 등급)</span>
        </button>
        <div className={isMobile ? "" : "flex gap-7"}>
          {!isMobile && <Sidebar cat={cat} setCat={setCat} />}
          <div className={"grid gap-x-5 gap-y-7 flex-1 " + cols}>
            {list.map((p) => <ProductCard key={p.id} variant={cardVariant} p={p} onAdd={onAdd} onOpen={onOpen} />)}
          </div>
        </div>
        <div className="mt-8 text-center">
          <button className="rounded-xl px-7 h-12 text-[14px] font-bold" style={{ background: T.fill, color: T.ink2 }}>상품 더 보기</button>
        </div>
      </section>
    </div>
  );
}

function Sidebar({ cat, setCat }) {
  return (
    <aside className="w-[176px] shrink-0">
      <div className="text-[13px] font-bold mb-2 px-1" style={{ color: T.ink3 }}>카테고리</div>
      <ul className="space-y-0.5">
        {CATEGORIES.map((c) => {
          const on = cat === c.id;
          const count = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.id).length;
          return (
            <li key={c.id}>
              <button onClick={() => setCat(c.id)}
                className="w-full flex items-center justify-between rounded-xl px-3.5 h-11 text-[15px] transition-colors"
                style={on ? { background: T.brandSoft, color: T.brand, fontWeight: 700 } : { color: T.ink2 }}>
                <span>{c.label}</span><span className="text-[13px] tabular-nums" style={{ color: on ? T.brand : T.ink4 }}>{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

Object.assign(window, { HomeScreen, SectionHead, Rail, CatChips, Sidebar, Gap, Dashboard });
