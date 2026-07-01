/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 이용약관 / 개인정보처리방침 (/ads/terms · /ads/privacy). 라이트.
 *   독립 서비스 전용 법적 문서(유어딜 것 링크 대체). 내용은 실제 시스템 동작에 맞춤.
 *   ⚠️ 표준 초안 — 정식 시행 전 법무 검토 권장(채팅으로 별도 고지).
 */
import { Link, useLocation } from 'react-router-dom'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

const CONTACT = 'support@ur-team.com'

interface Section { h: string; body: string[] }

const TERMS: Section[] = [
  { h: '제1조 (목적)', body: ['본 약관은 (주)유어팀(이하 "회사")이 제공하는 유어애즈(UR Ads, 이하 "서비스") 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.'] },
  { h: '제2조 (정의)', body: ['"서비스"란 네이버 검색광고 자동입찰·실적 분석·키워드 도구·부정클릭 탐지·가격/소싱 모니터링 등 마케팅 도구를 말합니다.', '"회원"이란 본 약관에 동의하고 이메일·비밀번호로 계정을 생성한 사업자를 말합니다.', '"광고 계정 연동"이란 회원이 네이버 검색광고/커머스 API 자격증명을 입력해 회사가 회원을 대신해 데이터를 조회·변경하도록 위임하는 것을 말합니다.'] },
  { h: '제3조 (약관의 효력 및 변경)', body: ['본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자와 사유를 명시하여 사전 공지합니다.'] },
  { h: '제4조 (계정)', body: ['회원은 정확한 정보로 1개의 계정을 생성하며, 계정·비밀번호 관리 책임은 회원에게 있습니다.', '타인의 명의·광고 계정을 무단 사용해서는 안 됩니다.'] },
  { h: '제5조 (서비스의 내용)', body: ['회사는 검색광고 자동입찰(목표순위 기반), 통합 실적·예산 페이싱, 연관/추세 키워드, 부정클릭 탐지 리포트, 가격·소싱 모니터링, 임계값 알림 등을 제공합니다.', '자동입찰 등 입찰가 변경 기능은 회원의 설정·실행에 따라 실제 광고비에 영향을 줄 수 있으며, 회사는 최대 입찰가 상한 등 안전장치를 제공합니다.'] },
  { h: '제6조 (회원의 의무)', body: ['회원은 네이버 검색광고/커머스 API 등 제3자 서비스의 이용약관을 준수해야 합니다.', '부정클릭 탐지용 픽셀을 자신의 사이트에 설치하는 경우, 방문자에게 개인정보 수집·위탁 사실을 고지할 의무는 회원(광고주)에게 있습니다.'] },
  { h: '제7조 (회사의 의무 및 면책)', body: ['회사는 안정적인 서비스 제공을 위해 노력합니다.', '서비스는 네이버 등 외부 API에 의존하며, 외부 API의 정책 변경·장애·데이터 정확성에 기인한 손해에 대해 회사는 책임을 지지 않습니다.', '자동입찰·추천 등은 의사결정을 돕기 위한 참고이며, 최종 집행 책임은 회원에게 있습니다.'] },
  { h: '제8조 (요금)', body: ['서비스 요금 정책은 별도 고지하며, 변경 시 사전 공지합니다.'] },
  { h: '제9조 (계약 해지)', body: ['회원은 언제든 계정 삭제를 요청할 수 있으며, 회사는 관련 법령에 따른 보관 의무가 없는 정보를 지체 없이 파기합니다.'] },
  { h: '제10조 (준거법 및 관할)', body: ['본 약관은 대한민국 법령에 따르며, 분쟁은 회사 본점 소재지 관할 법원을 제1심 관할로 합니다.'] },
]

const PRIVACY: Section[] = [
  { h: '1. 수집하는 개인정보 항목', body: ['계정: 이메일, 회사(고객사)명, 연락처(선택), 비밀번호(단방향 해시 저장 — 원문 미보관).', '광고 계정 연동: 네이버 검색광고/커머스 API 자격증명(암호화 저장).', '부정클릭 탐지(픽셀): 광고주 사이트 방문자의 IP(그룹핑용 해시 + 차단 목적의 원문), 접속 국가, 유입 경로, User-Agent.'] },
  { h: '2. 수집·이용 목적', body: ['회원 식별·로그인·고객 지원, 검색광고 실적 조회 및 자동입찰 실행, 부정클릭 탐지·차단 지원, 가격·트렌드 모니터링, 임계값 알림 이메일 발송.'] },
  { h: '3. 보유 및 이용 기간', body: ['계정 정보: 회원 탈퇴 시까지(관련 법령상 보관 의무가 있는 경우 해당 기간).', '부정클릭 클릭 이벤트: 수집일로부터 90일 후 자동 파기.', '비밀번호 재설정 토큰: 발급 후 1시간.'] },
  { h: '4. 처리 위탁 및 제3자', body: ['네이버(검색광고/오픈/커머스 API): 광고 데이터 조회·변경.', 'Resend: 알림·재설정 이메일 발송.', 'Cloudflare: 서비스 호스팅·데이터 저장(D1).', 'Anthropic: AI 마케터/리포트 생성(실적 요약 전달).', '회사는 위탁 시 개인정보가 안전하게 관리되도록 필요한 사항을 규정합니다.'] },
  { h: '5. 정보주체의 권리', body: ['회원은 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있으며, 계정 설정 또는 아래 연락처를 통해 행사할 수 있습니다.'] },
  { h: '6. 안전성 확보 조치', body: ['비밀번호 단방향 해시(PBKDF2), API 자격증명 암호화 저장(AES-GCM), 접근 권한 통제, IP 해시 처리.'] },
  { h: '7. 픽셀(부정클릭 방지) 처리 특례', body: ['픽셀은 광고주(회원)의 사이트에 설치되어 광고 유입 방문자의 접속기록을 수집하며, 회사가 위탁 처리합니다. 수집 정보는 부정클릭 탐지·차단 목적에만 사용되고 90일 후 파기됩니다. 방문자 고지 의무는 광고주에게 있습니다.'] },
  { h: '8. 개인정보 보호책임자', body: [`문의: ${CONTACT}`] },
]

export default function MarketingLegalPage() {
  useUrAdsFavicon()
  const { pathname } = useLocation()
  const isPrivacy = pathname.includes('privacy')
  const title = isPrivacy ? '개인정보처리방침' : '이용약관'
  const sections = isPrivacy ? PRIVACY : TERMS

  return (
    <div className="force-light-theme" style={{ minHeight: '100dvh', background: '#F4F5F7', color: '#0B0E14', fontFamily: 'Pretendard, system-ui, sans-serif' }}>
      <SEO title={`유어애즈 ${title} - UR Ads`} description={`유어애즈(UR Ads) ${title}`} url={isPrivacy ? '/ads/privacy' : '/ads/terms'} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#0B0E14', textDecoration: 'none' }}><UrAdsLogo size={24} /></Link>
          <Link to="/ads" style={{ fontSize: 13, color: '#565E6C', textDecoration: 'none', fontWeight: 600 }}>← 유어애즈</Link>
        </div>
        <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>유어애즈 {title}</h1>
        <p style={{ marginTop: 6, fontSize: 12.5, color: '#8A93A3' }}>UR Ads · (주)유어팀</p>

        <div style={{ marginTop: 8 }}>
          <Link to="/ads/terms" style={{ fontSize: 13, fontWeight: 700, color: isPrivacy ? '#8A93A3' : '#2A56D4', textDecoration: 'none', marginRight: 14 }}>이용약관</Link>
          <Link to="/ads/privacy" style={{ fontSize: 13, fontWeight: 700, color: isPrivacy ? '#2A56D4' : '#8A93A3', textDecoration: 'none' }}>개인정보처리방침</Link>
        </div>

        <div style={{ marginTop: 18, background: '#FFFFFF', border: '1px solid #ECEDF1', borderRadius: 16, padding: '8px 22px 22px' }}>
          {sections.map((s) => (
            <section key={s.h} style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0B0E14' }}>{s.h}</h2>
              {s.body.map((p, i) => (
                <p key={i} style={{ marginTop: 7, fontSize: 13.5, lineHeight: 1.75, color: '#3A4150' }}>{p}</p>
              ))}
            </section>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: '#9AA3B5' }}>문의: {CONTACT}</p>
      </div>
    </div>
  )
}
