/**
 * 🏢 약관 하단 사업자 정보 줄 (2026-11-18 대표 *"2번은 부산금정으로 해줘. 나중에 변경해야하니 알려줘"*).
 *
 * 종전엔 `terms-types.ts` 에 손으로 적은 문자열이었고 통신판매업 신고번호만 `제2025-서울강남-0540호` 로 갈려 있었다
 * (홈 하단·`COMPANY` 는 `2025-부산금정-0540`). 이제 값은 전부 `shared/company-info.ts` `COMPANY` 에서 읽는다 — 바꿀 곳 하나.
 * `terms-types.ts` 는 import 0 을 지켜야 해서(app-shared 봉투) 별도 파일로 뺐다. 워커(크롤러 본문·첫 화면)도 상대경로로 읽는다.
 */
import { COMPANY } from '../../shared/company-info'

export const TERMS_BIZ_FOOTER =
  `사업자 정보: 상호 ${COMPANY.brand}(${COMPANY.legalName}) · 대표자 ${COMPANY.ceo} · 사업자등록번호 ${COMPANY.bizRegNo} · 통신판매업신고 제${COMPANY.mailOrderNo}호 · 주소 ${COMPANY.address} · 연락처 ${COMPANY.email}`
