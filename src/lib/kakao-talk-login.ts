/**
 * 📱 카카오톡 간편로그인 (2026-10-11 대표 — 다른 서비스는 카톡 앱으로 바로 동의 화면이 뜨는데
 *    유어딜은 카카오 아이디·비밀번호 창이 뜬다 → *"모두 가장 이상적으로 고치자"*)
 *
 * 왜 달랐나: 유어딜은 서버가 `kauth.kakao.com/oauth/authorize` 로 **웹 이동**을 시켰다. 그 브라우저에
 *   카카오 로그인 기록이 없으면 웹 로그인 창(아이디·비밀번호)이 뜬다. 카카오 JS SDK 의
 *   `Kakao.Auth.authorize()` 는 폰에서 **카카오톡 앱을 실행해 간편로그인**을 하고, 카톡이 없으면
 *   스스로 웹 로그인으로 넘어간다(카카오 공식 문서).
 *
 * 무엇을 바꾸지 않나: 인가 코드가 돌아오는 주소(`/auth/kakao/sync/callback`)·state 서명·쿠키·
 *   세션 발급은 **그대로**다. 서버 `/auth/kakao/start?mode=sdk` 가 평소와 같은 state 를 만들고 쿠키를
 *   심은 뒤 이동 대신 값만 돌려주고, 이동을 SDK 가 한다.
 *
 * 🔑 미리 준비한다(클릭 때 하지 않는다): 앱 실행은 **사용자 탭 안에서** 일어나야 브라우저가 막지 않는다.
 *   클릭 뒤에 SDK 를 받고 서버를 기다리면 그 순간이 지나 버린다. 그래서 로그인 화면이 뜰 때 미리
 *   준비하고, 클릭 때 준비가 안 됐으면 **종전 웹 이동**으로 간다(로그인이 막히는 일은 없다).
 *
 * 📱 안드로이드·아이폰 일반 브라우저: 다른 앱 안의 브라우저(카톡·인스타 등)는 앱 실행이 막히거나 이미
 *   카카오에 로그인돼 있어 종전 방식이 낫다.
 * 🍎 아이폰은 2026-05-04 에 SDK 를 **화면과 함께** 받다가 사파리가 멈춘 사고가 있었다(대표 *"아이폰도
 *   일단은 해줘"* 로 켜면서) — 그래서 아이폰은 첫 화면이 다 그려진 뒤(IOS_PREPARE_DELAY_MS)에 받는다.
 *   클릭이 그보다 빠르면 준비 전이라 종전 웹 이동으로 간다(막히지 않는다).
 */
import { ensureKakaoSdk } from './kakao-sdk'
import { detectInAppBrowser, isAndroid, isIOS } from './in-app-browser'

interface TalkLoginTicket { state: string; redirectUri: string; scope: string }

let ready: TalkLoginTicket | null = null
let preparing: Promise<void> | null = null

/** 아이폰은 첫 화면을 다 그린 뒤 SDK 를 받는다(2026-05-04 사파리 멈춤 사고). */
export const IOS_PREPARE_DELAY_MS = 1500

/** 카톡 간편로그인을 시도할 환경인가 — 폰(안드로이드·아이폰) · 다른 앱 안 브라우저 아님 · SDK 키 있음. */
export function canUseTalkLogin(): boolean {
  try {
    if (!import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY) return false
    return (isAndroid() || isIOS()) && detectInAppBrowser() === null
  } catch {
    return false
  }
}

/** 로그인 화면이 쓰는 입구 — 아이폰은 늦춰서, 안드로이드는 바로 준비한다. 반환값은 정리 함수. */
export function scheduleTalkLoginPrepare(redirect: string): () => void {
  if (!isIOS()) { void prepareTalkLogin(redirect); return () => {} }
  const id = window.setTimeout(() => { void prepareTalkLogin(redirect) }, IOS_PREPARE_DELAY_MS)
  return () => window.clearTimeout(id)
}

/** 로그인 화면이 뜰 때 한 번 — SDK 와 서버 state 를 미리 받아 둔다. 실패는 조용히(종전 방식이 남는다). */
export function prepareTalkLogin(redirect: string, intent: 'user' | 'seller' = 'user'): Promise<void> {
  if (preparing) return preparing
  const q = new URLSearchParams({ mode: 'sdk', redirect, intent })
  preparing = Promise.all([
    fetch(`/auth/kakao/start?${q.toString()}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)) as Promise<{ success?: boolean; data?: TalkLoginTicket } | null>,
    ensureKakaoSdk(),
  ])
    .then(([res]) => {
      const d = res?.data
      if (res?.success && d?.state && d?.redirectUri) ready = d
    })
    .catch(() => { ready = null })
  return preparing
}

/**
 * 클릭 안에서 **동기로** 부른다. 준비가 끝났으면 카톡 간편로그인을 열고 true,
 * 아니면 아무것도 안 하고 false — 호출부가 종전 웹 이동으로 간다.
 */
export function startTalkLogin(): boolean {
  const t = ready
  const Kakao = (window as unknown as { Kakao?: { Auth?: { authorize?: (o: Record<string, unknown>) => void } } }).Kakao
  if (!t || typeof Kakao?.Auth?.authorize !== 'function') return false
  try {
    Kakao.Auth.authorize({
      redirectUri: t.redirectUri,
      state: t.state,
      ...(t.scope ? { scope: t.scope } : {}),
      throughTalk: true,
    })
    ready = null // state 는 1회용 — 다시 누르면 새로 받는다
    preparing = null
    return true
  } catch {
    return false
  }
}
