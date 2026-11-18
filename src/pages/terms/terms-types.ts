/**
 * 약관 문서 공통 타입 — 데이터 주도 렌더링용.
 * 정본은 국문이며, 시행일·버전은 대표 확정값(2026-07-05 · v1.0)을 사용한다.
 */
export interface TermsSection {
  /** 장(章) 구분 헤딩 — 이 섹션 앞에 표시 (예: '제1장 총칙') */
  chapter?: string
  /** 조(條) 제목 (예: '제1조 (목적)') */
  title: string
  /** 서술형 문단 */
  paras?: string[]
  /** 번호 항(項) 목록 — <ol> 렌더 */
  items?: string[]
}

export interface TermsDoc {
  title: string
  effective: string
  version: string
  /** 전문(前文) — 제1조 앞 안내 문구 */
  preamble?: string[]
  sections: TermsSection[]
  /** 하단 사업자 정보 */
  footer: string
}

// 🏢 사업자 정보 줄(`TERMS_BIZ_FOOTER`)은 2026-11-18 `./terms-biz-footer.ts` 로 옮겼다 — 이 파일은 import 0 을 지킨다(app-shared 봉투 · seller-approval-shared 시험).

/** 약관 동의 기록용 현재 버전 (가입 시 서버로 전송) */
export const TERMS_CURRENT_VERSION = '1.0'
