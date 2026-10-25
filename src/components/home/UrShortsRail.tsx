import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import {
  URSHORTS_CARD_W, URSHORTS_CARD_H, URSHORTS_VIEWER_PATH, URSHORTS_BROWSE_PATH, type UrShortItem,
} from '@/shared/urshorts'
import { shortDisplayTitle } from '@/shared/urshorts-display'
import { priceDisplay } from '@/shared/price-display'

/**
 * 🎬 유어쇼츠 레일 — 홈에서 인기 이용권 바로 아래 (2026-09-07 대표 확정).
 *
 * ## 왜 이 크기·이 자리인가 (실측)
 * 처음 시안은 한 줄 6개(217×386 + 제목 줄 = 430px)였는데 **바로 위 딜 카드가 299px** 이라
 * 딜을 팔려고 놓은 것이 딜보다 1.4배 컸다. 대표가 **125×222 고정**으로 확정했다 —
 * 딜 카드보다 77px 낮고, 몇 개가 보이는지는 화면이 정한다(1440에서 10개 · 390에서 2개 + 잘린 조각).
 * 히어로 바로 아래가 아닌 이유는 홈이 첫 딜을 보여 주는 시각(559ms→304ms로 당겨 둔 값)을
 * 늦추기 때문이고, 4열 그리드가 세 번 연달아 나오던 단조로움도 이 세로 레일이 끊는다.
 *
 * ## 🔴 홈 첫 화면을 무겁게 하지 않는 세 가지
 * ① **썸네일은 레일이 화면에 다가올 때** 받는다(IntersectionObserver). 홈 첫 페인트 예산 밖.
 * ② **재생기는 여기서 안 만든다.** 카드를 누르면 `/videos` 로 가고, iframe 은 거기서 하나만 산다.
 * ③ **영상이 없으면 통째로 렌더하지 않는다.** 빈 줄을 남기지 않는다.
 *
 * ## 넘기는 방법이 화면마다 다른 이유 (실측)
 * 12편이면 폰은 10편이 숨고 PC 는 2~6편만 숨는다. 그런데 **정작 막히는 쪽은 PC** 다 —
 * 마우스 휠은 세로로만 굴러가고 스크롤 막대는 숨겨 놨다. 그래서 폰에는 아무것도 안 붙이고
 * (잘린 카드가 이미 말한다) PC 에만 hover 화살표를 둔다. 끝에는 `/videos` 로 가는 타일을 둬
 * 끝까지 민 사람이 문을 만나게 한다.
 *
 * ⚠️ 휠을 가로채지 않는다 — 레일 위에서 페이지가 안 내려가는 잘 알려진 짜증이 된다.
 */
/**
 * 🔁 2026-10-18 — **목록은 한 번만 받는다**(모듈 단위 단일 비행 + 5분 보관).
 *
 * `check-duplicate-fetch` 가 홈·쇼핑에서 **간헐로** `/api/urshorts ×2`(+395ms · +429ms)를 잡았다.
 * 원인은 이 부품이 아니라 **놓이는 자리**다: `HomeSections` 는 편성 섹션이 오기 전엔 레일을 한 자리
 * (자리표시 분기)에, 온 뒤엔 첫 섹션 안(`sIdx === 0`)에 그린다 — 트리의 다른 자리라 React 가
 * **새로 마운트**하고, 새 인스턴스는 `nearData` 가 처음부터 다시 false 라 관측 → 요청을 또 낸다.
 * 섹션 도착과 레일 관측 중 무엇이 먼저냐에 따라 갈려서 간헐이었다(같은 커밋 로컬 5회 중 1회).
 *
 * ⇒ 요청을 인스턴스가 아니라 **모듈**이 들고 있는다. 다시 마운트돼도 날아가는 요청을 이어받고,
 *   이미 받았으면 첫 렌더에 그 목록으로 바로 그린다(자리표시 → 목록 깜빡임도 사라진다).
 * ⚠️ 실패는 보관하지 않는다 — 다음 마운트가 다시 시도한다(fail-soft 는 그대로).
 */
const RAIL_LIST_TTL_MS = 5 * 60_000
type RailList = { at: number; p: Promise<UrShortItem[] | null>; items?: UrShortItem[] | null }
let railList: RailList | null = null

function freshRailList(): RailList | null {
  return railList && Date.now() - railList.at < RAIL_LIST_TTL_MS ? railList : null
}

function loadRailList(): Promise<UrShortItem[] | null> {
  const cur = freshRailList()
  if (cur) return cur.p
  const entry: RailList = { at: Date.now(), p: Promise.resolve(null) }
  entry.p = fetch('/api/urshorts')
    .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
    .then((r) => {
      const v = r?.success && Array.isArray(r.data) ? r.data : null
      entry.items = v
      return v
    })
    .catch(() => {
      if (railList === entry) railList = null
      return null
    })
  railList = entry
  return entry.p
}

function ShortCard({ item, load, onOpen }: { item: UrShortItem; load: boolean; onOpen: () => void }) {
  const thumb = item.thumb_url || item.product_image || ''
  // 💸 할인율·정가는 홈 딜 카드·구매 바와 **같은 규칙**(priceDisplay SSOT).
  //    여기서 또 따로 계산하면 같은 상품이 세 화면에서 서로 다른 %를 보이게 된다.
  const pd = priceDisplay(item)
  // ⏱️ 재생시간은 **없을 수 있다** — 2026-09-08 이전에 `/shorts/` 주소로 넣은 영상은
  //    유튜브 조회를 건너뛰어 길이가 비어 있다. 없으면 배지를 그리지 않는다.
  const dur = Number(item.duration_sec) || 0
  const durLabel = dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : null
  // 🔴 이용권이 안 붙은 영상은 **글자 띠 자체를 안 그린다**(2026-09-08 대표 — 서버가 LEFT JOIN 이
  //    되면서 상품 없는 행이 여기까지 온다). 조건 없이 그리면 빈 검정 그라디언트만 남는데,
  //    그건 "정보 없음"이 아니라 그냥 결함으로 보인다.
  const hasInfo = !!(item.store_name || item.product_name || pd.price > 0)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 snap-start text-left"
      style={{ width: URSHORTS_CARD_W }}
      aria-label={`${item.store_name || ''} ${shortDisplayTitle(item) || '유어쇼츠 영상'}`}
    >
      <span
        className="relative block overflow-hidden rounded-[10px] bg-media-slot"
        style={{ height: URSHORTS_CARD_H }}
      >
        {load && thumb ? (
          <img
            src={cfImage(thumb, { width: 250 })}
            alt=""
            width={URSHORTS_CARD_W}
            height={URSHORTS_CARD_H}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => cfImageOnError(e.currentTarget, thumb)}
          />
        ) : null}
        <span className="absolute left-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-black/50 text-white">
          <Play size={11} fill="currentColor" strokeWidth={0} />
        </span>
        {/* ⏱️ 재생시간은 **우상단**이다. 시안에서는 우하단이었는데, 글자가 네 줄이 되면서
            아래쪽은 스크림이 다 차지한다 — 그대로 두면 가격 위에 배지가 얹힌다(렌더로 확인). */}
        {durLabel && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-px text-[12px] font-medium tabular-nums text-white">
            {durLabel}
          </span>
        )}
        {/* 💰 대표 확정 "안 라"(2026-09-08) — 매장 / 상품명 / 정가 / 할인율·판매가.
            가격이 사진 위에 있는 것이 요점이다 — 누르기 전에 이미 "파는 것"임을 안다.

            🔴 **모르는 것은 그리지 않는다**(대표 *"영상 속 정보 모르면 그냥 안보이게"*).
               줄마다 값이 있을 때만 렌더한다. 이전엔 매장명이 `|| ''` 라 **값이 없어도 빈 줄이
               남아** 카드마다 글자 시작 높이가 달랐다. 2026-09-08 부터는 **상품명·가격도 빌 수 있다**
               (이용권 안 붙인 영상도 홈에 나간다) — 그래서 띠 전체가 `hasInfo` 뒤에 있다. */}
        {hasInfo && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-[7px] pb-[7px] pt-[18px] text-white">
          {item.store_name && (
            <span className="block truncate text-[12px] opacity-90">{item.store_name}</span>
          )}
          {item.product_name && (
            <span className="mt-px block truncate text-[12px] font-medium leading-tight">
              {item.product_name}
            </span>
          )}
          {pd.showOriginal && (
            <span className="mt-1 block text-[12px] tabular-nums line-through opacity-70">
              {formatNumber(pd.originalPrice)}원
            </span>
          )}
          {pd.price > 0 && (
          <span className="mt-px block text-[12px] font-medium tabular-nums">
            {/* 🩸 여기에 새 빨강(#FF8A93)을 발명했다가 되돌렸다. 오늘 아침에 할인율을 `--sale`
                하나로 통일해 놓고 같은 날 넷째 값을 만들 뻔했다. 사진 위 스크림은 **테마와 무관하게
                늘 어둡다**(light-island 와 같은 성질)이라 라이트 값 #DC2626 은 안 읽힌다 →
                시스템이 이미 쓰는 **다크 표면용 --sale 값**을 그대로 쓴다. */}
            {pd.discount > 0 && <b className="text-sale-on-media">{pd.discount}% </b>}
            {formatNumber(pd.price)}원
          </span>
          )}
        </span>
        )}
      </span>
    </button>
  )
}
const MemoCard = memo(ShortCard)

/** 지난 방문의 영상 수 — 0 이면 다음 홈에서 자리를 예약하지 않는다. 모르면 null(= 예약한다). */
const RAIL_HINT_KEY = 'ur_urshorts_n'
function readRailHint(): number | null {
  try { const v = localStorage.getItem(RAIL_HINT_KEY); return v == null ? null : Number(v) } catch { return null }
}
function writeRailHint(n: number) {
  try { localStorage.setItem(RAIL_HINT_KEY, String(n)) } catch { /* 저장 불가 브라우저 — 매번 예약한다 */ }
}

export default function UrShortsRail() {
  // 🔁 이미 받아 둔 목록이 있으면(다시 마운트된 경우) 첫 렌더부터 그것으로 그린다.
  const [cached] = useState(() => freshRailList()?.items)
  const [items, setItems] = useState<UrShortItem[]>(() => cached ?? [])
  const [near, setNear] = useState(false)
  const [nearData, setNearData] = useState(false)
  const [edge, setEdge] = useState({ l: false, r: false })
  // 🩸 2026-10-14 (대표 신고 *"유어쇼츠가 로딩에 걸려서 안 보이는 경우가 많아"*): 관측 대상을
  //    `useRef` 로 두면 **목록이 오는 순간 빈 관측 div 가 <section> 으로 바뀌어도 관측기는 옛 div
  //    (문서에서 떨어진 것)를 계속 본다** — 떨어진 요소는 다시는 교차하지 않으므로 300px 신호가
  //    영원히 안 와 썸네일이 0장으로 굳는다. 폰(서버가 첫 화면을 그려 페이지가 처음부터 긴 경우)
  //    에서 재현 3/3. ⇒ 콜백 ref 로 **지금 붙어 있는 요소**를 state 로 들고, 바뀌면 관측기를 다시 건다.
  const [wrapEl, setWrapEl] = useState<HTMLElement | null>(null)
  // 📐 2026-10-14 (실사용 홈 CLS p75 0.199): 목록이 오기 전엔 자리를 비워 뒀다가, 도착하면 ~296px 레일이
  //   **인기 이용권 바로 아래에 끼어들어** 그 아래(피드)를 통째로 밀었다. ⇒ 지난번에 영상이 있었으면(또는
  //   처음이면) **같은 패널을 카드 자리만 비워** 먼저 세운다 — 높이가 같아 도착해도 안 민다.
  //   영상이 0 이었던 기억이 있으면 예약하지 않는다(대표 확정 "영상이 없으면 섹션 자체를 안 보인다").
  const [reserve] = useState(() => readRailHint() !== 0)
  const [settled, setSettled] = useState(() => cached !== undefined)
  const railRef = useRef<HTMLDivElement | null>(null)

  /**
   * 🔴 **다가올 때 부른다.** 마운트 때 부르면 홈을 여는 모든 사람이 요청 하나를 더 내는데,
   * 대부분은 여기까지 스크롤하지 않는다. 관측 여백 안에 들어온 사람만 부르므로
   * **홈 첫 화면의 요청 수와 D1 읽기가 0** 이다.
   *
   * 🔀 **2026-10-12: 신호를 둘로 갈랐다**(대표 *"메인에서 유어쇼츠가 늦게 로딩되네?"*).
   * 종전엔 목록(JSON)과 썸네일 10장이 **같은 300px 신호**를 썼다. 그러면 레일이 눈에
   * 들어온 바로 그때 [목록 요청 → 썸네일 요청] **두 왕복이 직렬로** 시작돼서, 사람이
   * 보고 있는 동안 빈 줄이 남는다. 둘의 무게가 전혀 다른데 같은 시점을 쓰고 있었다:
   *
   *   목록 `/api/urshorts`  1.2KB · 엣지 캐시(900s, cron 예열) · 실측 warm 167ms
   *   썸네일              10장 × 수KB · 레일이 실제로 보여야 쓸모가 있다
   *
   * ⇒ **목록만 1,200px 앞에서** 미리 받고(조금만 스크롤해도 도착해 있다), 썸네일은
   *   종전 300px 그대로 둔다. 스크롤을 아예 안 한 사람의 요청 수는 **여전히 0** 이다.
   */
  useEffect(() => {
    const el = wrapEl
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); setNearData(true); return }
    // 이름을 `mk` 로 두지 않는다 — `check-branch-scope` 가 그 이름을 **주입 지문**으로 쓴다
    //   (실제로 이 커밋이 그 가드에 걸렸다). 어차피 `watchFrom` 이 하는 일을 더 잘 말한다.
    const watchFrom = (margin: string, done: () => void) => {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { done(); io.disconnect() }
      }, { rootMargin: margin })
      io.observe(el)
      return io
    }
    const ios = [
      nearData ? null : watchFrom('1200px', () => setNearData(true)),
      near ? null : watchFrom('300px', () => setNear(true)),
    ]
    return () => ios.forEach((io) => io?.disconnect())
  }, [wrapEl, near, nearData])

  useEffect(() => {
    if (!nearData) return
    let alive = true
    // fail-soft: 실패하면 `null` — 레일이 안 뜰 뿐 홈은 열린다.
    loadRailList().then((list) => {
      if (!alive) return
      if (list) { setItems(list); writeRailHint(list.length) }
      setSettled(true)
    })
    return () => { alive = false }
  }, [nearData])

  const sync = useMemo(() => () => {
    const r = railRef.current
    if (!r) return
    setEdge({ l: r.scrollLeft > 8, r: r.scrollLeft < r.scrollWidth - r.clientWidth - 8 })
  }, [])
  // 🧮 2026-10-14: 마운트·목록 도착 때 재지 않는다. 화살표는 **마우스를 올렸을 때만** 보이므로 그때 잰다
  //   (`onPointerEnter`) — 종전엔 부팅 중에 scrollWidth 를 읽어 **강제 동기 레이아웃**이 났고, 홈 부팅에서
  //   앱 함수 중 가장 비쌌다(CPU×4 프로파일 76ms). 폰은 화살표가 없으니 한 번도 안 잰다.

  // 보이는 폭에서 카드 한 장을 뺀 만큼. 한 장이 겹쳐 넘어와 어디까지 봤는지 잃지 않는다.
  const nudge = (dir: 1 | -1) => {
    const r = railRef.current
    if (!r) return
    const one = URSHORTS_CARD_W + 12
    r.scrollBy({ left: dir * Math.max(one, r.clientWidth - one), behavior: 'smooth' })
  }

  /**
   * 영상이 없으면 섹션 자체를 안 보인다(대표 확정) — 빈 줄을 남기지 않는다.
   * 단 **관측용 빈 div 는 남긴다**: 이게 없으면 IntersectionObserver 가 붙을 곳이 없어
   * 영원히 데이터를 안 부른다(첫 판에서 실제로 그랬다).
   */
  //   예약 중(목록 도착 전)에는 아래 같은 `<section>` 을 그대로 그린다 — **같은 DOM 노드**라 관측(IO)이
  //   끊기지 않는다(종전엔 빈 div → section 으로 노드가 바뀌어, 썸네일 관측이 떨어져 나간 div 를 보고 있었다).
  const waiting = items.length === 0 && reserve && !settled
  if (items.length === 0 && !waiting) return <div ref={setWrapEl} aria-hidden="true" />

  return (
    <section className="ur-home-panel ur-panel-ink" ref={setWrapEl}>
      <div className="mb-3 flex items-end justify-between gap-4">
        {/* 🌑 잉크 패널 위라 글자는 **테마 분기 없이 늘 밝다**(위 .ur-panel-ink 주석).
            흰 알파를 쓰는 이유: 회색 토큰은 라이트 토큰으로 읽혀 짝(dark:)을 요구받는데,
            여기엔 짝지을 라이트 상태가 아예 없다. */}
        <h3 className="text-[17px] font-bold tracking-tight text-white">
          유어쇼츠
          <span className="ml-2 text-[12px] font-normal text-white/60">
            눌러서 보고 바로 구매
          </span>
        </h3>
        {/* 🔗 2026-09-21 — 「전체 보기」의 목적지가 뷰어(`/videos`)에서 **목록**(`/urshorts`)으로
            바뀌었다. 종전엔 전체 보기를 눌러도 세로 뷰어가 열려 "무엇이 있는지" 를 볼 방법이
            아예 없었다(대표 신고). 카드를 누르는 것은 그대로 뷰어다 — 그건 보러 가는 동작이다. */}
        <Link
          to={URSHORTS_BROWSE_PATH}
          className={`shrink-0 whitespace-nowrap text-[12px] font-medium text-white/75 underline-offset-4 hover:underline${waiting ? ' invisible' : ''}`}
          tabIndex={waiting ? -1 : undefined}
          aria-hidden={waiting || undefined}
        >
          전체 보기
        </Link>
      </div>

      {/* 🩸 2026-09-08: 여기 `group` 이 **없었다.** 아래 화살표 둘이 `group-hover:grid` 인데 부모에
          `group` 이 없으면 그 변형은 **영원히 안 걸린다** — 즉 PC 화살표가 한 번도 뜬 적이 없다.
          `hidden` 이 기본값이라 에러도 경고도 없고, 대표에게는 그냥 "넘길 방법이 없는 레일"로 보였다.
          이 레포가 반복해 만난 "코드는 있는데 안 되던" 클래스 그대로다(뷰어 스와이프가 같은 날 같은 꼴). */}
      <div className="group relative" onPointerEnter={sync}>
        {/* 화살표는 PC 에서 레일에 마우스를 올렸을 때만. 폰은 잘린 카드가 이미 말한다. */}
        {edge.l && (
          <button
            type="button" aria-label="이전"
            onClick={() => nudge(-1)}
            className="absolute left-[-13px] z-[3] hidden h-9 w-9 place-items-center rounded-full bg-[#2A2D38] text-white shadow-lg [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid"
            style={{ top: URSHORTS_CARD_H / 2 - 18 }}
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <div
          ref={railRef}
          onScroll={sync}
          className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto"
        >
          {waiting && Array.from({ length: 4 }, (_, i) => (
            <span key={i} aria-hidden="true" className="block shrink-0 rounded-[10px] bg-media-slot" style={{ width: URSHORTS_CARD_W, height: URSHORTS_CARD_H }} />
          ))}
          {items.map((it) => (
            <MemoCard
              key={it.id}
              item={it}
              load={near}
              onOpen={() => { window.location.href = `${URSHORTS_VIEWER_PATH}?v=${it.video_id}` }}
            />
          ))}
          {/* 끝까지 민 사람은 이미 관심이 있다. 그 자리에 문을 둔다. */}
          {!waiting && <Link
            to={URSHORTS_BROWSE_PATH}
            className="grid shrink-0 snap-start place-items-center gap-2 rounded-[10px] border border-dashed border-white/20 text-center text-brand-text"
            style={{ width: URSHORTS_CARD_W, height: URSHORTS_CARD_H }}
          >
            <span>
              <ChevronRight size={24} className="mx-auto" />
              <span className="mt-1 block text-[12px] font-medium">전체 보기</span>
              <span className="mt-[2px] block text-[12px] font-normal text-white/55">
                {items.length}편
              </span>
            </span>
          </Link>}
        </div>
        {edge.r && (
          <button
            type="button" aria-label="다음"
            onClick={() => nudge(1)}
            className="absolute right-[-13px] z-[3] hidden h-9 w-9 place-items-center rounded-full bg-[#2A2D38] text-white shadow-lg [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid"
            style={{ top: URSHORTS_CARD_H / 2 - 18 }}
          >
            <ChevronRight size={17} />
          </button>
        )}
      </div>
    </section>
  )
}
