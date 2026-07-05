/**
 * 🫀 2026-07-05: 어드민 가이드 — 자동 관측 체계 섹션 (1인 운영 dead-man's switch).
 *
 * guide-seed-admin.ts 는 file-size 래칫 baseline 동결 파일이라 성장 금지 —
 * 신규 섹션은 이 파일에 추가하고 guide-seed.ts 에서 spread 로 합류.
 */
import type { SeedSection } from './guide-seed-types'

export const ADMIN_OPS_SECTIONS: SeedSection[] = [
  {
    key: 'observability', icon: '🫀', title: '자동 관측 체계 (cron 침묵·게이트·백업)', order: 111,
    content: `### Cron 침묵 감지 (dead-man's switch)
- 모든 cron 이 실행마다 heartbeat 를 기록합니다 (\`cron_heartbeats\`).
- 확인: \`/admin/system-monitoring\` → **"게이트·하트비트" 탭** — cron 별 마지막 실행/상태/소요시간.
- 핵심 cron 이 허용 간격을 넘기면 \`/api/_healthcheck/cron\` 이 503 → **GitHub uptime 워크플로(10분)가 이슈 생성 + 이메일**. cron 내부 진단은 cron 이 죽으면 같이 죽으므로 외부 관측이 진짜 안전망입니다.

### 운영 게이트 플래그 현황판
- 같은 탭에서 검증 대기 스위치(커미션 예산 / 쇼핑 원장 / fee-resolver 등)의 활성 여부를 열람합니다.
- ⚠️ **S# 표시 게이트는 staging 실결제 검증 전 프로덕션 활성 금지** — 시나리오·통과 기준: \`docs/STAGING_CHECKLIST.md\`.

### 프론트(브라우저) 에러
- 매일 새벽 자가진단이 24시간 집계 → 급증(30건+) 시 Discord 경보. 상세 목록: \`/admin/errors\`.

### 백업 & 복구
- 주간 D1→R2 백업이 무결성(테이블 수/크기/업로드)을 자동 검증 — 경고 시 Discord warn.
- **분기 1회 복구 리허설** 권장 (~15분): \`docs/BACKUP_RESTORE.md\` 절차. 30일 내 시점 복구는 D1 Time Travel 이 1순위.`,
  },
]
