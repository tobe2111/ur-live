/**
 * 🏭 BIZ-7 (2026-06-08) — 유통사 등급 자동화 (GMV 기반 auto-grade).
 *
 * 현재 도매몰 유통사 등급(sellers.distributor_grade)은 100% 수동 배정.
 * 이 cron 은 유통사별 최근 N일(기본 90일) 도매 GMV 를 집계해
 * 설정된 임계값(threshold)에 따라 목표 등급으로 **승급(promote)만** 자동 적용한다.
 *
 * ⚠️ 가격 산식 불변(ADDITIVE): 이 cron 은 distributor_grade 컬럼만 바꾼다.
 *    기존 가격 엔진(distributor-pricing.ts / wholesale.routes)이 이미 이 컬럼을 읽어 등급별 마진을 적용 →
 *    여기서 마진/가격 로직을 일절 건드리지 않는다. (가격 계산은 다른 잠긴 파일이 담당)
 *
 * 설계 결정:
 *   - **승급 전용(promote-only)**: v1 은 자동 강등(demote)을 하지 않는다.
 *     매출이 일시적으로 떨어졌다고 자동 강등하면 (가격이 올라) 유통사 신뢰/매출에 직접 타격 →
 *     강등은 어드민 수동(PATCH /distributors/:id)으로만. (자동 강등은 향후 follow-up — 유예기간/통지 설계 필요)
 *   - **마스터 enable 플래그**: platform_settings.wholesale_auto_grade_enabled ('1'=on, default '0'=off).
 *     off 면 cron 은 no-op (GMV 집계조차 안 함) → 안전 기본값.
 *   - **임계값 설정**: platform_settings.wholesale_auto_grade_thresholds (JSON).
 *     [{ "grade": "A", "min_gmv": 50000000 }, { "grade": "B", "min_gmv": 20000000 }, ...]
 *     min_gmv 가 높은 순(좋은 등급)으로 평가 — GMV 가 임계값 이상이면 그 등급이 목표.
 *   - **per-seller fail-soft**: 한 유통사 처리 실패가 배치 전체를 중단시키지 않는다.
 *   - **CAS UPDATE**: WHERE distributor_grade != target → 멱등(이미 목표 등급이면 no-op).
 *   - 변경 시: writeAuditLog(wholesale_grade_auto_promote) + dashboard_notification(유통사).
 *
 * 호출:
 *   - cron (worker/scheduled.ts, 주 1회 월요일 배치)
 *   - 어드민 수동 트리거 (distributor-admin.routes POST /auto-grade/run)
 *
 * TODO(BIZ-7 follow-up): 사업자번호 진위 1차검증 — 국세청 사업자등록상태 조회 API 연동.
 *   현재 미연동(스텁). 자동 승급 전 사업자 verified 게이트를 두려면 여기서 검증 후 skip.
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

// platform_settings 키 (SSOT — 어드민 endpoint 와 동일 리터럴 사용).
export const AUTO_GRADE_ENABLED_KEY = 'wholesale_auto_grade_enabled';
export const AUTO_GRADE_THRESHOLDS_KEY = 'wholesale_auto_grade_thresholds';
export const AUTO_GRADE_WINDOW_DAYS_KEY = 'wholesale_auto_grade_window_days';
export const AUTO_GRADE_LAST_RUN_KEY = 'wholesale_auto_grade_last_run';

// 자동 승급 대상 등급 — distributor-admin ASSIGNABLE 과 동일(SPECIAL/OEM 제외: OEM 은 사업유형, SPECIAL 은 기간한정).
//   GMV→등급 매핑은 A(최상)~D 단계만. 등급 우선순위(높을수록 좋은 등급 = 낮은 마진).
const GRADE_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
const DEFAULT_GRADE_RANK = 0; // 미배정(null) 또는 OEM/SPECIAL 등은 비교 기준 0 (승급 비교에서 "가장 낮음" 취급은 아래에서 별도 처리)

// 기본 임계값 — 설정이 없거나 깨졌을 때 fallback (원 단위 GMV).
export const DEFAULT_THRESHOLDS: { grade: string; min_gmv: number }[] = [
  { grade: 'A', min_gmv: 50_000_000 },
  { grade: 'B', min_gmv: 20_000_000 },
  { grade: 'C', min_gmv: 5_000_000 },
  { grade: 'D', min_gmv: 0 },
];

const DEFAULT_WINDOW_DAYS = 90;

export interface ThresholdRow { grade: string; min_gmv: number }

/** JSON 문자열을 임계값 배열로 파싱 + 검증. 깨졌으면 기본값. min_gmv 내림차순 정렬. */
export function parseThresholds(raw: string | null | undefined): ThresholdRow[] {
  if (!raw) return [...DEFAULT_THRESHOLDS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_THRESHOLDS];
    const valid: ThresholdRow[] = [];
    for (const r of parsed) {
      const grade = String(r?.grade ?? '').toUpperCase();
      const minGmv = Number(r?.min_gmv);
      if (!GRADE_RANK[grade]) continue; // A/B/C/D 만 허용
      if (!Number.isFinite(minGmv) || minGmv < 0) continue;
      valid.push({ grade, min_gmv: Math.floor(minGmv) });
    }
    if (!valid.length) return [...DEFAULT_THRESHOLDS];
    // 좋은 등급(높은 min_gmv) 우선 — 평가 시 위에서부터 첫 매칭.
    valid.sort((a, b) => b.min_gmv - a.min_gmv);
    return valid;
  } catch {
    return [...DEFAULT_THRESHOLDS];
  }
}

/** GMV 를 목표 등급으로 매핑. 어떤 임계값도 못 넘으면 null(승급 없음). */
export function gmvToGrade(gmv: number, thresholds: ThresholdRow[]): string | null {
  for (const t of thresholds) {
    if (gmv >= t.min_gmv) return t.grade;
  }
  return null;
}

/** 등급 비교 — target 이 current 보다 더 좋은(승급) 등급인지. current 가 null/미배정이면 어떤 ABCD 든 승급. */
export function isPromotion(current: string | null, target: string): boolean {
  const targetRank = GRADE_RANK[target] ?? DEFAULT_GRADE_RANK;
  if (!targetRank) return false; // target 이 A/B/C/D 가 아니면 승급 아님(안전)
  const cur = (current || '').toUpperCase();
  // OEM/SPECIAL 같은 특수 등급은 자동 승급 대상에서 제외(건드리지 않음).
  if (cur === 'OEM' || cur === 'SPECIAL') return false;
  const currentRank = GRADE_RANK[cur] ?? DEFAULT_GRADE_RANK; // 미배정/알수없음 = 0
  return targetRank > currentRank;
}

async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null);
  return row?.value ?? null;
}

async function writeSetting(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(key, value).run().catch(swallow('wholesale-grade-eval:write-setting'));
}

export interface GradeEvalResult {
  enabled: boolean;
  evaluated: number;
  promoted: number;
  windowDays: number;
  ran: boolean; // false = enable 플래그 off 로 skip
}

/**
 * 메인 평가 함수. cron + 어드민 수동 트리거가 공유.
 * @param force enable 플래그를 무시하고 강제 실행(어드민 "지금 실행"). 단 변경은 동일 규칙(승급 전용).
 */
export async function evaluateWholesaleGrades(env: Env, force = false): Promise<GradeEvalResult> {
  const DB = env.DB;
  const out: GradeEvalResult = { enabled: false, evaluated: 0, promoted: 0, windowDays: DEFAULT_WINDOW_DAYS, ran: false };
  if (!DB) return out;

  const enabledRaw = await readSetting(DB, AUTO_GRADE_ENABLED_KEY);
  const enabled = enabledRaw === '1' || enabledRaw === 'true';
  out.enabled = enabled;
  if (!enabled && !force) {
    // off → no-op (집계조차 안 함). 안전 기본값.
    return out;
  }
  out.ran = true;

  const thresholds = parseThresholds(await readSetting(DB, AUTO_GRADE_THRESHOLDS_KEY));
  const windowRaw = Number(await readSetting(DB, AUTO_GRADE_WINDOW_DAYS_KEY));
  const windowDays = Number.isFinite(windowRaw) && windowRaw >= 1 && windowRaw <= 365 ? Math.floor(windowRaw) : DEFAULT_WINDOW_DAYS;
  out.windowDays = windowDays;
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

  // 도매 유통사 = distributor_grade 가 이미 있거나 도매 주문을 한 셀러.
  //   대상: 등급이 배정됐거나(현 등급 기준 승급 후보) 또는 최근 윈도우 내 도매 주문이 있는 유통사.
  const sellers = await DB.prepare(`
    SELECT DISTINCT s.id, s.distributor_grade
    FROM sellers s
    WHERE COALESCE(s.is_active, 1) = 1
      AND (
        s.distributor_grade IS NOT NULL
        OR s.id IN (
          SELECT DISTINCT wo.distributor_seller_id FROM wholesale_orders wo
          WHERE wo.created_at >= ?
        )
      )
  `).bind(since).all<{ id: number; distributor_grade: string | null }>()
    .catch(() => ({ results: [] as Array<{ id: number; distributor_grade: string | null }> }));

  if (!sellers.results?.length) {
    await writeSetting(DB, AUTO_GRADE_LAST_RUN_KEY, new Date().toISOString());
    return out;
  }

  for (const s of sellers.results) {
    try {
      // trailing-window GMV — statements 집계와 동일한 status 집합 + (subtotal - 환불액).
      //   포함: PAID/SHIPPED/PARTIAL_REFUNDED/DONE/ON_CREDIT. 제외: PENDING/FAILED/CANCELLED/REFUNDED/EXPIRED.
      const gmvRow = await DB.prepare(`
        SELECT COALESCE(SUM(MAX(0, subtotal - COALESCE(refunded_amount, 0))), 0) AS gmv
        FROM wholesale_orders
        WHERE distributor_seller_id = ?
          AND status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT')
          AND COALESCE(paid_at, created_at) >= ?
      `).bind(s.id, since).first<{ gmv: number }>().catch(() => null);

      const gmv = Number(gmvRow?.gmv ?? 0);
      const target = gmvToGrade(gmv, thresholds);
      out.evaluated++;
      if (!target) continue;
      if (!isPromotion(s.distributor_grade, target)) continue;

      // CAS — 이미 target 이면 no-op. 동시에 어드민이 바꿔도 != target 가드로 안전.
      const res = await DB.prepare(
        `UPDATE sellers SET distributor_grade = ?, updated_at = datetime('now')
         WHERE id = ? AND COALESCE(distributor_grade,'') != ?`
      ).bind(target, s.id, target).run().catch(() => null);

      if (!res || (res.meta?.changes ?? 0) === 0) continue;
      out.promoted++;

      // 감사로그 (cron 은 Context 가 없어 직접 INSERT — writeAuditLog 와 동일 테이블/컬럼).
      await DB.prepare(`
        INSERT INTO admin_audit_logs (admin_id, admin_email, action, target_type, target_id, before_value, after_value, ip, user_agent)
        VALUES ('system:cron', NULL, 'wholesale_grade_auto_promote', 'seller', ?, ?, ?, NULL, 'cron:wholesale-grade-eval')
      `).bind(
        String(s.id),
        JSON.stringify({ grade: s.distributor_grade ?? null }),
        JSON.stringify({ grade: target, gmv, window_days: windowDays }),
      ).run().catch(swallow('wholesale-grade-eval:audit'));

      // 유통사 대시보드 알림.
      await DB.prepare(`
        INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
        VALUES ('seller', ?, 'wholesale_grade_up', ?, ?, '/wholesale', datetime('now'))
      `).bind(
        String(s.id),
        `🏭 도매 등급 상승: ${target}등급`,
        `최근 ${windowDays}일 도매 거래액 ${Math.round(gmv).toLocaleString('ko-KR')}원 달성 — ` +
        `등급이 ${s.distributor_grade || '미배정'} → ${target} 로 자동 상승했습니다. 더 좋은 공급가가 적용됩니다.`,
      ).run().catch(swallow('wholesale-grade-eval:notif'));
    } catch (err) {
      // per-seller fail-soft — 한 건 실패가 배치를 중단시키지 않는다.
      console.error(`[cron:wholesale-grade-eval] seller ${s.id}:`, err);
    }
  }

  await writeSetting(DB, AUTO_GRADE_LAST_RUN_KEY, new Date().toISOString());
  console.info(`[cron:wholesale-grade-eval] evaluated=${out.evaluated} promoted=${out.promoted} window=${windowDays}d`);
  return out;
}

/** cron 진입점 (scheduled.ts 에서 호출). */
export async function handleWholesaleGradeEval(env: Env): Promise<void> {
  await evaluateWholesaleGrades(env, false);
}
