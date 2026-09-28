import type { ReactNode } from 'react'

/**
 * ⚙️ 플랫폼 설정의 **설정 한 줄** — [설명 | 입력] 레이아웃 한 벌.
 *
 * ## 🩸 2026-09-28 — 폰에서 라벨이 한 글자씩 세로로 쌓였다 (대표 신고)
 *
 * 대표가 `/admin/platform-settings` 를 폰으로 열어 머니 스위치 ⑨ 를 켰는데,
 * 라벨이 **한 글자 폭**으로 짜부라져 세로로 흘렀다. 360px 실측:
 *
 * | 행 | 라벨 칸 | 제목 | 행 높이 |
 * |---|---|---|---|
 * | 머니 스위치 ⑨ (select) | **0px** | 14줄 | **1,274px** |
 * | 프로모 바 버튼 링크 (w-72) | 14px | 4줄 | 664px |
 * | 운영 정책 (w-56) | 78px | 2줄 | 155px |
 *
 * 원인은 오타가 아니라 **산수**다. 행이 `flex items-center justify-between gap-4 px-5 py-4` 이고
 * 입력이 `shrink-0` 이라, 폰 폭에서 고정분(패딩 40 + 간격 16 + 입력 288~342)을 빼면
 * 라벨에 남는 것이 **0~14px** 이다. `min-w-0` 이 붙어 있어 그만큼까지 실제로 줄어든다.
 * ⚠️ 가장 심한 것이 하필 **머니 스위치**인데, 그 `<select>` 는 선택지 문구가 길어
 * (`ON — 원장에 이미 잡힌 주문은 자동정산 건너뜀`) 고유 폭이 342px 라 라벨 몫이 0 이 된다.
 * PC(1280px)에서는 멀쩡해서 **개발 중에는 절대 안 보인다.**
 *
 * ## 그래서 부품으로 뽑았다
 * 같은 모양이 이 페이지에만 네 군데(기본 설정 · 커미션 예산 · 운영 정책 · 프로모 바)라
 * 클래스를 네 번 고치면 **다음에 한 줄 더 늘 때 또 샌다.** 레이아웃은 여기 한 곳에만 둔다.
 *
 * - 좁으면 세로로 쌓고(`flex-col`), `sm`(640px)부터 종전 [설명 … 입력] 한 줄로 돌아간다.
 * - **입력 폭은 호출부가 정한다** — 필드마다 다르고(숫자 28 · 경로 72 · 색 40) 그건 이 부품의 일이 아니다.
 *   다만 좁을 때 `w-full` 로 펴지도록 호출부가 `w-full sm:w-28` 형태로 쓴다.
 *
 * ## ⚠️ 이 부품이 **못** 하는 것
 * - 실제 픽셀은 브라우저가 판정한다. jsdom 은 레이아웃이 없어 "라벨이 짜부라졌나"를 못 잰다 —
 *   시험은 *클래스가 붙어 있는가*만 보고, 폭은 프레임 캡처로 확인했다.
 * - 어드민의 **다른 화면들**은 여전히 같은 클래스를 쓴다(이번 범위는 대표가 실제로 부딪힌
 *   플랫폼 설정 한 장이다). 다른 화면이 신고되면 같은 방식으로 옮기면 된다.
 *
 * 🚫 어드민은 **라이트 고정**이라 `dark:` 를 붙이지 않는다(`check-dashboard-theme`).
 */
export default function SettingRow({
  label,
  hint,
  children,
  as = 'div',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  /** 입력이 하나뿐인 행은 `label` 로 감싸면 설명을 눌러도 포커스가 간다. */
  as?: 'div' | 'label'
}) {
  const Tag = as
  return (
    <Tag className="flex flex-col items-stretch gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0 block">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint ? <span className="block text-xs text-gray-400 mt-0.5">{hint}</span> : null}
      </span>
      {children}
    </Tag>
  )
}

/**
 * 설정 행의 입력에 쓰는 기본 클래스 — 좁으면 꽉 차고, `sm` 부터 호출부가 준 폭으로 돌아간다.
 * `w` 에는 `sm:` 붙은 폭을 준다(예: `'sm:w-72'`). 안 주면 내용 폭(select 등).
 */
export const settingControlCls = (w?: string, extra = '') =>
  `w-full ${w ? `${w} ` : ''}sm:shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium${extra ? ` ${extra}` : ''}`
