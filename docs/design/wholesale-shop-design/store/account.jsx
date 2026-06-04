// ──────────────────────────────────────────────────────────────
// 계정/운영 화면 — 주문내역(송장) · 정산 · 자료발행 · 반품/교환
// ──────────────────────────────────────────────────────────────

function ScreenTitle({ title, sub }) {
  return (
    <div className="mb-4">
      <h1 className="text-[22px] font-extrabold tracking-[-0.01em]" style={{ color: T.ink }}>{title}</h1>
      {sub && <p className="text-[14px] mt-1" style={{ color: T.ink3 }}>{sub}</p>}
    </div>
  );
}

function StatusPill({ status }) {
  const s = ORDER_STATUS[status] || ORDER_STATUS["결제완료"];
  return <span className="rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap" style={{ color: s.c, background: s.bg }}>{status}</span>;
}

// 송장번호 표시 + 복사
function TrackRow({ carrier, track }) {
  const [copied, setCopied] = useState(false);
  const fmt = track.replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <div className="flex items-center justify-between rounded-xl px-3.5 h-12 whitespace-nowrap" style={{ background: T.fill2 }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold shrink-0" style={{ color: T.ink2 }}>{carrier}</span>
        <span className="text-[14px] font-bold tabular-nums truncate" style={{ color: T.ink }}>{fmt}</span>
      </div>
      <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        className="text-[12px] font-bold shrink-0 ml-2" style={{ color: copied ? T.pos : T.brand }}>
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}

// ── 주문내역 ──
function OrdersScreen({ mode, onOpen, onAdd }) {
  const isMobile = mode === "mobile";
  const [filter, setFilter] = useState("전체");
  const [ret, setRet] = useState(null);
  const filters = ["전체", "출고준비", "배송중", "배송완료"];
  const list = ORDERS.filter((o) => filter === "전체" || o.status === filter);

  return (
    <div className="min-h-full" style={{ background: T.fill, color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-24" : "pb-10")}>
        <ScreenTitle title="주문내역" sub="주문 상태와 송장번호를 확인하세요" />
        <div className="flex gap-2 mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="shrink-0 rounded-full px-4 h-9 text-[13px] font-semibold whitespace-nowrap"
              style={filter === f ? { background: T.ink, color: "#fff" } : { background: "#fff", color: T.ink2, border: "1px solid " + T.line }}>{f}</button>
          ))}
        </div>

        <div className="space-y-3">
          {list.map((o) => {
            const total = orderTotal(o);
            const first = byId(o.items[0].id);
            const more = o.items.length - 1;
            return (
              <div key={o.no} className="rounded-2xl bg-white p-4" style={{ boxShadow: T.shSoft }}>
                <div className="flex items-center justify-between whitespace-nowrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: T.ink }}>{o.no}</span>
                    <span className="text-[12px]" style={{ color: T.ink4 }}>{o.date}</span>
                  </div>
                  <StatusPill status={o.status} />
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => onOpen(first)} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden" style={{ border: "1px solid " + T.line }}>
                    <Placeholder p={first} className="w-full h-full" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => onOpen(first)} className="block text-left text-[14px] font-medium line-clamp-1" style={{ color: T.ink }}>{first.name}</button>
                    {more > 0 && <div className="text-[13px] mt-0.5" style={{ color: T.ink3 }}>외 {more}건</div>}
                    <div className="mt-1 text-[13px]" style={{ color: T.ink2 }}>
                      <span style={{ color: T.ink4 }}>결제</span> <span className="font-bold tabular-nums" style={{ color: T.ink }}>{won(total)}</span>
                      <span className="mx-1.5" style={{ color: T.line }}>·</span><span style={{ color: T.ink3 }}>{o.settle}</span>
                    </div>
                  </div>
                </div>
                {o.track && <div className="mt-3"><TrackRow carrier={o.carrier} track={o.track} /></div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => o.items.forEach((it) => onAdd(byId(it.id), it.q))}
                    className="flex-1 h-10 rounded-xl text-[13px] font-bold" style={{ background: T.brandSoft, color: T.brand }}>재주문</button>
                  <button onClick={() => setRet(o)} className="flex-1 h-10 rounded-xl text-[13px] font-bold" style={{ background: T.fill, color: T.ink2 }}>반품·교환</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ReturnSheet order={ret} onClose={() => setRet(null)} />
    </div>
  );
}

// ── 반품·교환 신청 (바텀시트) ──
function ReturnSheet({ order, onClose }) {
  const [kind, setKind] = useState("반품");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { if (order) { setKind("반품"); setReason(""); setDone(false); } }, [order]);
  if (!order) return null;
  const reasons = ["단순 변심", "파손·불량", "오배송", "수량 부족"];
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/35" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-t-3xl bg-white p-5 pb-7" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: T.line }} />
        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: T.posBg, color: T.pos }}>{Icon.check("w-6 h-6")}</div>
            <div className="text-[17px] font-bold" style={{ color: T.ink }}>{kind} 신청이 접수됐어요</div>
            <div className="text-[14px] mt-1.5" style={{ color: T.ink3 }}>검토 후 영업일 기준 1~2일 내 안내드려요</div>
            <button onClick={onClose} className="mt-5 w-full h-13 py-4 rounded-2xl text-[15px] font-bold text-white" style={{ background: T.ink }}>확인</button>
          </div>
        ) : (
          <>
            <h3 className="text-[20px] font-extrabold" style={{ color: T.ink }}>반품·교환 신청</h3>
            <p className="text-[13px] mt-1 mb-4 tabular-nums" style={{ color: T.ink3 }}>{order.no} · {order.date}</p>
            <div className="flex gap-2 mb-4">
              {["반품", "교환"].map((k) => (
                <button key={k} onClick={() => setKind(k)} className="flex-1 h-11 rounded-xl text-[14px] font-bold"
                  style={kind === k ? { background: T.ink, color: "#fff" } : { background: T.fill, color: T.ink2 }}>{k}</button>
              ))}
            </div>
            <div className="text-[13px] font-bold mb-2" style={{ color: T.ink2 }}>사유</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {reasons.map((r) => (
                <button key={r} onClick={() => setReason(r)} className="h-11 rounded-xl text-[13px] font-semibold"
                  style={reason === r ? { background: T.brandSoft, color: T.brand, border: "1px solid " + T.brand } : { background: "#fff", color: T.ink2, border: "1px solid " + T.line }}>{r}</button>
              ))}
            </div>
            <div className="rounded-xl h-20 flex items-center justify-center text-[13px] mb-4" style={{ background: T.fill2, color: T.ink4, border: "1px dashed " + T.line }}>+ 사진 첨부 (불량·파손 시)</div>
            <button disabled={!reason} onClick={() => setDone(true)}
              className="w-full h-14 rounded-2xl text-[16px] font-bold text-white transition-opacity"
              style={{ background: T.brand, opacity: reason ? 1 : 0.4 }}>신청하기</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 정산 ──
function SettlementScreen({ mode }) {
  const isMobile = mode === "mobile";
  const planned = SETTLEMENTS.filter((s) => s.status === "예정").reduce((a, b) => a + b.amount, 0);
  const doneSum = SETTLEMENTS.filter((s) => s.status === "완료").reduce((a, b) => a + b.amount, 0);
  return (
    <div className="min-h-full" style={{ background: T.fill, color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-24" : "pb-10")}>
        <ScreenTitle title="정산" sub="브랜드 상품은 당일·익일, 일반 상품은 7·15일·월마감 정산돼요" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-white p-4" style={{ boxShadow: T.shSoft }}>
            <div className="text-[13px]" style={{ color: T.ink3 }}>정산 예정</div>
            <div className="text-[22px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: T.brand }}>{won(planned)}</div>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ boxShadow: T.shSoft }}>
            <div className="text-[13px]" style={{ color: T.ink3 }}>이번달 정산 완료</div>
            <div className="text-[22px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: T.ink }}>{won(doneSum)}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: T.shSoft }}>
          {SETTLEMENTS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 whitespace-nowrap" style={i ? { borderTop: "1px solid " + T.line } : {}}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold tabular-nums truncate" style={{ color: T.ink }}>{s.ref}</span>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-bold shrink-0" style={s.brand ? { background: T.brandSoft, color: T.brand } : { background: T.fill, color: T.ink3 }}>{s.type}</span>
                </div>
                <div className="text-[12px] mt-0.5 tabular-nums" style={{ color: T.ink4 }}>{s.date} 정산</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-extrabold tabular-nums" style={{ color: T.ink }}>{won(s.amount)}</div>
                <div className="text-[12px] font-bold" style={{ color: s.status === "완료" ? T.pos : T.ink3 }}>{s.status === "완료" ? "입금 완료" : "입금 예정"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 자료 발행 ──
function DocsScreen({ mode }) {
  const isMobile = mode === "mobile";
  const [tab, setTab] = useState("거래명세서");
  const list = DOCS.filter((d) => d.type === tab);
  return (
    <div className="min-h-full" style={{ background: T.fill, color: T.ink }}>
      <div className={(isMobile ? "px-5" : "px-7") + " pt-4 " + (isMobile ? "pb-24" : "pb-10")}>
        <ScreenTitle title="자료 발행" sub="거래명세서·세금계산서를 다운로드하세요" />
        <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid " + T.line }}>
          {["거래명세서", "세금계산서"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className="px-3.5 py-2.5 text-[15px] font-bold -mb-px whitespace-nowrap"
              style={tab === t ? { color: T.ink, borderBottom: "2px solid " + T.ink } : { color: T.ink4, borderBottom: "2px solid transparent" }}>{t}</button>
          ))}
        </div>
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: T.shSoft }}>
          {list.map((d, i) => (
            <div key={d.no} className="flex items-center gap-3 px-4 py-3.5 whitespace-nowrap" style={i ? { borderTop: "1px solid " + T.line } : {}}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: T.fill, color: T.ink3 }}>{Icon.doc("w-5 h-5")}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold tabular-nums truncate" style={{ color: T.ink }}>{d.no}</div>
                <div className="text-[12px] mt-0.5 tabular-nums" style={{ color: T.ink4 }}>{d.date} · {won(d.amount)}</div>
              </div>
              <button className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 h-9 text-[13px] font-bold" style={{ background: T.fill, color: T.ink2 }}>
                {Icon.doc("w-4 h-4")} PDF
              </button>
            </div>
          ))}
        </div>
        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: T.ink4 }}>세금계산서는 유통스타트가 공급내역 기준으로 발행/대행해요. 공급사 정보는 노출되지 않습니다.</p>
      </div>
    </div>
  );
}

Object.assign(window, { OrdersScreen, SettlementScreen, DocsScreen, ReturnSheet, ScreenTitle, StatusPill });
