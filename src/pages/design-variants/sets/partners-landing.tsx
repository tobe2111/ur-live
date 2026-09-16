/**
 * 🎨 시안 세트 — 입점 랜딩(`/partners`).
 *
 * 대표: *"시안을 제대로 받아야겠는데, 지금 디자인이라곤 뭐가 없네."*
 *
 * 맞는 지적이다. 지금 배포 대기 중인 판(= 안 A)은 **사진이 한 장도 없다.** 글꼴 크기와 여백만으로
 * 서 있어서, 잘 정리된 문서이지 디자인이 아니다. 사장님이 "무엇을 파는 건지" 를 **글로 읽어야** 한다.
 *
 * ⚠️ 그런데 소재가 없던 게 아니다 — 대표 승인 덱이 쓰는 **라이브 앱 캡처 18장**이
 *    `docs/business/proposals/shots/` 에 이미 있었다(덱은 폰 프레임에 넣어 쓴다).
 *    랜딩만 그걸 한 장도 안 썼다. 그래서 이 세트의 축은 **"무엇을 보여 줄 것인가"** 다:
 *
 *      안 A  글만 (지금)        — 기준선. 비교 대상이 있어야 고를 수 있다
 *      안 B  실제 화면          — 폰 프레임 + 라이브 캡처. "이게 손님이 보는 화면입니다"
 *      안 C  사진 먼저          — 음식 사진을 화면 전체에. 커머스 톤(그루폰·쿠팡 계열)
 *      안 D  돈 그림           — 10,000원이 어디로 가는지 도해 하나로
 *
 * ✅ **2026-09-16 대표 확정 — 안 B.** (*"모바일은 오케이, 근데 PC 버전은 전혀 PC 버전 같지 않은데?
 *    안 B로 하는데 우리 유어딜 서비스의 차별점, 장점 그리고 기존 체험단 서비스와 비교하는 것
 *    그런게 필요해"*) `/partners` 본체가 안 B 로 다시 지어졌다 — 라이브 캡처 8장(히어로 2 ·
 *    사장님 화면 4 · 환불 안내 1 · 등록 1) + PC 타이포 단계 + 섹션별 레이아웃 계열 분리.
 *    ⚠️ 이 파일은 **그대로 둔다**(A·C·D 는 기각 기록이고, 나중에 다시 고를 때의 비교 대상이다).
 *    본체와 코드를 공유하지 않으므로 여기를 고쳐도 랜딩은 안 바뀐다 — 반대도 마찬가지다.
 *
 * 🔒 규칙(registry.ts): API 0 · 쓰기 0 · 가짜 데이터. 캡처는 `public/static/partners/*.jpg`(정적).
 * ⚠️ 판단 뒤에는 **고른 안 하나만** `/partners` 에 구현한다. 여기 코드는 랜딩 본체와 공유하지 않는다
 *    (시안이 본체를 물면 시안을 못 버린다).
 */
import { ArrowRight } from 'lucide-react'
import type { VariantSet, VariantCtx } from '../registry'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

/**
 * 🩸 2026-09-16 — 처음엔 `/partners/<n>.jpg` 에 뒀는데 **라이브에서 404** 였다.
 *   `public/_routes.json` 은 `/*` 를 전부 워커로 보내고 **명시 목록만** 정적으로 뺀다.
 *   `/partners/*.jpg` 는 그 목록에 없어 워커로 갔고, 워커는 `/assets/*` 만 서빙해서 404 가 났다.
 *   ⚠️ `/partners/*` 를 exclude 에 새로 넣는 건 위험하다 — 그 파일 주석이 경고하는 #598 클래스로
 *      랜딩 경로 자체를 정적 404 로 삼킬 수 있다. 이미 검증된 `/static/*` 제외를 쓴다.
 */
const SHOT = (n: string) => `/static/partners/${n}.jpg`
const won = (n: number) => n.toLocaleString('ko-KR')

/** 폰 프레임 — 덱(`phone-frame.mjs`)이 쓰는 그림을 웹으로 옮긴 것. 캡처가 430x930 이라 비율 고정. */
function Phone({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative shrink-0 rounded-2xl bg-gray-800 p-[7px] shadow-[0_18px_44px_rgb(0_0_0/0.28)] ${className}`}>
      <img
        src={src} alt={alt} width={430} height={930} loading="lazy"
        className="block w-full rounded-xl bg-white object-cover"
        style={{ aspectRatio: '430 / 930' }}
      />
    </div>
  )
}

const HEAD = '체험단 말고, 계산하는 손님을 부르는 방법입니다'
const SUB = `손님이 먼저 결제하고, 이용권을 들고 가게로 옵니다. 사장님이 내는 건 팔린 이용권의 수수료 ${F.feeDirect}, 그게 전부입니다.`
const STATS: [string, string][] = [['0원', '미리 내는 돈'], [F.feeDirect, '팔린 뒤에만'], [F.storeShareDirect, '사장님 몫']]

function Cta({ dark }: { dark?: boolean }) {
  return (
    <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
      <span className="inline-flex h-12 sm:flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand text-[14.5px] font-extrabold text-white">
        내 가게 등록하기 <ArrowRight className="h-4 w-4" />
      </span>
      <span className={`inline-flex h-12 sm:flex-1 items-center justify-center rounded-2xl border text-[14.5px] font-bold ${dark ? 'border-white/25 text-white/90' : 'border-rule-strong text-ink'}`}>
        카카오로 물어보기
      </span>
    </div>
  )
}

// ── 안 A — 지금 (글만) ───────────────────────────────────────────────────────
function VariantA() {
  return (
    <div className="bg-warm">
      <section className="ur-panel-ink px-6 py-12 text-white">
        <p className="text-[11.5px] font-bold text-brand-text">유어딜 입점 안내</p>
        <h1 className="mt-3 text-[27px] font-extrabold leading-[1.25] tracking-[-0.02em]">{HEAD}</h1>
        <p className="mt-4 text-[13.5px] leading-[1.75] text-white/70">{SUB}</p>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {STATS.map(([n, l]) => (
            <div key={l}>
              <p className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em]">{n}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-white/55">{l}</p>
            </div>
          ))}
        </div>
        <Cta dark />
      </section>
      <section className="px-6 py-12">
        <h2 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.02em] text-ink">유어딜이 사장님께 드리는 것은 셋입니다</h2>
        <div className="mt-7 space-y-6">
          {[['선불 비용 0원', '이용권이 팔리고 손님이 와서 쓴 뒤에야 수수료가 생깁니다.'],
            ['온라인 노출이 실제 방문까지', '손님이 QR을 찍는 순간이 곧 방문 기록입니다.'],
            ['선결제라 매출이 먼저 확정', '예약만 잡고 안 오는 일이 구조적으로 없습니다.']].map(([k, d], i) => (
            <div key={k}>
              <p className="text-[11.5px] font-extrabold tabular-nums text-brand-text">0{i + 1}</p>
              <p className="mt-1.5 text-[17px] font-extrabold leading-snug text-ink">{k}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── 안 B — 실제 화면 (폰 프레임 + 라이브 캡처) ────────────────────────────────
function VariantB() {
  return (
    <div className="bg-warm">
      <section className="ur-panel-ink px-6 pt-12 text-white">
        <p className="text-[11.5px] font-bold text-brand-text">유어딜 입점 안내</p>
        <h1 className="mt-3 text-[27px] font-extrabold leading-[1.25] tracking-[-0.02em]">{HEAD}</h1>
        <p className="mt-4 text-[13.5px] leading-[1.75] text-white/70">{SUB}</p>
        <Cta dark />
        {/* 사진이 곧 증거다 — 문장 다음에 바로 "손님이 보는 화면" 을 놓는다.
            ⚠️ 처음엔 폰을 아래로 밀어 걸쳐 보이게 했는데, 화면 중간이 잘려 **고장처럼** 읽혔다.
               랜딩에서 잘린 스크린샷은 의도가 아니라 실수로 보인다 ⇒ 온전히 보여 준다. */}
        <div className="mt-9 flex items-end justify-center gap-3 pb-12">
          <Phone src={SHOT('home')} alt="유어딜 홈에 뜬 동네 이용권" className="w-[44%]" />
          <Phone src={SHOT('detail')} alt="이용권 상세 화면" className="w-[38%] opacity-90" />
        </div>
        <p className="-mt-6 pb-8 text-center text-[11.5px] text-white/50">손님이 실제로 보는 화면입니다</p>
      </section>
      <section className="px-6 py-12">
        <h2 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.02em] text-ink">사장님 화면은 이렇습니다</h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500">손님이 보여 주는 QR을 찍으면 끝입니다. 단말기도 포스 연동도 없습니다.</p>
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          {[[SHOT('seller-scan'), 'QR 한 번 찍으면 사용 처리'], [SHOT('store-new'), '카카오맵에서 내 가게 찾기']].map(([s, cap]) => (
            <figure key={s}>
              <Phone src={s} alt={cap} />
              <figcaption className="mt-3 text-[12.5px] font-semibold text-gray-600">{cap}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── 안 C — 사진 먼저 (커머스 톤) ─────────────────────────────────────────────
function VariantC() {
  return (
    <div className="bg-warm">
      {/* 히어로를 사진이 차지한다. 글은 그 위에 얹힌다 */}
      <section className="relative">
        {/* 🩸 첫 판은 home.jpg(430px 스크린샷)를 4배 확대해 썼는데 **뭉갰다** — 확대할 해상도가 없다.
            사진 히어로는 스크린샷 크롭이 아니라 원본 사진이라야 한다. 이건 라이브 상품 2888 의
            실제 사진을 리사이즈한 것(1080²). ⚠️ 안 C 를 채택하면 매장 사진 사용 동의를 확인할 것. */}
        <div className="relative h-[330px] overflow-hidden">
          <img src={SHOT('deal-photo')} alt="" width={1080} height={1080} loading="lazy"
            className="h-full w-full object-cover object-[50%_46%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(22_24_28/0.45)_0%,rgb(22_24_28/0.86)_62%,rgb(22_24_28)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-7">
            <h1 className="text-[27px] font-extrabold leading-[1.25] tracking-[-0.02em] text-white">{HEAD}</h1>
          </div>
        </div>
        <div className="ur-panel-ink px-6 pb-12 pt-1 text-white">
          <p className="text-[13.5px] leading-[1.75] text-white/70">{SUB}</p>
          {/* 실제 팔리는 상품 한 장 — 사장님이 "내 메뉴도 이렇게 걸리는구나" 를 본다 */}
          <div className="mt-7 rounded-2xl bg-surface p-4 shadow-lift">
            <p className="text-[11.5px] font-bold text-gray-400">지금 유어딜에서 팔리는 상품</p>
            <p className="mt-2 text-[15px] font-extrabold text-ink">{F.sample.name}</p>
            <p className="mt-0.5 text-[12px] text-gray-500">홍대돈까스</p>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-[12.5px] tabular-nums text-gray-400 line-through">{won(F.sample.list)}원</span>
              <span className="text-[22px] font-extrabold tabular-nums text-brand-text">{won(F.sample.sale)}원</span>
            </div>
          </div>
          <Cta dark />
        </div>
      </section>
      <section className="px-6 py-12">
        <h2 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.02em] text-ink">손님은 이렇게 옵니다</h2>
        <ol className="mt-7 space-y-5">
          {['지도와 유어샵에서 동네 이용권을 봅니다', '가게에 오기 전에 온라인에서 값을 치릅니다',
            '이용권이 손님 폰으로 발급됩니다', 'QR을 찍거나 확인코드를 넣습니다'].map((t, i) => (
            <li key={t} className="flex gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11.5px] font-extrabold tabular-nums text-brand-text">{i + 1}</span>
              <p className="text-[14px] leading-snug text-ink">{t}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

// ── 안 D — 돈 그림 (도해 중심) ───────────────────────────────────────────────
function MoneyFlow() {
  const fee = Math.round(F.sample.sale * 0.1)
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-lift">
      <p className="text-[11.5px] font-bold text-gray-400">{F.sample.name} 한 장이 팔리면</p>
      <p className="mt-2 text-[30px] font-extrabold tabular-nums tracking-[-0.03em] text-ink">{won(F.sample.sale)}원</p>
      <p className="text-[11.5px] text-gray-500">손님이 내는 돈</p>
      {/* 갈래 둘 — 막대 길이가 곧 비율이다(눈으로 한 번에 읽히게) */}
      <div className="mt-5 flex gap-1.5">
        <div className="h-2.5 rounded-full bg-brand" style={{ flex: 9 }} />
        <div className="h-2.5 rounded-full bg-gray-300" style={{ flex: 1 }} />
      </div>
      <div className="mt-3.5 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-extrabold text-ink">사장님 계좌에</span>
          <span className="text-[19px] font-extrabold tabular-nums text-brand-text">{won(F.sample.sale - fee)}원</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-rule pt-2.5">
          <span className="text-[12.5px] text-gray-500">유어딜 {F.feeDirect}</span>
          <span className="text-[13px] font-bold tabular-nums text-gray-600">{won(fee)}원</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-gray-500">카드 수수료</span>
          <span className="text-[13px] font-bold text-gray-600">0원 (유어딜 부담)</span>
        </div>
      </div>
    </div>
  )
}

function VariantD() {
  return (
    <div className="bg-warm">
      <section className="ur-panel-ink px-6 py-12 text-white">
        <h1 className="text-[27px] font-extrabold leading-[1.25] tracking-[-0.02em]">{HEAD}</h1>
        <p className="mt-4 text-[13.5px] leading-[1.75] text-white/70">{SUB}</p>
        <div className="mt-8"><MoneyFlow /></div>
        <Cta dark />
      </section>
      <section className="px-6 py-12">
        <h2 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.02em] text-ink">돈이 나가는 시점이 다릅니다</h2>
        <div className="mt-7 space-y-3">
          {[['체험단', '대행비를 먼저 보내고 밥도 공짜', 100],
            ['배달앱 광고', '매달 광고비를 먼저', 70],
            ['유어딜', '팔리고 손님이 온 뒤에만', 0]].map(([k, d, pct], i) => (
            <div key={k as string} className={`rounded-2xl p-4 ${i === 2 ? 'bg-surface shadow-lift' : 'bg-black/[0.03]'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={`text-[14.5px] font-extrabold ${i === 2 ? 'text-brand-text' : 'text-ink'}`}>{k}</p>
                <p className="text-[12px] text-gray-500">{d}</p>
              </div>
              <div className="mt-2.5 h-2 rounded-full bg-black/[0.06]">
                <div className={`h-2 rounded-full ${i === 2 ? 'bg-brand' : 'bg-gray-400'}`} style={{ width: `${Math.max(3, pct as number)}%` }} />
              </div>
              <p className="mt-1.5 text-[10.5px] text-gray-400">{i === 2 ? '선지불 0' : '선지불'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const set: VariantSet = {
  id: 'partners-landing',
  label: '입점 랜딩',
  route: '/partners',
  problem:
    '지금 판(안 A)은 사진이 한 장도 없다. 글꼴 크기와 여백만으로 서 있어서 잘 정리된 문서이지 ' +
    '디자인이 아니고, 사장님이 "무엇을 파는 건지" 를 글로 읽어야 한다. ' +
    '⚠️ 소재는 있었다 — 대표 승인 덱이 쓰는 라이브 앱 캡처 18장이 레포에 이미 있고 랜딩만 안 썼다.',
  variants: [
    { id: 'a', label: '안 A — 지금 (글만)', note: '기준선. 배포 대기 중인 판 그대로 — 사진 0장, 문장과 여백만.', render: () => <VariantA /> },
    { id: 'b', label: '안 B — 실제 화면', note: '폰 프레임에 라이브 캡처. "손님이 보는 화면" 과 "사장님 화면" 을 그대로 보여 준다.', render: () => <VariantB /> },
    { id: 'c', label: '안 C — 사진 먼저', note: '음식 사진이 히어로를 차지하고 글이 그 위에 얹힌다. 커머스 톤(그루폰 계열).', render: () => <VariantC /> },
    { id: 'd', label: '안 D — 돈 그림', note: '사진 대신 도해. 16,500원이 어디로 가는지 막대 하나로 먼저 보여 준다.', render: () => <VariantD /> },
  ],
}

/** 시안은 ctx 를 안 쓴다 — 이 화면엔 "데이터 0" 상태가 없다(마케팅 문구는 늘 같다). */
void (0 as unknown as VariantCtx)
export default set
