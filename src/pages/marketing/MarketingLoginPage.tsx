/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 코스믹 로그인 페이지 (/ads/login).
 *
 *   배경: 기존엔 /ads 의 '로그인'이 도매몰풍 'SELLER STUDIO'(/seller/login)로 튕겨 유어애즈
 *   브랜드 밖으로 나가 "로그인이 없는 것처럼" 느껴졌음(대표 신고). 이 페이지는 유어애즈 코스믹
 *   정체성 안에서 로그인을 제공한다.
 *
 *   ⚠️ 새 인증 백엔드 없음 — 기존 셀러 카카오 OAuth(`/auth/kakao/start?redirect=…&intent=seller`,
 *   CSRF state 서명 + safeRedirect)를 그대로 구동. 카카오 1회로 사업자 유저(셀러) 권한 자동 연결/신청.
 *   서비스 분리 룰 준수: 유어딜/도매몰 파일 무수정, marketing surface 안에서만 추가.
 *   이메일 셀러 로그인은 기존 /seller/login 폴백 링크로 보존.
 */
import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

const DEFAULT_DEST = '/ads/dashboard'

const SCOPED_CSS = `
.ua-login{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(120% 100% at 50% -10%,#101A36 0%,#0A0E1C 42%,#06080F 100%);
  font-family:Pretendard,system-ui,-apple-system,sans-serif;color:#E7ECF7;}
.ua-login a{text-decoration:none;}
.ua-login-card{width:100%;max-width:400px;background:#0E1322;border:1px solid #1B2233;border-radius:20px;
  padding:34px 28px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);}
.ua-login-kakao{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
  padding:15px;border-radius:13px;background:#FEE500;color:#191600;font-size:15px;font-weight:800;
  transition:filter .15s,transform .05s;}
.ua-login-kakao:hover{filter:brightness(.96);}
.ua-login-kakao:active{transform:translateY(1px);}
.ua-login-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:#7E8AA8;}
`

export default function MarketingLoginPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // 복귀 목적지: ?next= 가 /ads 표면이면 그대로, 아니면 대시보드(스코프 제한 = open-redirect 방지).
  const nextRaw = params.get('next') || ''
  const dest = /^\/ads(\/|$)/.test(nextRaw) ? nextRaw : DEFAULT_DEST

  // 이미 로그인(셀러 토큰)이면 바로 대시보드로.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('seller_token')) {
      navigate(dest, { replace: true })
    }
  }, [navigate, dest])

  // ⚠️ intent=user (intent=seller 아님): intent=seller 면 카카오 콜백 스마트리다이렉트가 셀러 미보유 유저를
  //   유어딜 '셀러 가입'(/seller/register/business)으로, 판매사(is_distributor)를 도매몰(/wholesale)로 보냄
  //   → 유어애즈 밖으로 튕김(대표 신고). intent=user 면 redirectTarget(/ads/dashboard)이 그대로 유지되고,
  //   사업자(셀러) 계정이 있는 유저는 issueLinkedRoleTokens(intent 무관)가 seller_token 을 그대로 발급 →
  //   유어애즈 대시보드 정상 진입. 미보유 유저는 대시보드의 '사업자 인증 필요' 카드로 안내.
  const kakaoHref = `/auth/kakao/start?redirect=${encodeURIComponent(dest)}&intent=user`
  const emailHref = `/seller/login?returnUrl=${encodeURIComponent(dest)}`

  return (
    <div className="ua-login">
      <SEO title="유어애즈 로그인 - UR Ads" description="카카오 한 번으로 유어애즈를 시작하세요. 네이버 검색광고 자동입찰·통합 실적·AI 마케터." url="/ads/login" />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <div className="ua-login-card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#fff' }}><UrAdsLogo size={30} /></Link>
        </div>

        <p className="ua-login-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · SIGN IN</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#fff' }}>
          유어애즈 시작하기
        </h1>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#9AA6C2' }}>
          카카오 한 번이면 됩니다. 검색광고 자동입찰·통합 실적·AI 마케터를 바로 사용하세요.
        </p>

        <a href={kakaoHref} className="ua-login-kakao" style={{ marginTop: 24 }}>
          <span style={{ fontSize: 17 }}>💬</span> 카카오로 로그인 / 시작하기
        </a>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, lineHeight: 1.6, color: '#6F7B98' }}>
          카카오 계정 하나로 로그인하면 사업자(셀러) 권한이 자동으로 연결돼요.<br />
          유어딜 판매·셀러 대시보드와 같은 계정으로 이어집니다.
        </p>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #1B2233', textAlign: 'center' }}>
          <a href={emailHref} style={{ fontSize: 13, color: '#9AA6C2', fontWeight: 500 }}>
            기존 이메일 셀러 계정으로 로그인 →
          </a>
        </div>
      </div>
    </div>
  )
}
