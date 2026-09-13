import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import BrandLoader from '@/components/brand/BrandLoader'
import { youTubeEmbedUrl, youTubePlayerVars, type UrShortItem } from '@/shared/urshorts'
import { loadYouTubePlayerApi, killCaptions, type YtPlayer } from './videos/youtube-player'
import { priceDisplay } from '@/shared/price-display'
import SEO from '@/components/SEO'

/**
 * 🎬 `/videos` — 유어쇼츠 뷰어 (2026-09-07 대표 확정: 주소는 `/videos`).
 *
 * 옛 `/shorts` 는 라이브커머스와 함께 내려간 자리(2026-07-07 제거)라 재사용하지 않는다 —
 * 되살리면 다음 세션이 폐기된 기능으로 오해한다.
 *
 * ## 🔴 재생기는 **항상 하나만** 산다 (2026-09-08 — 표현이 바뀌었다)
 * 유튜브 재생기는 무겁다. 열 개를 띄워 두면 폰에서 화면이 멈춘다.
 * 예전에는 `<iframe key={video_id}>` 로 "넘기면 이전 것이 파기된다"를 만들었는데, 지금은 **더 강한
 * 형태**다 — IFrame Player API 로 재생기를 **한 번 만들고 `loadVideoById` 로 갈아 끼운다.**
 * 만드는 자리가 한 곳(`playerRef`)뿐이라 두 개가 생길 수 없고, 넘김도 부팅 없이 즉시다.
 * ⚠️ 그래서 이 불변식의 앵커도 `key=` 가 아니라 **"`new YT.Player` 는 한 번 · 전환은 loadVideoById"** 다.
 *
 * ## 🔴 왜 API 를 쓰는가 — 자막 (대표 2026-09-08 *"자막이 자동으로 나오는건 변경할 수 있어?"*)
 * URL 파라미터에는 자막을 *끄는* 공식 값이 없다(`cc_load_policy=1` 이 "켜라"이고 0 은 문서 밖).
 * iframe 안은 교차 출처라 CSS 로도 못 건드린다. 확실한 길은 재생기 객체를 쥐고
 * `unloadModule('captions')` 을 부르는 것 하나뿐이다 — 그게 이 화면이 API 로 간 이유다.
 * 덤: `controls=0` 때문에 잃었던 **탭 일시정지**를 우리가 돌려준다(아래 제스처 층).
 *
 * ## 🔴 API 가 안 오면 **예전 방식으로 튼다**
 * 스크립트가 막히면(광고 차단기·네트워크) 이 화면이 통째로 검게 죽는다. 그래서 `apiState==='off'`
 * 이면 고정 iframe 으로 폴백한다 — 자막은 남지만 영상은 나온다. 이 분기를 지우지 말 것.
 *
 * ## 🔴 목록은 **열 때 한 번**만 받는다
 * 넘길 때마다 부르면 D1 읽기가 스와이프 수만큼 늘어난다. 2026-09-01 에 하루 읽기 한도를
 * 넘겨 소비자 API 가 통째로 멈춘 적이 있다.
 *
 * ## 구매 바가 영상 위에 항상 있는 이유
 * 영상이 끝나기를 기다렸다 보여 주면 이미 늦다. **보는 중에 사고 싶어지는 것**이 이 화면의 전부다.
 */
export default function VideosPage() {
  const [items, setItems] = useState<UrShortItem[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const startVideo = params.get('v')
  const touchY = useRef<number | null>(null)
  const touchAt = useRef(0)
  // 🖱️ 휠은 한 번 굴려도 이벤트가 수십 개 온다 — 쿨다운이 없으면 한 번에 끝까지 넘어간다.
  const wheelAt = useRef(0)
  // 📱 터치 뒤에 브라우저가 합성 click 을 한 번 더 쏜다 — 안 막으면 탭 한 번에 두 번 토글된다.
  const touchEndAt = useRef(0)

  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YtPlayer | null>(null)
  /** 재생기에 **실제로 물려 있는** 영상. 만들 때 넣은 것을 또 `loadVideoById` 하면 깜빡인다. */
  const loadedRef = useRef<string | null>(null)
  const [apiState, setApiState] = useState<'loading' | 'ready' | 'off'>('loading')
  /** 재생기가 **명령을 받을 수 있는가**. 만들자마자는 아니다 — `onReady` 전에는 호출이 던진다. */
  const [playerReady, setPlayerReady] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/urshorts?all=1')
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => {
        if (!alive) return
        const list = r?.success && Array.isArray(r.data) ? r.data : []
        setItems(list)
        if (startVideo) {
          const at = list.findIndex((x) => x.video_id === startVideo)
          if (at >= 0) setIdx(at)
        }
      })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [startVideo])

  // 🕐 API 로드는 목록 fetch 와 **동시에** 시작한다. 둘 다 끝나야 그리므로, 캐시된 작은
  //    스크립트가 D1 왕복보다 늦을 일이 거의 없다 — 체감 지연 0 으로 판정을 한 번에 끝낸다.
  useEffect(() => {
    let alive = true
    loadYouTubePlayerApi().then((yt) => { if (alive) setApiState(yt ? 'ready' : 'off') })
    return () => { alive = false }
  }, [])

  const cur = items?.[idx]
  const wantId = cur?.video_id ?? null
  // 재생기를 만드는 시점의 영상 id. 의존성에 넣으면 영상마다 재생기를 새로 만들게 된다.
  const wantIdRef = useRef<string | null>(null)
  wantIdRef.current = wantId

  const go = useMemo(() => (d: 1 | -1) => {
    setItems((list) => {
      if (list && list.length) setIdx((i) => Math.min(list.length - 1, Math.max(0, i + d)))
      return list
    })
  }, [])

  // ▶️ **재생기를 한 번만 만든다.** YT 가 우리가 넣어 준 빈 div 를 iframe 으로 갈아치우므로,
  //    그 div 는 React 가 모르는 자식이어야 한다(React 가 지우려 들면 removeChild 로 터진다).
  //    그래서 껍데기(`hostRef`)만 React 가 갖고, 안쪽은 우리가 만들고 우리가 destroy 한다.
  // ⚠️ 의존성에 `hasVideo` 가 있는 이유: 껍데기 div 는 **목록이 온 뒤**에야 그려진다.
  //    `[apiState]` 만 보면 API 가 목록보다 먼저 왔을 때 host 가 null 이라 한 번 헛돌고 끝난다
  //    (에러 없이 검은 화면). 두 번째 재생기는 아래 `playerRef.current` 가드가 막는다.
  const hasVideo = !!wantId
  useEffect(() => {
    if (apiState !== 'ready' || playerRef.current) return
    const host = hostRef.current
    const id = wantIdRef.current
    const YT = typeof window !== 'undefined' ? window.YT : undefined
    if (!host || !id || !YT?.Player) return

    const mount = document.createElement('div')
    mount.className = 'h-full w-full'
    host.appendChild(mount)
    loadedRef.current = id

    playerRef.current = new YT.Player(mount, {
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { ...youTubePlayerVars({ autoplay: true, controls: false }), origin: window.location.origin },
      events: {
        onReady: (e) => {
          setPlayerReady(true)
          killCaptions(e.target)
          try { e.target.playVideo() } catch { /* 자동재생 차단 — 탭하면 뜬다 */ }
        },
        // 🔴 자막은 **한 번 꺼서 끝나지 않는다** — 다음 영상이 오면 유튜브가 모듈을 다시 싣는다.
        onStateChange: (e) => {
          killCaptions(e.target)
          const st = window.YT?.PlayerState
          setPaused(e.data === (st?.PAUSED ?? 2))
          // 🔁 끝나면 **다시 튼다**(쇼츠의 기본 동작). 이건 취향이 아니라 방어다 — 그냥 두면
          //    유튜브가 끝 화면에 관련 영상을 깔고, 그걸 누른 사람은 우리 화면을 떠난다.
          //    `rel=0` 도 같은 채널로 좁힐 뿐 끝 화면 자체를 없애지는 못한다.
          if (e.data === (st?.ENDED ?? 0)) { try { e.target.playVideo() } catch { /* 곧 다음 상태가 온다 */ } }
        },
      },
    })

    return () => {
      try { playerRef.current?.destroy() } catch { /* 이미 사라졌으면 그만 */ }
      playerRef.current = null
      loadedRef.current = null
      setPlayerReady(false)
    }
  }, [apiState, hasVideo])

  // ⏭️ 전환은 **갈아 끼우기**다. 재생기를 새로 만들지 않는다(부팅 비용 0).
  // ⚠️ `playerReady` 를 함께 보는 이유: 재생기는 만든 직후엔 명령을 못 받는다(`onReady` 전 호출은
  //    던진다). 그때 그냥 삼키면 `loadedRef` 만 앞서 나가 **넘겨도 영상이 안 바뀐 채 굳는다** —
  //    준비되면 이 effect 가 다시 돌아 그 자리에서 이어 붙는다.
  useEffect(() => {
    const p = playerRef.current
    if (!p || !playerReady || !wantId || loadedRef.current === wantId) return
    loadedRef.current = wantId
    try { p.loadVideoById(wantId) } catch { /* 재생기가 아직 안 익었으면 onReady 가 맡는다 */ }
  }, [wantId, playerReady])

  /**
   * 👆 탭 일시정지. `controls=0` 으로 유튜브 조작을 끄고 그 위를 제스처 층이 덮었으니,
   * **그 대신 우리가 돌려준다.** 재생기가 없으면(폴백 경로) 아무 일도 안 한다.
   */
  const togglePlay = useMemo(() => () => {
    const p = playerRef.current
    if (!p) return
    try {
      const playing = window.YT?.PlayerState?.PLAYING ?? 1
      if (p.getPlayerState() === playing) p.pauseVideo()
      else p.playVideo()
    } catch { /* 재생기가 아직 안 익었다 */ }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1)
      if (e.key === 'ArrowDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, navigate, togglePlay])

  // 목록과 재생기 판정을 **함께** 기다린다. 먼저 그린 뒤 갈아 끼우면 재생기가 두 번 뜬다.
  if (items === null || apiState === 'loading') return <BrandLoader fullScreen forceDark label="유어쇼츠" />

  if (items.length === 0) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0A0C12] px-6 text-center text-white">
        <div>
          <p className="text-[15px] text-gray-300">아직 올라온 영상이 없어요.</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 text-[14px] font-bold text-white">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  // 💸 할인율·정가는 홈 딜 카드와 **같은 규칙**으로 정한다(`priceDisplay` SSOT).
  //    직접 계산하면 같은 상품이 홈에서 30%, 여기서 0% 로 보이는 날이 온다 — 에러 없이.
  const pd = priceDisplay(cur ?? {})
  const thumb = cur?.thumb_url || cur?.product_image || ''

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0A0C12]">
      <SEO title="유어쇼츠 - 유어딜" description="영상으로 보고 바로 구매하는 이용권" url="/videos" noindex />

      {/* ▶️ **재생기 자리.** API 가 왔으면 이 껍데기 안에 우리가 만든 재생기 하나가 산다
          (`playerRef` — 영상 전환은 `loadVideoById`). React 는 이 div 만 알고, 안쪽 iframe 은
          유튜브가 만들고 우리가 destroy 한다. */}
      {apiState === 'ready' && <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" />}

      {/* 🔴 폴백 — API 가 안 왔을 때만. 지우면 스크립트가 막힌 사용자에게 이 화면이 검게 죽는다.
          key 가 video_id 라 넘기면 이전 iframe 이 파기되고 새로 하나만 산다(여기선 전환이 곧 재부팅). */}
      {apiState === 'off' && cur && (
        <iframe
          key={cur.video_id}
          src={youTubeEmbedUrl(cur.video_id, { autoplay: true, controls: false })}
          title={cur.title || '유어쇼츠'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {/* 🖐️ **제스처 레이어** (2026-09-08 대표 *"마우스 위아래 스크롤이나 스마트폰으로도 위아래 스와이프"*).
          🔴 왜 층이 필요한가: iframe 이 화면을 꽉 덮어서 **터치·휠이 전부 유튜브로 먹힌다.**
             래퍼에 핸들러를 달아 둔 채로는 우리 코드까지 이벤트가 오지 않는다 — 스와이프 코드가
             있는데도 실제로는 안 넘어가던 이유가 이것이다(교차 출처라 안을 못 본다).
          ⚠️ 대가는 **유튜브 조작을 전부 우리가 대신해야 한다**는 것이다. 2026-09-08 에 탭
             일시정지를 `togglePlay()` 로 돌려줬다(IFrame API 를 쓰는 진짜 이유 중 하나).
             ⛔ 이 층을 지우면 스와이프가 죽는다 — 옮기지 말 것. */}
      <div
        className="absolute inset-0 z-10"
        onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null; touchAt.current = Date.now() }}
        onTouchEnd={(e) => {
          const from = touchY.current
          const end = e.changedTouches[0]?.clientY
          touchY.current = null
          touchEndAt.current = Date.now()
          if (from == null || end == null) return
          const dy = end - from
          if (Math.abs(dy) > 60) { go(dy < 0 ? 1 : -1); return }
          // 짧고 안 움직였으면 **탭**이다 — 길게 눌렀다 뗀 것은 아무것도 아니다.
          if (Math.abs(dy) < 12 && Date.now() - touchAt.current < 400) togglePlay()
        }}
        onClick={() => {
          // 터치 뒤 브라우저가 쏘는 합성 click 이면 무시한다(위에서 이미 토글했다).
          if (Date.now() - touchEndAt.current < 600) return
          togglePlay()
        }}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) < 20) return
          const now = Date.now()
          if (now - wheelAt.current < 450) return
          wheelAt.current = now
          go(e.deltaY > 0 ? 1 : -1)
        }}
      />

      {/* ⏸️ 멈춘 것이 **우리 탓인지 유튜브 탓인지** 화면이 말해 준다. `controls=0` 이라 유튜브가
          가운데 아이콘을 안 그려서, 이게 없으면 탭한 뒤 "멈춘 건가 고장인가"를 알 수 없다. */}
      {paused && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/45 backdrop-blur">
            <Play size={26} className="ml-[3px] fill-white text-white" />
          </div>
        </div>
      )}

      <button
        type="button" onClick={() => navigate(-1)} aria-label="닫기"
        className="absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
      >
        <X size={18} />
      </button>
      {/* 위아래 이동 — 손가락은 스와이프, 마우스는 이 버튼 */}
      <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 gap-2 [@media(hover:hover)_and_(pointer:fine)]:grid">
        <button type="button" aria-label="이전 영상" onClick={() => go(-1)} disabled={idx === 0}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white disabled:opacity-0">
          <ChevronUp size={17} />
        </button>
        <button type="button" aria-label="다음 영상" onClick={() => go(1)} disabled={idx >= items.length - 1}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white disabled:opacity-0">
          <ChevronDown size={17} />
        </button>
      </div>

      {/* 🔴 구매 바는 영상 위에 항상. 끝나기를 기다리면 이미 늦다.
          단 **살 게 있을 때만** — 2026-09-08 부터 이용권 안 붙인 영상도 여기 온다(대표 확정).
          상품이 없으면 `/group-buy/null` 로 가는 버튼이 되므로 바 전체를 안 그린다. */}
      {cur && cur.product_id ? (
        <div className="absolute inset-x-2.5 bottom-2.5 z-20 flex items-center gap-2.5 rounded-2xl bg-white/97 p-2.5 shadow-2xl">
          {thumb && (
            <img
              src={cfImage(thumb, { width: 120 })} alt=""
              width={46} height={46}
              className="h-[46px] w-[46px] shrink-0 rounded-[9px] object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, thumb)}
            />
          )}
          {/* 🧾 대표 확정 "안 B + 기존 가격정보"(2026-09-08) — 매장 / 상품명 / 가격 세 줄.
              **무엇을 사는지 모른 채 누르게 하지 않는다**는 것이 상품명 줄의 존재 이유다.

              🩸 내가 틀렸던 것: "정가는 버튼 옆 220px 자리에 228px라 안 들어간다" 고 보고했는데
              **재 보니 자리가 267px 였고 정가 포함 가격 줄은 139px** 였다(430px 기준). 계산을
              머리로 했고 틀렸다. 가장 좁은 360px 에서도 자리 197px / 최악값 175px 로 들어간다
              (최악 = `9,900,000원 99% 9,900,000원`). 실측 근거는 `videos-buy-bar.test.ts` 주석에.

              ⚠️ 가격 줄은 `whitespace-nowrap` 이라 6자리에서도 안 깨진다. 넘치면 잘릴 뿐
              (홈 카드가 2줄로 나눈 것과 다른 선택 — 여기는 영상을 덜 가리는 게 우선이다). */}
          <div className="min-w-0 flex-1 text-gray-900">
            {/* 매장명은 비어 있을 수 있다 — `|| ''` 로 두면 빈 줄이 남아 카드마다 높이가 갈린다
                (홈 레일 카드에서 고친 것과 같은 결함). */}
            {cur.store_name && (
              <div className="truncate text-[10.5px] text-gray-500">{cur.store_name}</div>
            )}
            {cur.product_name && (
              <div className="truncate text-[12.5px] font-semibold leading-tight">{cur.product_name}</div>
            )}
            <div className="mt-[1px] flex items-baseline whitespace-nowrap text-[15px] font-bold tabular-nums">
              {pd.showOriginal && (
                <span className="mr-1 text-[11px] font-normal text-gray-400 line-through">
                  {formatNumber(pd.originalPrice)}원
                </span>
              )}
              {pd.discount > 0 && <span className="mr-1 text-[12.5px] text-sale">{pd.discount}%</span>}
              {formatNumber(pd.price)}원
            </div>
          </div>
          <Link
            to={`/group-buy/${cur.product_id}`}
            className="shrink-0 rounded-[10px] bg-brand px-[15px] py-[11px] text-[13.5px] font-bold text-white"
          >
            구매
          </Link>
        </div>
      ) : null}
    </div>
  )
}
