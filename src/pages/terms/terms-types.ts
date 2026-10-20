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

export const TERMS_BIZ_FOOTER =
  '사업자 정보: 상호 유어딜(리스터코퍼레이션) · 대표자 정지원 · 사업자등록번호 479-09-02930 · 통신판매업신고 제2025-서울강남-0540호 · 주소 서울특별시 강남구 남부순환로359길 14, 3층(도곡동) · 연락처 jiwon@ur-team.com'

/** 약관 동의 기록용 현재 버전 (가입 시 서버로 전송) */
export const TERMS_CURRENT_VERSION = '1.0'
