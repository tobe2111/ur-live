/**
 * 🧾 마이의 **목록 문법 한 벌**.
 *
 * ## 🔵 2026-09-29 — 대표 확정 **안 C**(코레일톡 전체메뉴 형태). 문법이 바뀌었다.
 *
 * 대표가 코레일톡 전체메뉴 화면을 보내며 *"마이는 이 이미지 형태로 가는게 좋을 것 같은데"* →
 * 시안 셋 중 **안 C** 를 골랐다. 그 화면의 본질은 스타일이 아니라 **성격**이다 — 전체메뉴는
 * *읽는 화면이 아니라 찾는 화면*이라 셋을 안 한다: ① 줄마다 설명 ② 판(카드) ③ 두꺼운 행.
 *
 * 실측이 그 판단을 뒷받침했다(`out/visual/my-firstscreen.png`):
 *
 * | | 그때(판 문법) | 지금(안 C) |
 * |---|---|---|
 * | 폰 한 화면(844px)에 손님 줄 | **0줄** | 3줄 |
 * | 행 높이 | 약 70px(제목+설명 두 줄) | **48px**(제목 한 줄 · 값 오른쪽) |
 * | 흰 판 | 3개 + 파란 면 | **1개**(파는 쪽만) |
 *
 * ⇒ **`ListRow` 가 평면 행이 됐다**(설명은 오른쪽 짧은 값으로). 판(`ListPlate`)은 남지만
 *   **파는 쪽 한 곳에서만** 쓴다 — 안 C 에서 *판이 곧 "여기가 파는 쪽"* 이라는 표시자다.
 *   종전엔 그 표시를 **25px 구역 제목**이 했는데(2026-09-28 '이름 E'), 안 C 는 모든 구역에
 *   제목을 주므로 제목이 그 일을 못 한다. 표시자가 제목 → 판으로 **옮겨간 것**이지 사라진 게 아니다.
 *
 * ## ⚠️ 이 전환으로 **잃은 것** (숨기지 않는다)
 * 줄마다 붙던 설명 12개가 사라졌다("매장에서 QR·코드로 사용" 등). 처음 쓰는 사람에겐 정보가 준다.
 * 대신 하루에 여러 번 여는 사람에게는 매번 소음이고, 그 12줄이 손님 메뉴를 첫 화면 밖으로 밀어내고
 * 있었다. 꼭 필요한 곳만 **짧은 값**으로 오른쪽에 남긴다(`value`, 8자 안팎).
 *
 * ---
 * ## 아래는 이 파일이 처음 생긴 이유 (2026-09-28 — 대표 *"페이지 디자인 및 UI 퀄리티가 너무 허술해"*).
 *
 * ## 무엇이 잘못됐었나 (렌더 실측)
 * 마이 한 화면에 목록이 둘인데 **서로 다른 문법으로 그려지고 있었다.**
 *
 * | | 판매 쪽(`매일`·`가끔`) | 손님 쪽(`내가 산 것`) |
 * |---|---|---|
 * | 그룹 라벨 | 판 **밖** 위, 12px, `text-gray-400` | 판 **안** 맨 위, 10px |
 * | 판 | 그룹마다 **따로** | 세 그룹이 **한 판**(13행 한 덩어리) |
 * | 행 제목 | 14px `font-bold` | 13px `font-medium` |
 * | 설명 | 12px | 10px |
 *
 * 같은 화면에서 같은 성격의 줄이 두 벌로 그려지면, 어느 쪽이 정본인지 아무도 모르는 채
 * 다음 세션이 또 한 벌을 늘린다. 그래서 **부품을 하나로 만들고 둘이 그걸 쓴다.**
 *
 * 정본은 대표가 확정한 '전체 4'(`seller-section/AllToolsSheet.tsx`)와 판매 묶음의 문법이다 —
 * CLAUDE.md 🎫 표면 규칙 ⑦ *"판 위 작은 회색 그룹 라벨 · 행은 [라벨 왼쪽 · 값 오른쪽]"*.
 *
 * ## ⚠️ 못 하는 것
 * - **판 자체(`LIST_PLATE_CLS`)는 `SellerSection` 이 아직 문자열로 갖고 있다.** 그 파일의 판 개수를
 *   세는 기존 가드(`my-seller-all-in-my-2026-09-26`)가 그 리터럴을 앵커로 쓰고 있어서, 여기서
 *   바꾸면 지키던 불변식("묶음 카드가 셋")이 같이 사라진다. 대신 **두 문자열이 같은지를 시험이
 *   대조**한다(`my-list-grammar-2026-09-28`). 한쪽만 바뀌면 빨간불이 난다.
 * - 이 모듈은 **판매 코드를 끌고 오지 않는다.** `ShoppingGroup`(모든 사용자)과 `SellerSection`
 *   (셀러 전용 lazy 청크)이 같이 쓰므로, 여기에 판매 전용 것을 넣으면 비셀러가 그 코드를 받는다.
 */
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 판 — 회색 바탕 위 흰 판 하나. ⚠️ `SellerSection` 의 리터럴과 **같은 값이어야 한다**(위 주석). */
export const LIST_PLATE_CLS = 'rounded-2xl bg-surface shadow-lift overflow-hidden'

/**
 * 🏷️ **구역 제목** — 안 C 의 구역 머리(24px). 타입 스케일 여섯 단계의 두 번째 값이고,
 * 그 아래 단계(17)와도 한참 벌어져 본문 라벨(12·13·15)과 확실히 구별된다.
 *
 * ⚠️ 이제 **모든 구역**이 이걸 단다(내 가게 · 내가 산 것 · 수익·추천 · 바로 가기 · 설정).
 *   2026-09-28 '이름 E' 는 *"제목이 붙은 구역이 파는 쪽"* 이었는데, 안 C 가 그 규칙을 대체했다 —
 *   파는 쪽 표시는 **판**이 한다(위 머리말).
 */
export function SectionTitle({ children, as: Tag = 'h2' }: { children: React.ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <Tag className="mt-7 mb-2 px-4 text-[24px] font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white">
      {children}
    </Tag>
  )
}

/**
 * 그룹 라벨 — 판 **밖** 위. 작고 회색이라 블록 라벨(잉크)과 층이 갈린다.
 * ⚠️ **안 C 에서는 쓰지 않는다**(구역 제목이 그 일을 한다). 지우지 않은 이유는 `TeamPointsCard` 가
 *   아직 한 곳에서 쓰기 때문이고, 목록을 다시 그룹으로 쪼개는 용도로 **되살리지 말 것** —
 *   그 순간 한 화면에 제목 층이 셋이 된다(24 구역 · 12 그룹 · 15 행).
 */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 mb-2 px-1 text-[12px] font-bold text-gray-400">{children}</div>
}

/** 판 — 그룹 하나당 하나. 한 판에 여러 그룹을 담지 않는다(그 순간 그룹 라벨이 판 안으로 들어간다). */
export function ListPlate({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className ? `${className} ${LIST_PLATE_CLS}` : LIST_PLATE_CLS}>{children}</div>
}

/**
 * 📐 행 — 4px 격자 위에 선다. `min-h-[56px]` 은 **설명 없는 줄이 쪼그라들지 않게** 하는 바닥이다
 *   (설명 있는 줄은 자연히 66px). 높이를 아예 고정하지 않는 이유: 긴 매장 이름이 두 줄이 되는 날
 *   글자가 잘려 나간다 — 바닥만 두고 위로는 내용이 정한다.
 * 🎯 44px 은 터치 최소치이고 56px 은 **읽을 수 있는** 최소치다 — 대기업 앱 목록 행이 대개 56~64 다.
 */
/**
 * 📐 **평면 행** — 안 C(2026-09-29). 48px 한 줄이고, 판 안에서도 밖에서도 **같은 줄**이다.
 *
 * 🎯 왜 48 인가: 44px 은 터치 최소치(애플 HIG)이고 48 은 그 위에서 15px 제목이 숨 쉴 수 있는 최소치다.
 *   코레일톡·토스·당근의 전체메뉴 행이 전부 이 대역(46~52)에 있다. 종전 56~70px 은 *설명 두 줄*을
 *   담느라 커진 값이었고, 설명이 사라지면 그 높이를 유지할 이유가 없다.
 * 🧱 가로 여백은 **행이 갖는다**(`px-4`). 그래서 구역 제목(`px-4`)과 왼쪽 끝이 맞고, 평면 구역의
 *   바깥 래퍼는 가로 패딩을 **주면 안 된다**(주면 16+16=32px 로 들어간다).
 * ➖ 구분선은 마지막 줄에서만 사라진다 — 판 안에서는 판이 끝을 만들고, 밖에서는 구역이 끝을 만든다.
 */
const ROW_CLS =
  'w-full flex items-center gap-3 px-4 min-h-[48px] py-2 text-left border-b border-rule last:border-b-0 active:opacity-70 disabled:opacity-50'

export function ListRow({ icon, label, hint, count, busy, onClick, to }: {
  icon: React.ReactNode
  label: string
  /**
   * 🔵 2026-09-29(안 C): **오른쪽 짧은 값**이다. 종전엔 제목 아래 설명 줄이었다.
   * 여덟 자 안팎으로 — "확인 대기 2건" · "최근 3개월" · "판매 중 5개". 문장을 넣지 말 것
   * (길면 잘리고, 잘린 설명은 없느니만 못하다). 숫자는 `count` 가 따로 있다.
   */
  hint?: string
  /**
   * 오른쪽 값. `undefined`/`null` 이면 아예 안 그린다 — **아직 모르는 것을 0 이라고 말하지 않는다**
   * (2026-09-16 잔액 카드에서 값을 치르고 배운 규칙).
   * 🔢 0 은 **회색**이다. 굵은 잉크로 0 을 쓰면 화면이 "당신은 0" 이라고 알리는 꼴이 된다
   *    (2026-09-01 잔액 슬래브에서 같은 판단을 이미 했다).
   */
  count?: number | null
  busy?: boolean
  onClick?: () => void
  /**
   * 링크로 그린다(`to`). 안쪽 생김새는 버튼과 **한 글자도 다르지 않다** — 달라지는 건 의미뿐이다.
   * 같은 화면에서 어떤 줄은 우클릭·새 탭이 되고 어떤 줄은 안 되는 것이 정상이라, 그 차이를
   * **생김새로 드러내지 않는다**. 실제 경로가 있는 줄(내 유어샵 등)은 `to`, 시트를 여는 줄은 `onClick`.
   */
  to?: string
}) {
  const inner = (
    <>
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
      {/* 제목은 한 줄이고 **줄지 않는다** — 오른쪽 값이 길면 그쪽이 줄어든다(`min-w-0` 이 값 쪽에 있다). */}
      <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">{label}</span>
      {count != null ? (
        <span
          className={`shrink-0 text-[13px] font-bold tabular-nums ${
            count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {count}
        </span>
      ) : hint ? (
        <span className="min-w-0 text-[13px] text-gray-500 dark:text-gray-400 truncate">{hint}</span>
      ) : null}
      <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
    </>
  )
  if (to) return <Link to={to} className={ROW_CLS}>{inner}</Link>
  return (
    <button type="button" disabled={busy} onClick={onClick} className={ROW_CLS}>
      {inner}
    </button>
  )
}

/**
 * 🔽 **펼침 줄** — 평면 행과 **같은 치수**인데 목적지가 라우트가 아니라 *이 자리에서 펼쳐지는 내용*이다
 * (설정 토글·수익 카드처럼 페이지로 보낼 수 없는 것들).
 * 화살표만 다르다(`›` 대신 `⌄`) — 누르면 어디로 가는지가 아니라 **여기서 열린다**는 뜻이라
 * 그 차이는 생김새로 드러나야 한다(평면 행의 `›` 규칙과 짝이다).
 */
export function FoldRow({ icon, label, hint, open, onToggle }: {
  icon: React.ReactNode
  label: string
  hint?: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className={ROW_CLS}>
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">{label}</span>
      {hint && <span className="min-w-0 text-[13px] text-gray-500 dark:text-gray-400 truncate">{hint}</span>}
      <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  )
}

/** 아이콘은 호출부가 렌더한다(선 굵기·크기를 한 자리에서 고정하려고 헬퍼만 둔다). */
export function rowIcon(Icon: LucideIcon) {
  return <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
}
