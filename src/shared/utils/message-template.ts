/**
 * Message Template — 변수 치환 로직
 *
 * Phase 2-1 의 agency-messages.routes.ts 가 이 함수들을 사용.
 *
 * 지원 변수 (대소문자 무관, 띄어쓰기 무시):
 *   {{seller_name}}          — 셀러 이름 (담당자명)
 *   {{seller_business_name}} — 셀러 사업자명
 *   {{seller_email}}         — 셀러 이메일
 *   {{seller_tier}}          — 셀러 등급 (브론즈/실버/골드)
 *   {{agency_name}}          — 에이전시 이름
 *   {{commission_rate}}      — 수수료율 (%)
 *   {{current_month}}        — 이번 달 (YYYY-MM)
 *   {{current_date}}         — 오늘 날짜 (YYYY-MM-DD)
 *   {{custom_link}}          — 커스텀 링크 URL
 */

import { tierLabel } from './agency-tier';

export interface TemplateContext {
  seller_name?: string | null;
  seller_business_name?: string | null;
  seller_email?: string | null;
  seller_tier?: string | null;
  agency_name?: string | null;
  commission_rate?: number | string | null;
  custom_link?: string | null;
  /** 추가 변수 (이름 prefix 검증용) */
  [key: string]: string | number | null | undefined;
}

const ALLOWED_VARIABLES = [
  'seller_name',
  'seller_business_name',
  'seller_email',
  'seller_tier',
  'agency_name',
  'commission_rate',
  'current_month',
  'current_date',
  'custom_link',
] as const;

export type AllowedVariable = (typeof ALLOWED_VARIABLES)[number];

export const ALLOWED_VARIABLE_LIST: ReadonlyArray<AllowedVariable> = ALLOWED_VARIABLES;

/**
 * 본문에서 사용된 변수 목록 추출 (검증/UI 미리보기용).
 */
export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi) || [];
  return Array.from(new Set(
    matches.map(m => m.replace(/[{}\s]/g, '').toLowerCase())
  ));
}

/**
 * 본문에서 사용된 알려지지 않은 변수 (typo 검출).
 */
export function findUnknownVariables(body: string): string[] {
  const used = extractVariables(body);
  const allowed = ALLOWED_VARIABLES as ReadonlyArray<string>;
  return used.filter(v => !allowed.includes(v));
}

/**
 * 본문 + context → 치환된 문자열.
 *
 * 미정의 변수는 빈 문자열로 치환 (조용히 무시 — 발송 막지 않음).
 * 단, findUnknownVariables() 로 사전 검증 권장.
 */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const currentMonth = currentDate.slice(0, 7);        // YYYY-MM

  const tierKor = ctx.seller_tier ? tierLabel(ctx.seller_tier as string) : '';

  return body.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_match, key: string) => {
    const k = key.toLowerCase();
    switch (k) {
      case 'seller_name': return String(ctx.seller_name ?? '');
      case 'seller_business_name': return String(ctx.seller_business_name ?? '');
      case 'seller_email': return String(ctx.seller_email ?? '');
      case 'seller_tier': return tierKor;
      case 'agency_name': return String(ctx.agency_name ?? '');
      case 'commission_rate': return String(ctx.commission_rate ?? '');
      case 'current_month': return currentMonth;
      case 'current_date': return currentDate;
      case 'custom_link': return String(ctx.custom_link ?? '');
      default:
        // 알려지지 않은 변수 — 빈 문자열 (자세한 변수는 위 ALLOWED_VARIABLES 참조)
        return '';
    }
  });
}
