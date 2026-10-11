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
/**
 * ✏️ 2026-10-11 **재조준** — 프로필 편집이 `AccountControlsSection`(모달)에서 A-2 시트로 옮겨갔다.
 *   불변식은 하나도 안 바뀐다(사진 즉시 저장 · 실패 되돌림 · 전화번호 필수·형식 · 라벨=제목).
 *   앵커만 옮긴다 — 지우면 그 다섯이 소리 없이 사라진다.
 */
const EDIT = 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx'
const GONE_MODAL = 'src/pages/user-profile/AccountControlsSection.tsx'

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
    /* 🩸 재조준(2026-10-11): 종전엔 모달 소스에서 `accountSettings.editProfile` 과 그 뒤 80자 안의
       '프로필 편집' 을 찾았다. 시트는 그 자리를 한국어 리터럴로 쓰므로(소비자 화면 관용구 —
       i18n 강제는 셀러 대시보드 범위다) 같은 모양이 성립하지 않는다. 지키려던 것은 *어떤 키를
       쓰는가* 가 아니라 **행을 눌러 열린 것의 제목이 행에 적힌 말과 같은가** 다 ⇒ ko locale 값과
       시트가 실제로 그리는 제목을 대조한다. */
    const ko = JSON.parse(src('public/locales/ko/translation.json'))
    const c = code(EDIT)
    /* 🔑 **같은 키**를 쓰는지 본다 — 같은 한국어를 두 곳에 손으로 적으면 한쪽만 고치는 날이 온다
       (그리고 locale 값이 `defaultValue` 를 이기므로 리터럴 대조는 화면을 보장하지 못한다). */
    const title = c.match(/<h3[^>]*>\{([^}]*editProfile[^}]*)/)
    expect(title, '시트 제목이 행 라벨과 같은 키를 쓰지 않는다').toBeTruthy()
    expect(c, 'aria-label 도 같은 키여야 한다').toMatch(/aria-label=\{t\('userProfile\.editProfile'/)
    expect(code(MY), '행 라벨이 다른 키를 쓴다').toContain("userProfile.editProfile")
    expect(ko.userProfile.editProfile).toBe('프로필 편집')
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

  it('🔴 편집하는 자리가 **하나**다 — 옛 모달이 되살아나지 않는다', () => {
    const c = code(GONE_MODAL)
    expect(c, '옛 ProfileEditModal 이 되살아났다 — 이름이 두 곳이 된다').not.toContain('ProfileEditModal')
    expect(code(MY), '마이가 아직 옛 모달을 렌더한다').not.toContain('<ProfileEditModal')
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
    const up = c.slice(c.indexOf('async function uploadPhoto'), c.indexOf('async function patch'))
    expect(up.length, '업로드 블록을 못 잘랐다 — 함수 이름이 바뀌었다').toBeGreaterThan(200)
    /* 🩸 재조준 직후 **헛돌았다**: '전화번호' 리터럴만 찾았는데, 주입이 i18n 키
       (`accountSettings.phoneRequired`)로 게이트를 심으니 통과했다(주입 러너가 잡았다).
       ⇒ 지키려는 것은 *그 한국어가 없는가* 가 아니라 **업로드가 전화번호를 전혀 모르는가** 다. */
    expect(up, '사진 업로드가 전화번호에 묶였다').not.toMatch(/phone/i)
    expect(up).not.toContain('전화번호')
    expect(up).not.toMatch(/01\[016789\]/)
  })

  it('🔴 올리다 실패하면 **되돌린다** (사진이 바뀐 것처럼 남으면 안 된다)', () => {
    const c = code(EDIT)
    expect(c).toMatch(/const prev = image/)
    expect(c).toMatch(/setImage\(prev\)/)
  })

  it('🔴 전화번호 필수·형식 검증은 **그대로**다 (교환권 MMS 가 그 번호로 간다)', () => {
    const c = code(EDIT)
    expect(c).toContain('전화번호를 입력해주세요')
    expect(c).toMatch(/\^01\[016789\]/)
  })
})
