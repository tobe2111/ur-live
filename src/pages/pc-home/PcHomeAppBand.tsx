/**
 * 🖥️ 2026-07-16 (대표 시안 — 당근급 앱 다운로드 배너): 리치 다크 배너 + 스토어 배지 +
 *   유어딜 앱 화면이 떠 있는 폰 목업 2개(딜 피드 + 딜 상세). PC 홈 하단.
 *   딥다크 확정(당근처럼) — 라이트/다크 앱 양쪽에서 동일하게 어두운 배너.
 */

const dealFeed = [
  { m: 'SB', c: '#0b6b3a', t: '스타벅스 아메리카노 2잔', loc: '역삼동 · 방금', price: '6,200원', like: 214 },
  { m: 'BR', c: '#8b1e2d', t: '연남 브런치 2인 세트', loc: '연남동 · 12분', price: '23,200원', like: 88 },
  { m: 'HA', c: '#5567d6', t: '프리미엄 헤어컷 + 클리닉', loc: '서초동 · 28분', price: '19,500원', like: 41 },
]

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7 1.9-1.1 2.6-2.1c.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.4-3.9zM14.3 6.4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"/>
    </svg>
  )
}
function PlayLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3.5v17c0 .6.6 1 1.1.7L20 12.6c.5-.3.5-1 0-1.3L5.1 2.8C4.6 2.5 4 2.9 4 3.5z" fill="#fff"/>
      <path d="M4 3.5v17c0 .3.1.5.4.6l9-9-9-9c-.3.1-.4.4-.4.6z" fill="#34d399"/>
      <path d="M15.4 8 4.4 2.9 13.5 12l1.9-4z" fill="#fbbf24" opacity="0"/>
    </svg>
  )
}

function StoreBadge({ logo, top, big }: { logo: 'apple' | 'play'; top: string; big: string }) {
  return (
    <a
      href="#"
      className="flex items-center gap-2.5 pl-3.5 pr-5 h-[52px] rounded-2xl bg-black text-white border border-white/15 hover:border-white/30 transition-colors"
    >
      <span className="shrink-0">{logo === 'apple' ? <AppleLogo /> : <PlayLogo />}</span>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] text-white/70 mb-0.5">{top}</span>
        <span className="text-[16px] font-bold tracking-tight">{big}</span>
      </span>
    </a>
  )
}

/* ── 폰 목업 ── */
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-1">
      <span className="text-[10px] font-bold text-gray-900">9:41</span>
      <span className="flex items-center gap-1 text-gray-900">
        <svg width="15" height="10" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1" width="3" height="11" rx="1" opacity=".5"/></svg>
        <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.5c2.2 0 4.2.8 5.7 2.2l1.1-1.2A10 10 0 0 0 8 .8 10 10 0 0 0 1.2 3.5l1.1 1.2A8 8 0 0 1 8 2.5z"/><path d="M8 6c1.2 0 2.3.5 3.1 1.2l1.1-1.2A6 6 0 0 0 8 4.3 6 6 0 0 0 3.8 6l1.1 1.2A4.4 4.4 0 0 1 8 6z"/><circle cx="8" cy="9.5" r="1.4"/></svg>
        <svg width="20" height="10" viewBox="0 0 24 12" fill="none"><rect x="1" y="1.5" width="19" height="9" rx="2.5" stroke="currentColor" strokeOpacity=".5"/><rect x="2.5" y="3" width="14" height="6" rx="1.2" fill="currentColor"/><rect x="21" y="4" width="1.6" height="4" rx="1" fill="currentColor" fillOpacity=".5"/></svg>
      </span>
    </div>
  )
}

function PhoneFeed() {
  return (
    <div className="w-[236px] shrink-0 rounded-[34px] bg-[#0c0c0e] p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
      <div className="relative rounded-[26px] overflow-hidden bg-white">
        {/* notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-black/80 z-10" />
        <StatusBar />
        {/* header */}
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="text-[14px] font-extrabold text-gray-900 flex items-center gap-0.5">역삼동
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <span className="flex items-center gap-2.5 text-gray-700">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
          </span>
        </div>
        {/* chips */}
        <div className="flex gap-1.5 px-4 pb-2">
          {['전체', '카페', '식사', '미용'].map((c, i) => (
            <span key={c} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${i === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>{c}</span>
          ))}
        </div>
        {/* feed */}
        <div className="px-3 pb-3">
          {dealFeed.map((d) => (
            <div key={d.m} className="flex gap-2.5 py-2 border-t border-gray-100 first:border-t-0">
              <div className="w-14 h-14 shrink-0 rounded-xl grid place-items-center text-white text-[15px] font-black" style={{ background: `linear-gradient(140deg, ${d.c}, ${d.c}cc)` }}>{d.m}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-gray-900 leading-tight line-clamp-2">{d.t}</p>
                <p className="text-[9.5px] text-gray-400 mt-0.5">{d.loc}</p>
                <p className="text-[12.5px] font-extrabold text-gray-900 mt-0.5">{d.price}</p>
              </div>
              <span className="self-end flex items-center gap-0.5 text-[9px] text-gray-400">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>{d.like}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PhoneDetail() {
  return (
    <div className="w-[236px] shrink-0 rounded-[34px] bg-[#0c0c0e] p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
      <div className="rounded-[26px] overflow-hidden bg-white">
        {/* hero image */}
        <div className="aspect-[4/3] w-full grid place-items-center text-white text-[22px] font-black" style={{ background: 'linear-gradient(140deg,#e67e22,#a04000)' }}>NA</div>
        <div className="p-3.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500" />
            <span className="flex flex-col leading-none">
              <span className="text-[11px] font-bold text-gray-900">감성네일 강남점</span>
              <span className="text-[9px] text-gray-400 mt-0.5">역삼동</span>
            </span>
            <span className="ml-auto text-[10px] font-extrabold text-emerald-600">4.9 ★</span>
          </div>
          <p className="text-[13px] font-extrabold text-gray-900 mt-2.5 leading-snug">프라이빗 네일 아트 2시간 이용권</p>
          <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">매장에서 QR로 바로 사용하는 이용권이에요. 온라인 할인가로 미리 준비하세요~</p>
          <div className="mt-2.5 rounded-xl overflow-hidden border border-gray-100">
            <div className="h-16 w-full grid place-items-center bg-gradient-to-br from-emerald-50 to-sky-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5a0" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="2.6"/></svg>
            </div>
          </div>
        </div>
        {/* buy bar */}
        <div className="flex items-center gap-2 px-3.5 py-3 border-t border-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          <div className="flex flex-col leading-none">
            <span className="text-[9px] text-[#fb2d3f] font-bold">40%</span>
            <span className="text-[14px] font-black text-gray-900">27,000원</span>
          </div>
          <span className="ml-auto text-[12px] font-bold text-white bg-brand px-4 py-2 rounded-xl">구매하기</span>
        </div>
      </div>
    </div>
  )
}

export default function PcHomeAppBand() {
  return (
    <div className="mt-8 bg-[#241b17] relative overflow-hidden">
      {/* warm coral glow */}
      <div className="pointer-events-none absolute -right-20 -top-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(circle,#ff6a3d,transparent 70%)' }} />
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-14 flex items-center justify-between gap-10 relative">
        <div className="min-w-0">
          <h2 className="text-[30px] lg:text-[34px] font-black leading-[1.25] tracking-tight text-white">
            유어딜에서 <span className="text-[#ff8a5c]">우리 동네 딜</span>과<br />함께해요
          </h2>
          <p className="mt-3 text-[16px] font-bold text-white/70">지금 바로 다운로드하기</p>
          <div className="mt-7 flex gap-3">
            <StoreBadge logo="apple" top="Download on the" big="App Store" />
            <StoreBadge logo="play" top="GET IT ON" big="Google Play" />
          </div>
        </div>

        {/* phones */}
        <div className="hidden md:flex items-end shrink-0 pr-2">
          <div className="translate-y-6 rotate-[-4deg] z-10">
            <PhoneFeed />
          </div>
          <div className="-ml-14 rotate-[3deg] z-20">
            <PhoneDetail />
          </div>
        </div>
      </div>
    </div>
  )
}
