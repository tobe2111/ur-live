// ──────────────────────────────────────────────────────────────
// TDS(Toss Design System) 기반 공통 프리미티브
// 절제 · 여백 · 강한 위계 · 큰 라운드
// ──────────────────────────────────────────────────────────────
const { useState, useEffect, useRef } = React;

// ── 토큰 (고급화: 무채색 베이스 + 빨강 1포인트 + 그림자) ──
const T = {
  ink:  "#17181C",   // 근블랙 (텍스트/주요 면)
  ink2: "#4E5560",   // 보조 텍스트
  ink3: "#8A929E",   // 캡션
  ink4: "#B6BCC4",   // 흐린 텍스트
  line: "#ECEEF1",   // 라인 (최소 사용)
  fill: "#F4F5F7",   // 섹션 배경
  fill2:"#F8F9FB",   // 카드 내부 면
  brand:"#FF0033",   // 액센트 — 주 CTA/활성/핵심 단가에만
  brandSoft:"#FFF0F2",
  brandBg:"#FFF0F2",
  pos:  "#11875A",   // 마진/이득
  posBg:"#EAF6EF",
  // 그림자 (보더 대신 면 분리)
  shCard: "0 1px 2px rgba(20,22,28,0.04), 0 12px 28px -16px rgba(20,22,28,0.14)",
  shSoft: "0 1px 3px rgba(20,22,28,0.06)",
  shUp:   "0 -8px 24px -16px rgba(20,22,28,0.18)",
};
const RED = T.brand;

// ── 상품 이미지 (목업 베이킹 / 실제 사진으로 교체 가능) ──
function Placeholder({ p, className = "", big = false }) {
  const src = (window.MOCK && window.MOCK["prod-" + p.id]) || "";
  return (
    <img src={src} alt={CAT_LABEL[p.cat]} draggable="false"
      className={"block w-full h-full object-cover " + className}
      style={{ background: "#F1F2F4" }} />
  );
}

// ── 상품 코너 배지 (무채색 다크 필 — 사진 위에서 정제되게) ──
function CornerBadge({ p }) {
  const dark = "px-2 py-[3px] text-[11px] font-bold leading-none rounded-full whitespace-nowrap text-white";
  const darkStyle = { background: "rgba(23,24,28,0.82)", backdropFilter: "blur(4px)" };
  if (p.badge === "deal")  return <span className={dark} style={darkStyle}>특가</span>;
  if (p.badge === "best")  return <span className={dark} style={darkStyle}>BEST</span>;
  if (p.badge === "new")   return <span className={dark} style={darkStyle}>NEW</span>;
  if (p.badge === "low")   return <span className={dark} style={darkStyle}>마감임박</span>;
  if (p.badge === "discount") return <span className={dark} style={darkStyle}>-{discountRate(p.supply, p.retail)}%</span>;
  return null;
}

// ── 등급 칩 ──
function GradeChip({ grade = ME.grade, size = "sm" }) {
  const pad = size === "sm" ? "px-2 py-[2px] text-[12px]" : "px-2.5 py-0.5 text-[13px]";
  return (
    <span className={"inline-flex items-center font-bold rounded-full whitespace-nowrap " + pad}
      style={{ color: T.brand, background: T.brandSoft }}>
      {grade}등급가
    </span>
  );
}

// ── 수량 스텝퍼 (TDS pill 스타일) ──
function Stepper({ value, onChange, step = 1, min = 1, size = "md" }) {
  const h = size === "sm" ? "h-9" : "h-11";
  const w = size === "sm" ? "w-9" : "w-11";
  const btn =
    "flex items-center justify-center select-none text-[20px] leading-none font-medium transition-colors disabled:opacity-30 " +
    h + " " + w;
  return (
    <div className={"inline-flex items-center rounded-full " + h} style={{ background: T.fill }}>
      <button className={btn} style={{ color: T.ink2 }} onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min} aria-label="수량 감소">−</button>
      <input
        className="w-10 text-center text-[15px] font-bold tabular-nums bg-transparent outline-none"
        style={{ color: T.ink }} value={comma(value)} readOnly aria-label="수량" />
      <button className={btn} style={{ color: T.ink2 }} onClick={() => onChange(value + step)} aria-label="수량 증가">+</button>
    </div>
  );
}

// ── 카운트다운 (특가 임박) ──
function Countdown({ dday = "D-1", className = "" }) {
  const [t, setT] = useState(() => {
    const end = new Date(); end.setHours(23, 59, 59, 0);
    if (dday === "D-2") end.setDate(end.getDate() + 1);
    return Math.max(0, Math.floor((end - new Date()) / 1000));
  });
  useEffect(() => {
    const id = setInterval(() => setT((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(Math.floor(t / 3600)).padStart(2, "0");
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return (
    <span className={"inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums whitespace-nowrap " + className}
      style={{ color: T.brand }}>
      <span>{dday}</span>
      <span className="tabular-nums" style={{ color: T.ink2 }}>{hh}:{mm}:{ss} 남음</span>
    </span>
  );
}

// ── 버튼 (TDS) ──
function Button({ children, variant = "primary", size = "md", full, onClick, className = "", ...rest }) {
  const sizes = { lg: "h-14 text-[17px] rounded-2xl", md: "h-12 text-[15px] rounded-xl", sm: "h-10 text-[14px] rounded-xl" };
  const styleMap = {
    primary:  { background: T.brand, color: "#fff" },
    dark:     { background: T.ink, color: "#fff" },
    soft:     { background: T.brandBg, color: T.brand },
    neutral:  { background: T.fill, color: T.ink },
    outline:  { background: "#fff", color: T.ink, border: "1px solid " + T.line },
  };
  return (
    <button onClick={onClick}
      className={"inline-flex items-center justify-center gap-1.5 font-bold transition-[filter,background] active:brightness-95 whitespace-nowrap " + sizes[size] + (full ? " w-full" : "") + " " + className}
      style={styleMap[variant]} {...rest}>
      {children}
    </button>
  );
}

// ── 아이콘 (얇은 stroke, TDS 톤) ──
const Icon = {
  search: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>),
  cart: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.2 11.5a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 7.5H6.2" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" /></svg>),
  doc: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></svg>),
  list: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>),
  home: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></svg>),
  grid: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg>),
  user: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /></svg>),
  chevron: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>),
  back: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>),
  trash: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>),
  upload: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></svg>),
  check: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>),
  plus: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>),
  bell: (c = "") => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>),
};

Object.assign(window, { T, RED, Placeholder, CornerBadge, GradeChip, Stepper, Countdown, Button, Icon });
