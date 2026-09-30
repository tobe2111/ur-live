/**
 * ⚙️ 설정 · 고객지원 구역 — **접이식이 아니다** (2026-09-30 대표 확정).
 *
 * 대표: *"설정 및 고객지원도 왜 굳이 열고 닫게 해두는거지? 설정 고객지원 이 부분 좀 가시적이지
 * 않아 보는데에 불편해."*
 *
 * ## 접었던 이유와, 그 이유가 사라진 이유
 * 2026-06-19 에 접은 건 *"마이가 번잡하다"* 였다. 그때 이 페이지엔 구역이 다섯이었고 설정 패널이
 * 맨 아래에서 세로를 길게 먹었다. 그런데 같은 날(09-30) **수익·추천과 바로 가기 구역이 빠져서**
 * 구역이 셋이 됐다 — 접어서 아낄 세로가 더는 병목이 아니다. 그리고 접힌 줄은 *"여기 뭔가 있다"*
 * 고만 말하고 무엇인지 안 말한다: 알림을 끄러 온 사람이 한 번 더 눌러야 한다.
 *
 * ⚠️ 되돌린다면 `FoldRow` 와 `open` 상태를 되살리면 된다(한 블록). 다만 그때 이 구역의 자식이
 *   다시 길어졌는지를 먼저 볼 것 — 접기는 *길이*에 대한 처방이지 기본값이 아니다.
 * 🗝️ 옛 저장키 `ur_my_settings_open_v1` 은 이제 아무도 안 읽는다(지우는 코드도 두지 않는다 —
 *   남의 브라우저 저장소를 청소하는 코드는 그 자체로 위험하고, 몇 바이트다).
 */
import type { ReactNode } from 'react'
import { SectionTitle } from './list-grammar'

export default function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    /* 🧱 가로 패딩 없음: 줄·패널이 자기 `px-4` 를 갖는다. */
    <div className="ur-content-medium lg:px-4">
      <SectionTitle>설정 · 고객지원</SectionTitle>
      <div>{children}</div>
    </div>
  )
}
