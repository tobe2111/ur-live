/**
 * 🧾 마이의 **목록 문법 한 벌** (2026-09-28 — 대표 *"페이지 디자인 및 UI 퀄리티가 너무 허술해"*).
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
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 판 — 회색 바탕 위 흰 판 하나. ⚠️ `SellerSection` 의 리터럴과 **같은 값이어야 한다**(위 주석). */
export const LIST_PLATE_CLS = 'rounded-2xl bg-surface shadow-lift overflow-hidden'

/** 그룹 라벨 — 판 **밖** 위. 작고 회색이라 블록 라벨(잉크)과 층이 갈린다. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1.5 px-1 text-[12px] font-bold text-gray-400">{children}</div>
}

/** 판 — 그룹 하나당 하나. 한 판에 여러 그룹을 담지 않는다(그 순간 그룹 라벨이 판 안으로 들어간다). */
export function ListPlate({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className ? `${className} ${LIST_PLATE_CLS}` : LIST_PLATE_CLS}>{children}</div>
}

const ROW_CLS =
  'w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-rule last:border-b-0 active:opacity-70 disabled:opacity-50'

export function ListRow({ icon, label, hint, count, busy, onClick, to }: {
  icon: React.ReactNode
  label: string
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
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{label}</span>
        {hint && <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{hint}</span>}
      </span>
      {count != null && (
        <span
          className={`shrink-0 text-[13px] font-bold tabular-nums ${
            count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
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

/** 아이콘은 호출부가 렌더한다(선 굵기·크기를 한 자리에서 고정하려고 헬퍼만 둔다). */
export function rowIcon(Icon: LucideIcon) {
  return <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
}
