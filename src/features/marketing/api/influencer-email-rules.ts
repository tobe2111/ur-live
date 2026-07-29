/**
 * 📧 인플루언서 **이메일 판정 규칙 SSOT** — 순수 함수만(DB·fetch 무접촉).
 *
 *   `influencer-performance.ts` 에서 분리(2026-07-29). 그 파일은 성과 수집(외부 fetch + D1)이 본업인데
 *   이 규칙들은 **입력이 문자열뿐**이라 성격이 다르고, 통계(`influencer-pool-stats`)·정비
 *   (`influencer-maintenance`)·품질(`influencer-quality`) 이 각자 import 하는 공용 규칙이다.
 *   같이 두면 성과 파일이 600줄 캡을 넘고, 규칙만 고치려는 세션이 fetch 코드를 읽어야 한다.
 *
 *   ⚠️ 호출부 호환: `influencer-performance.ts` 가 이 모듈을 **재수출**하므로 기존 import 경로는 그대로 산다.
 */
import { pickBusinessEmail, extractContacts, stripVideoTitles, isPlatformLabelEmail } from './influencer-discovery'

const _reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/**
 * 🧹 기존 풀 이메일 재정리(백필) — 저장된 소개글(description)에 개선된 추출기를 재적용해 판정.
 *   반환: string=이 값으로 교체 · null=비우기(가짜 제거) · undefined=변경 없음.
 *   ① **가짜 이메일 제거**: 저장 이메일이 소개글에 문자 그대로 없고, "로컬파트 at 도메인라벨"(과거 전치사 'at'
 *      오변환 흔적)이 소개글에 있으면 날조 → 재도출값으로 교체(없으면 비움). ② 빈칸이면 재도출로 채움.
 *      ③ 대행사(비-개인도메인) 저장값 + 소개글에 개인도메인 메일 → 개인메일로 교정.
 */
export function reextractEmail(description: string | null | undefined, stored: string | null): string | null | undefined {
  const desc = stripVideoTitles(description || '') // 🏷️ 영상 제목 세그먼트(분류 전용 신호)의 타인 메일 오추출 방지
  const derived = pickBusinessEmail(desc) || extractContacts(desc).emails[0] || null // 개선된(수정된) 추출기
  if (!stored) return derived || undefined // 빈칸 채움
  // 🛡️ 소급 정리(2026-07-25): 과거 날조 저장분(insta@sunny.day 류 — 로컬파트=플랫폼 라벨)은 진짜 메일로 교체 or 비움.
  //   신규 추출기는 이 클래스를 차단하지만 재추출의 '유지' 판정이 기존 오염을 못 지우던 것 — 발송하면 전량 반송되는 값.
  if (isPlatformLabelEmail(stored)) return derived && derived !== stored ? derived : null
  const s = stored.toLowerCase(); const [local, domain] = s.split('@'); const label = (domain || '').split('.')[0]
  const fabricated = !desc.toLowerCase().includes(s) && !!local && !!label
    && new RegExp(`${_reEsc(local)}\\s+at\\s+${_reEsc(label)}`, 'i').test(desc) // "out at naver" 류 날조 흔적
  if (fabricated) return derived && derived !== stored ? derived : null // 진짜 메일로 교체 or 비움
  if (!PERSONAL_EMAIL_RE.test(stored) && derived && PERSONAL_EMAIL_RE.test(derived)) return derived // 대행사→개인
  return undefined // 유지
}

// 개인(창작자 본인) 메일 도메인 SSOT — 대행사/MCN 코퍼레이트 메일과 구분. About 에 이 도메인 메일이 있으면 우선.
//   통계(admin-ads `yt_email_personal`)·교정(correctedAboutEmail) 둘 다 이 집합에서 파생 → 정의 드리프트 방지.
export const PERSONAL_EMAIL_DOMAINS = ['gmail', 'naver', 'daum', 'kakao', 'hanmail', 'nate', 'hotmail', 'outlook', 'icloud'] as const
const PERSONAL_EMAIL_RE = new RegExp(`@(${PERSONAL_EMAIL_DOMAINS.join('|')})\\.`, 'i')
/** 통계용 SQL 조건 — 주어진 컬럼이 개인도메인 메일인지(위 SSOT 와 동일 집합). 도메인 리터럴만이라 인젝션 무관. */
export const personalEmailSqlClause = (col = 'email'): string => PERSONAL_EMAIL_DOMAINS.map(d => `${col} LIKE '%@${d}.%'`).join(' OR ')
/** 개인(창작자 본인) 메일인가 — 위 SSOT 와 동일 판정(스코어링 등 JS 소비자용). */
export const isPersonalEmail = (email?: string | null): boolean => !!email && PERSONAL_EMAIL_RE.test(email)
/** 저장된 이메일을 최신 About 이메일로 교정할지 판단(보수적 — 값을 나쁘게 만들지 않음).
 *  대상: 저장값이 없거나(NULL) 개인도메인이 아닌 경우(대행사 co.kr 등) + About 에 개인도메인 비즈니스 메일이 있을 때만.
 *  → 채널 주인이 나중에 About 에 본인 메일을 추가한 케이스(수집 당시엔 영상설명의 대행사 메일만 잡힘)를 자동 정정. */
export function correctedAboutEmail(aboutDesc: string | undefined, stored: string | null): string | null {
  if (!aboutDesc) return null
  const fresh = pickBusinessEmail(aboutDesc)
  if (!fresh || !PERSONAL_EMAIL_RE.test(fresh) || fresh === (stored || '')) return null
  const storedIsPersonal = !!stored && PERSONAL_EMAIL_RE.test(stored)
  return storedIsPersonal ? null : fresh // 이미 개인메일이면 안 건드림(처닝 방지), 아니면(대행사/NULL) 교정
}

