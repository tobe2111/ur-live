/**
 * Daily Self-Diagnostic Cron
 *
 * 매일 새벽 3시에 실행 (wrangler.toml 의 cron: '0 18 * * *' UTC = 3AM KST)
 * - DB latency 확인
 * - Secret 존재 확인
 * - 최근 24h 에러/느린 쿼리 통계 수집
 * - 전날 주문/결제 건수 요약
 * - 문제 발견 시 Discord 로 알림
 *
 * 1인 운영자가 자는 동안 시스템이 자동으로 자기 진단 → 이상 발견 시에만 깨움.
 */

import { sendDiscordAlert } from '../utils/discord-alert';
import type { Env } from '../types/env';

/** 토스 키 검증용 **존재하지 않는** 결제키. 조회만 하므로 부수효과 0. */
export const TOSS_KEY_PROBE_ID = 'urdeal_keyprobe_does_not_exist';

export type TossKeyVerdict = 'valid' | 'invalid' | 'unknown' | 'skipped';

/**
 * 🔑 토스 키 프로브 응답 해석 (순수 — 유닛으로 고정).
 *
 * 없는 결제키를 조회하면 **인증 결과와 데이터 유무가 상태코드로 갈린다**:
 *   - `401` → 인증 자체가 거부됐다 = **키가 잘못됐거나 폐기됨**
 *   - `404` → 인증은 통과했고 그 결제가 없을 뿐 = **키 정상**
 *   - 그 외(5xx·429 등) → 토스 쪽 사정. **키 문제로 단정하지 않는다.**
 *
 * ⚠️ 이 프로브가 **증명하지 않는 것**: 그 키로 *환불이 성공*하는지. 인증 유효성까지다.
 *   결제를 취소하려면 그 결제를 만든 키와 같은 키여야 하는데, 그건 실제 대상이 있어야 알 수 있다.
 */
export function interpretTossKeyProbe(status: number): { verdict: TossKeyVerdict; message: string } {
  if (status === 401) {
    return { verdict: 'invalid', message: 'TOSS_SECRET_KEY 인증 실패(401) — 키가 잘못됐거나 폐기됨. 환불·정합이 전부 실패한다' };
  }
  if (status === 404) {
    return { verdict: 'valid', message: '유효(404 = 인증 통과, 조회 대상만 없음)' };
  }
  return { verdict: 'unknown', message: `판정 불가(status=${status}) — 키 문제로 단정하지 말 것` };
}

export async function runDailySelfDiagnostic(env: Env) {
  const DB = env.DB;
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!DB) {
    console.error('[daily-diagnostic] No DB binding');
    return;
  }

  const issues: string[] = [];
  const info: string[] = [];

  // 1. DB latency
  try {
    const t0 = Date.now();
    await DB.prepare('SELECT 1').first();
    const latency = Date.now() - t0;
    if (latency > 500) issues.push(`⚠️ DB latency 느림: ${latency}ms (임계 500ms)`);
    else info.push(`DB latency: ${latency}ms`);
  } catch (err) {
    issues.push(`🔴 DB 연결 실패: ${(err as Error).message}`);
  }

  // 2. Secret 존재
  //   🗑️ 2026-08-02: `FIREBASE_PRIVATE_KEY` 제거. Firebase 인증 수용 경로는 2026-07-28 에 폐기됐고
  //     (`check-no-firebase-auth` 가드가 재도입을 막는다) 그 키는 더 이상 어디서도 안 쓰인다.
  //     남겨두면 **매일 새벽 3시에 거짓 🔴 경보**가 나간다 — 알림 채널을 켜는 순간 늑대소년이 된다.
  const requiredSecrets = [
    'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'KAKAO_REST_API_KEY', 'TOSS_SECRET_KEY',
  ];
  const missing = requiredSecrets.filter((k) => !(env as unknown as Record<string, unknown>)[k]);
  if (missing.length > 0) issues.push(`🔴 누락된 Secret: ${missing.join(', ')}`);

  // 2-b. 🔑 토스 키가 **실제로 유효한가** — 존재는 동작이 아니다.
  //   2026-08-02: cron 캐리어(Workers)에 키를 새로 넣었는데, 그게 맞는 값인지 확인할 방법이 없었다.
  //   그 키를 실제로 쓰는 작업(만료 환불·주문 정합)은 **대상이 생겨야** 돌기 때문에, 최악의 경우
  //   첫 실전 환불에서야 "키가 틀렸다"를 알게 된다. 그건 고객 돈이 걸린 자리다.
  //   ⇒ 존재하지 않는 결제키로 **조회 1회**를 보내 인증만 검증한다. 401=키 불량 / 404=키 정상.
  //   부수효과 0(GET, 상태 변경 없음). 키 값은 어디에도 로그하지 않는다.
  const tossKey = (env as unknown as Record<string, string | undefined>).TOSS_SECRET_KEY;
  let tossVerdict: TossKeyVerdict = 'skipped';
  if (tossKey) {
    try {
      const res = await fetch(`https://api.tosspayments.com/v1/payments/${TOSS_KEY_PROBE_ID}`, {
        headers: { Authorization: `Basic ${btoa(`${tossKey}:`)}` },
        signal: AbortSignal.timeout(5000),
      });
      const v = interpretTossKeyProbe(res.status);
      tossVerdict = v.verdict;
      if (v.verdict === 'invalid') issues.push(`🔴 ${v.message}`);
      else info.push(`TOSS 키: ${v.message}`);
    } catch {
      tossVerdict = 'unknown';
      info.push('TOSS 키: 판정 불가(네트워크/타임아웃) — 키 문제로 단정하지 말 것');
    }
  }

  // 3. 전날 주문/결제
  try {
    const row = await DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN payment_status = 'approved' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM orders
      WHERE created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; paid: number; failed: number }>();
    if (row) {
      info.push(`전날 주문: 전체 ${row.total}, 결제완료 ${row.paid}, 실패 ${row.failed}`);
      // 실패율 5% 이상이면 이슈
      if (row.total > 10 && row.failed / row.total > 0.05) {
        issues.push(`⚠️ 결제 실패율 높음: ${Math.round((row.failed / row.total) * 100)}%`);
      }
      // 🔔 2026-07-02 (감사 29 — 무소식 이상): "있어야 할 이벤트가 없음" 감지.
      //   전날 결제완료 0건인데 직전 7일 일평균 > 0 → info 가 아니라 issue 로 승격(잠든 운영자 깨움).
      //   결제 파이프가 조용히 죽은 케이스("3일째 결제가 안 되는데 아무도 몰랐다") 조기 포착.
      if (Number(row.paid) === 0) {
        try {
          const prev = await DB.prepare(`
            SELECT COUNT(*) as paid7 FROM orders
            WHERE payment_status = 'approved'
              AND created_at >= datetime('now', '-8 days') AND created_at < datetime('now', '-24 hours')
          `).first<{ paid7: number }>();
          const avg7 = Number(prev?.paid7 || 0) / 7;
          if (avg7 > 0) {
            issues.push(`🔴 무소식 이상: 전날 결제완료 0건 (직전 7일 일평균 ${avg7.toFixed(1)}건) — 결제 파이프 점검 필요`);
          }
        } catch { /* best-effort */ }
      }
    }
  } catch {}

  // 4. 최근 5xx spike
  try {
    const row = await DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_attempts WHERE action='5xx_spike' AND window_start >= ?"
    ).bind(Math.floor(Date.now() / 1000) - 86400).first<{ c: number }>();
    if (row && row.c > 0) issues.push(`⚠️ 5xx spike ${row.c}건 발생 (24h)`);
  } catch {}

  // 5. Slow query
  try {
    const row = await DB.prepare(`
      SELECT COUNT(*) as c, MAX(duration_ms) as max_ms
      FROM slow_queries
      WHERE logged_at >= datetime('now', '-24 hours')
    `).first<{ c: number; max_ms: number }>();
    if (row && row.c > 0) {
      info.push(`슬로우 쿼리: ${row.c}건 (최대 ${row.max_ms}ms)`);
      if (row.c > 100) issues.push(`⚠️ 슬로우 쿼리 많음: ${row.c}건`);
    }
  } catch {}

  // 🛡️ 2026-04-27 (TD-009): Webhook 실패 24h 요약
  try {
    const row = await DB.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN retry_count >= 3 THEN 1 ELSE 0 END) as fatal
      FROM webhook_events
      WHERE status = 'FAILED'
        AND created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; fatal: number }>();
    if (row && row.total > 0) {
      info.push(`Webhook 실패 24h: ${row.total}건 (FATAL ${row.fatal}건)`);
      if (row.fatal > 0) issues.push(`🔴 Webhook FATAL ${row.fatal}건 — 운영 검토 필요`);
      else if (row.total > 10) issues.push(`⚠️ Webhook 실패 ${row.total}건 — 평소보다 많음`);
    }
  } catch {}

  // 🫀 2026-07-05: 핵심 cron 침묵 감지 — heartbeat 가 허용 간격을 넘긴 cron 표시.
  //   ⚠️ 이 진단 자체가 cron 이라 cron 전면 사망은 외부 uptime.yml(/api/_healthcheck/cron)이 잡음.
  //   여기서는 "일부 cron 만 조용히 안 도는" 부분 침묵(스케줄 누락/특정 트리거 drift)을 커버.
  try {
    const { getCronHealth } = await import('../utils/cron-heartbeat');
    const health = await getCronHealth(DB);
    if (health.stale.length > 0) {
      for (const s of health.stale) {
        const when = s.age_min != null ? `마지막 실행 ${s.age_min}분 전` : '실행 기록 없음 (트리거 누락 의심)';
        issues.push(`🔴 Cron 침묵: ${s.label} (${s.name}) — ${when} (허용 ${s.max_gap_min}분)`);
      }
    } else if (!health.bootstrapping) {
      info.push(`Cron heartbeat: 핵심 ${health.missing.length > 0 ? `정상 (기록 대기 ${health.missing.length}건)` : '전체 정상'}`);
    }
  } catch {}

  // 🖥️ 2026-07-05: 프론트(브라우저) 에러 24h 집계 — 수집(frontend_errors)은 2026-05-23부터
  //   돌고 있었으나 진단이 안 봐서 "대표가 직접 발견" 의존이 남아있던 마지막 축.
  //   급증 시에만 깨움 + 상시 요약. 상세: /admin/errors
  try {
    // 30일 초과분 프루닝 (best-effort) — 수집 테이블 무한 성장 방지 (인덱스 idx_frontend_errors_created 사용).
    await DB.prepare(`DELETE FROM frontend_errors WHERE created_at < datetime('now', '-30 days')`).run().catch(() => null);
    const row = await DB.prepare(`
      SELECT COUNT(*) as total, COUNT(DISTINCT message) as distinct_msgs
      FROM frontend_errors
      WHERE created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; distinct_msgs: number }>();
    if (row && row.total > 0) {
      info.push(`프론트 에러 24h: ${row.total}건 (고유 ${row.distinct_msgs}종) — /admin/errors`);
      if (row.total > 30) {
        const top = await DB.prepare(`
          SELECT message, COUNT(*) as c FROM frontend_errors
          WHERE created_at >= datetime('now', '-24 hours')
          GROUP BY message ORDER BY c DESC LIMIT 3
        `).all<{ message: string; c: number }>().catch(() => ({ results: [] as Array<{ message: string; c: number }> }));
        const topStr = (top.results || []).map((t) => `${t.c}× ${t.message.slice(0, 80)}`).join(' / ');
        issues.push(`⚠️ 프론트 에러 급증: 24h ${row.total}건 — 상위: ${topStr}`);
      }
    }
  } catch {}

  // 📌 2026-08-02: **결과를 반환한다.** 예전엔 webhook 이 없으면 여기서 그냥 return 해서
  //   힘들게 모은 진단 결과가 **통째로 사라졌다** — console.warn 은 Observability 가 꺼져 있어
  //   아무도 못 본다. 이제 반환값이 `safeCron` 을 거쳐 하트비트 `result` 에 남으므로,
  //   Discord 가 없어도 `/api/admin/cron-heartbeats` 에서 pull 로 확인할 수 있다.
  //   (이 레포가 반복해 만난 클래스: 관측을 만들어 놓고 그게 사람에게 도달하지 않는 것.)
  const summary = { issues: issues.length, toss: tossVerdict, discord: Boolean(webhookUrl) };

  // 알림 발송
  if (!webhookUrl) {
    // 🛡️ 2026-04-22: webhook 미설정 알림 — 진단 자체 작동 안 함을 운영자가 인지하도록
    console.warn('[Daily Diagnostic] DISCORD_WEBHOOK_URL not configured — diagnostic results not sent');
    return summary;
  }

  if (issues.length > 0) {
    await sendDiscordAlert(
      webhookUrl,
      '🩺 Daily Health Check — 이슈 발견',
      `발견된 이슈:\n${issues.map((i) => `- ${i}`).join('\n')}\n\n정상:\n${info.map((i) => `- ${i}`).join('\n')}\n\n대시보드: /api/_internal/health-dashboard`,
      'warn'
    );
  } else {
    await sendDiscordAlert(
      webhookUrl,
      '✅ Daily Health Check — 모두 정상',
      info.map((i) => `- ${i}`).join('\n'),
      'info'
    );
  }

  return summary;
}
