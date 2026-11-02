/**
 * 🏢 회사·사업자 정보 SSOT (2026-11-02)
 *
 * 대표 *"마이페이지 맨 밑에도 엉성하고, 대신 홈 페이지 맨 밑에 회사 정보들을 넣어줘"* + NOL 앱 참고 이미지
 * (`docs/design/home-footer-company-info-2026-11-02.md`).
 *
 * 전자상거래법 제10조(사이버몰 운영자의 표시 의무) — 상호·대표자·주소·전화/이메일·사업자등록번호·
 * 통신판매업 신고번호·호스팅 제공자를 **초기 화면에서 확인할 수 있게** 표시해야 한다. 그래서 이 값들은
 * 화면에서 **사라지면 안 되고**, 손으로 여러 곳에 적으면 갈린다(실제로 갈려 있다 — 아래 ⚠️).
 *
 * 쓰는 곳: 홈 맨 아래 `CompanyInfoFooter`(폰·PC) · `SiteFooter`(지역·지도 등 다른 화면) ·
 * 워커 `home-footer-noscript.ts`(크롤러용 같은 글자). 셋이 이 파일 하나를 읽는다.
 *
 * ⚠️ **값은 지어내지 않는다.** 없는 항목(대표 전화번호·SNS 계정)은 줄째 뺐다.
 * ⚠️ 2026-11-02 실측 — **통신판매업 신고번호가 레포 안에서 둘로 갈려 있다**:
 *    `2025-부산금정-0540`(종전 SiteFooter·noscript — 지금 홈에 보이던 값) vs
 *    `제2025-서울강남-0540호`(`pages/terms/terms-types.ts` TERMS_BIZ_FOOTER).
 *    어느 쪽이 맞는지는 대표만 안다 — 지금은 **화면에 보이던 값**을 유지하고 결재를 올렸다.
 *    사업자등록번호도 메일 템플릿 일부(`lib/system-email.ts` 등)가 `783-87-03224` 를 적고 있다.
 */
export const COMPANY = {
  brand: '유어딜',
  legalName: '리스터코퍼레이션',
  ceo: '정지원',
  bizRegNo: '479-09-02930',
  /** 공정위 사업자정보 확인 링크에 쓰는 숫자만 */
  bizRegNoDigits: '4790902930',
  mailOrderNo: '2025-부산금정-0540',
  address: '서울특별시 강남구 남부순환로359길 14, 3층(도곡동)',
  email: 'jiwon@ur-team.com',
  /** 배포가 Cloudflare Pages 하나다(CLAUDE.md 배포 아키텍처) */
  hosting: 'Cloudflare, Inc.',
  supportChannel: '카카오톡 상담',
  supportHours: '평일 10:00~18:00',
  kakaoChatUrl: 'http://pf.kakao.com/_AITdn/chat',
  copyrightYear: 2026,
} as const

/** 회사 정보 줄글 — 화면·크롤러가 **같은 줄**을 쓴다(순서 = NOL 참고 화면). */
export const COMPANY_INFO_LINES: readonly string[] = [
  `상호: ${COMPANY.legalName}`,
  `대표: ${COMPANY.ceo} | 사업자등록번호: ${COMPANY.bizRegNo}`,
  `통신판매업신고: ${COMPANY.mailOrderNo}`,
  `메일: ${COMPANY.email}`,
  `주소: ${COMPANY.address}`,
  `호스팅서비스 제공자: ${COMPANY.hosting}`,
  `고객센터: ${COMPANY.supportChannel} (${COMPANY.supportHours})`,
]

/** 공정위 사업자정보 공개 페이지(실재하는 공공 URL 형식) */
export const BIZ_INFO_CHECK_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${COMPANY.bizRegNoDigits}`

/** 약관 제3조(통신판매중개자로서의 지위)를 한 문장으로 — 문구 출처: `pages/terms/consumer-terms-content.ts` */
export const COMPANY_INTERMEDIARY_NOTICE =
  `${COMPANY.legalName}는 통신판매중개자로서 판매자가 등록한 상품·이용권의 통신판매 당사자가 아니며, 상품의 정보·이용·환불 등에 관한 의무와 책임은 각 판매자에게 있습니다. 다만 회사가 직접 판매자로 표시된 상품은 회사가 당사자입니다.`

export const COMPANY_COPYRIGHT = `© ${COMPANY.copyrightYear} ${COMPANY.legalName}. All rights reserved.`

/** 밑줄 링크 묶음 — 실재하는 라우트만. `strong` 은 개인정보처리방침(정보통신망법 관례상 굵게). */
export const COMPANY_LINKS: readonly { label: string; href: string; strong?: boolean; external?: boolean }[] = [
  { label: '서비스 소개', href: '/about' },
  { label: '광고·제휴 문의', href: '/partnership' },
  { label: '개인정보처리방침', href: '/privacy', strong: true },
  { label: '서비스 이용약관', href: '/terms' },
  { label: '판매자 약관', href: '/terms/seller' },
  { label: '배송 및 환불 정책', href: '/refund' },
  { label: '사업자 정보확인', href: BIZ_INFO_CHECK_URL, external: true },
]
