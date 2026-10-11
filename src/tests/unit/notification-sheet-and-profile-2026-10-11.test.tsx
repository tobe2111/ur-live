/**
 * 🔔✏️ 마이 헤더 두 버튼 — 올라오는 알림 · 이름 있는 프로필 편집 〔2026-10-11 대표 지시〕
 *
 * 대표(마이 스크린샷, 오른쪽 위 두 버튼에 빨간 박스):
 *   *"알림 버튼을 눌렀을 때 알림 페이지가 별도로 나오는게 아니라 위에서 올라오는 형태로? 나타나면
 *   좋을 것 같고, 오른쪽 버튼은 눌렀을 때 기껏해야 이름이랑 전화번호 변경이네? 프로필 편집이라고
 *   바꾸던지, 뭔가 지금 이상적이지 않아."*
 *
 * ## 이 시험이 **못** 하는 것
 * jsdom 은 레이아웃도 애니메이션도 없다 — 시트가 실제로 아래에서 올라오는지·바닥이 잘리는지는
 * 브라우저가 판정한다. 여기서는 *무엇이 열리는가*와 *배선이 붙어 있는가*만 본다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { stripComments } from '../helpers/source-text'
import NotificationSheet from '@/components/notifications/NotificationSheet'
import { timeLabel } from '@/components/notifications/NotificationPanel'
import { Z } from '@/constants/z-index'

const src = (p: string) => fs.readFileSync(p, 'utf8')
const code = (p: string) => stripComments(src(p))

/** 모바일 벨이 사는 파일들 — 한 곳만 고치면 그 화면만 페이지로 남는다. */
const MOBILE_BELLS = [
  'src/pages/UserProfilePage.tsx',
  'src/pages/mobile-home/MobileHomePage.tsx',
  'src/pages/RestaurantMapPage.tsx',
  'src/pages/restaurant-map/MapTopBar.tsx',
  'src/components/main/HomeTopHeader.tsx',
]
const SHEET = 'src/components/notifications/NotificationSheet.tsx'
const PANEL = 'src/components/notifications/NotificationPanel.tsx'
const DROPDOWN = 'src/components/main/NotificationDropdown.tsx'
const PAGE = 'src/pages/NotificationsPage.tsx'
const MY = 'src/pages/UserProfilePage.tsx'
const EDIT = 'src/pages/user-profile/AccountControlsSection.tsx'

vi.mock('@/hooks/queries/useNotifications', () => ({
  useNotifications: () => ({
    data: [
      { id: 'n_1', type: 'order_paid', title: '결제가 완료됐어요', message: '달빛한스푼 닭도리탕', link: '/my-orders', is_read: 0, created_at: '2026-10-11 00:00:00' },
      { id: 'n_2', type: 'x', title: '읽은 알림', is_read: 1, created_at: '2026-10-10 00:00:00' },
    ],
    isLoading: false,
    isError: false,
  }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}))

const draw = (onClose = () => {}) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><NotificationSheet onClose={onClose} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => { vi.useRealTimers() })

describe('① 모바일 벨 — 페이지로 떠나지 않는다', () => {
  it('🔴 벨이 있는 **모든** 모바일 화면이 시트를 쓴다 (한 곳만 고치면 그 화면만 페이지로 남는다)', () => {
    for (const f of MOBILE_BELLS) {
      const c = code(f)
      expect(c, `${f}: useNotificationSheet 배선 없음`).toContain('useNotificationSheet')
      expect(c, `${f}: 시트를 렌더하지 않음`).toMatch(/\{\s*bell\.sheet\s*\}/)
      expect(c, `${f}: 아직 /notifications 로 이동한다`).not.toMatch(/navigate\(\s*['"]\/notifications['"]\s*\)/)
    }
  })

  it('검사 대상이 0개면 통과가 아니라 고장이다', () => {
    expect(MOBILE_BELLS.length).toBeGreaterThanOrEqual(5)
    for (const f of MOBILE_BELLS) expect(fs.existsSync(f), `${f} 없음 — 파일이 옮겨졌다`).toBe(true)
  })
})

describe('② 몸통은 하나다 — 드롭다운과 시트가 같은 것을 그린다', () => {
  it('🔴 PC 드롭다운·모바일 시트 **둘 다** 공유 패널을 쓴다', () => {
    for (const f of [SHEET, DROPDOWN]) {
      expect(code(f), `${f}: 공유 패널 미사용`).toContain('NotificationPanel')
    }
  })

  it('🔴 셸은 목록을 **스스로 그리지 않는다** (베끼면 반드시 갈린다 — 실제로 시각 표기가 갈려 있었다)', () => {
    for (const f of [SHEET, DROPDOWN]) {
      const c = code(f)
      /* 🩸 처음엔 `useNotifications(` 호출 모양으로 앵커했는데, **import 만 두는 주입이 샜다.**
         지키려는 것은 *호출하지 않는가* 가 아니라 **셸이 데이터 모듈을 쥐지 않는가** 다. */
      expect(c, `${f}: 데이터 모듈을 직접 쥔다`).not.toContain('hooks/queries/useNotifications')
      expect(c, `${f}: 읽음 처리를 직접 한다`).not.toContain('useMarkNotificationRead')
    }
  })

  /**
   * 🩸 **이 시험의 첫 판은 헛돌았다.** `new Date(iso)` 로 바꿔 놓아도 통과했는데, 러너의 TZ 가
   * UTC 라 *로컬로 읽기* 와 *UTC 로 읽기* 의 결과가 같았기 때문이다 — 픽스처가 그 경우를 담지
   * 못한 전형이다. ⇒ TZ 를 서울로 바꿔 두 해석이 **9시간 갈리게** 만든 뒤 잰다.
   */
  it('🔴 상대 시각은 **UTC-naive 를 UTC 로** 읽는다 (아니면 방금 온 알림이 9시간 전이 된다)', () => {
    expect(code(PANEL)).toContain('parseUTCDate')
    const prevTz = process.env.TZ
    process.env.TZ = 'Asia/Seoul'
    try {
      const naive = '2026-10-11 00:00:00'
      // 환경이 정말 두 해석을 가르는가 — 안 가르면 이 시험은 아무것도 못 본다.
      expect(new Date(naive).getTime(), 'TZ 가 안 먹었다 — 이 시험은 무의미하다').not.toBe(Date.parse(naive + 'Z'))
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.parse(naive + 'Z') + 5 * 60_000))
      expect(timeLabel(naive)).toBe('5분 전')
      expect(timeLabel('not-a-date')).toBe('')   // 깨진 값에 안 터진다
    } finally {
      vi.useRealTimers()
      process.env.TZ = prevTz
    }
  })

  it('🔴 `/notifications` 페이지는 **남는다** — 50개 이상 더 보기와 딥링크는 패널이 못 한다', () => {
    expect(fs.existsSync(PAGE)).toBe(true)
    expect(code(PAGE)).toContain('loadMore')
    expect(code(PANEL)).toContain("navigate('/notifications')")
  })
})

describe('③ 시트를 실제로 그려 본다', () => {
  it('🔴 알림 제목이 보이고, 누르면 닫힌다', () => {
    const onClose = vi.fn()
    draw(onClose)
    expect(screen.getByText('결제가 완료됐어요')).toBeTruthy()
    fireEvent.click(screen.getByText('결제가 완료됐어요'))
    expect(onClose).toHaveBeenCalled()
  })

  it('🔴 `전체 보기` 가 있다 (패널은 첫 페이지만 — 나머지는 페이지가 맡는다)', () => {
    draw()
    expect(screen.getByText('전체 보기 →')).toBeTruthy()
  })

  it('🔴 ESC 로 닫힌다', () => {
    const onClose = vi.fn()
    draw(onClose)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('🔴 z-index 를 손으로 적지 않는다 — 표준 스케일(하단 네비 위)', () => {
    const { container } = draw()
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(Number(dialog.style.zIndex)).toBe(Z.SHEET_BODY)
    expect(Z.SHEET_BODY).toBeGreaterThan(9999)   // 네비가 시트를 덮던 2026-06-26 사고
    expect(code(SHEET)).not.toMatch(/z-\[\d{4,}\]/)
  })

  it('🔴 바닥이 안 잘린다 — `dvh`(모바일 주소창) · safe-area', () => {
    const c = code(SHEET)
    expect(c).toContain('dvh')
    expect(c).not.toMatch(/max-h-\[\d+vh\]/)
    expect(c).toContain('safe-area-inset-bottom')
  })
})

describe('④ 프로필 — 무엇이 열리는지 말한다', () => {
  it('🔴 마이의 프로필 행이 **이름을 말한다**(맨 `>` 가 아니다)', () => {
    const c = code(MY)
    /* 🩸 첫 판은 `userProfile.editProfile` 이 소스에 있는지만 봐서 **헛돌았다** — 그 키는
       버튼의 `aria-label` 에도 쓰이므로, 눈에 보이는 글자를 통째로 지워도 통과했다(주입이 잡았다).
       ⇒ **그려지는 텍스트**(`<span>` 안)인지를 본다. 스크린리더만 아는 이름은 대표가 말한
       "무엇이 열리는지" 를 해결하지 못한다. */
    expect(c, '라벨이 aria-label 에만 있고 화면에는 없다').toMatch(/<span[^>]*>\{t\('userProfile\.editProfile'/)
  })

  it('🔴 행의 라벨과 시트 제목이 **같은 말**이다', () => {
    expect(code(EDIT)).toMatch(/accountSettings\.editProfile[\s\S]{0,80}프로필 편집/)
  })

  /**
   * 🩸 CLAUDE.md 가 경고한 바로 그 함정 — **locale 값이 `defaultValue` 를 이긴다.**
   * 코드만 '프로필 편집' 으로 고치고 ko 를 안 고치면 화면엔 계속 '프로필 수정' 이 뜬다(에러 0).
   */
  it('🔴 ko locale 이 코드의 기본값과 어긋나지 않는다', () => {
    const ko = JSON.parse(src('public/locales/ko/translation.json'))
    expect(ko.accountSettings.editProfile).toBe('프로필 편집')
    expect(ko.userProfile.editProfile).toBe('프로필 편집')
  })

  it('🔴 "기껏해야 이름이랑 전화번호" 를 실제로 해소한다 — **사진**을 바꿀 수 있다', () => {
    const c = code(EDIT)
    expect(c).toContain('uploadPhoto')
    expect(c).toContain('accept="image/*"')
    // 업로드 → 저장 → 헤더 갱신 **셋 다**. 하나라도 빠지면 바꿨는데 안 바뀐 것처럼 보인다.
    expect(c).toContain("'/api/upload/image'")
    expect(c).toContain("'/api/curator/me/profile'")
    expect(c).toContain("localStorage.setItem('user_profile_image'")
  })

  it('🔴 사진은 **고르는 즉시** 저장한다 — 전화번호 필수 검증에 막히면 안 된다', () => {
    const c = code(EDIT)
    const up = c.slice(c.indexOf('async function uploadPhoto'), c.indexOf('async function save'))
    expect(up.length).toBeGreaterThan(200)
    expect(up).not.toContain('phoneRequired')
    expect(up).not.toContain('phoneInvalid')
  })

  it('🔴 올리다 실패하면 **되돌린다** (사진이 바뀐 것처럼 남으면 안 된다)', () => {
    const c = code(EDIT)
    expect(c).toMatch(/const prev = form\.image/)
    expect(c).toMatch(/setForm\(f => \(\{ \.\.\.f, image: prev \}\)\)/)
  })

  it('🔴 전화번호 필수·형식 검증은 **그대로**다 (교환권 MMS 가 그 번호로 간다)', () => {
    const c = code(EDIT)
    expect(c).toContain('phoneRequired')
    expect(c).toMatch(/\^01\[016789\]/)
  })
})
