#!/usr/bin/env bash
# 🚨 **배포 실패를 어드민에 남긴다** — "조용한 실패" 를 끊는다 (2026-08-03 실사고).
#
# ## 왜
# 2026-08-02 밤, Cloudflare 레이트 리밋(10429)으로 배포가 연속 실패했다:
#   - `Deploy ur-ads Worker`       2건 (#971 · #969)
#   - `Deploy to Cloudflare Pages` **4건 연속** (22:53 · 23:37 · 23:47 · 23:56 KST)
# 그동안 **라이브는 4개 머지만큼 뒤처져 있었는데 화면은 멀쩡해 보였다.** 실패는 Actions 탭
# 안에만 있었고, 아무도 안 봤다. 결국 D1 을 직접 뒤져서야 알았다.
#
# ⇒ 실패를 **대표가 이미 보는 곳**(어드민 벨 · `/admin/system-monitoring`)에 남긴다.
#
# ## 왜 "번들 나이 감시" 가 아니라 이것인가
# 워커가 자기 `build_age_min` 을 보고 경보하는 방법도 있지만, 그건 *"배포가 실패했다"* 와
# *"아무도 머지를 안 했다"* 를 **구분하지 못한다** — 조용한 주말마다 오경보가 난다.
# 실패한 배포 잡 자신은 그 구분이 필요 없다: **자기가 실패했다는 걸 안다.** 오탐 0.
#
# ## ⚠️ 절대 배포 결과를 바꾸지 않는다
# 관측이 실패해서 잡 상태가 달라지면 본말전도다. 이 스크립트는 **항상 exit 0** 이고,
# 호출부도 `continue-on-error: true` 로 둔다.
#
# 사용: bash scripts/report-deploy-failure.sh <프로젝트> <sha> <run_url>
#   필요 env: CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID  (배포 잡이 이미 갖고 있다)
set -u

PROJECT="${1:-unknown}"
SHA="${2:-}"
RUN_URL="${3:-}"

# 메인 D1 (wrangler.toml · wrangler-ads.toml 이 같은 값을 쓴다 — 레포에 공개된 식별자다).
DB_ID="${DEPLOY_ALERT_D1_ID:-d9530ba6-7a26-4c02-9295-3ce5aef112a3}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::warning::배포 실패 알림 생략 — CF 자격 없음(배포 결과에는 영향 없음)"
  exit 0
fi

MSG="배포 실패: ${PROJECT} (${SHA:0:8}) — 라이브가 이 커밋만큼 뒤처져 있다. ${RUN_URL}"

# ⚠️ 두 곳에 남긴다: 영구 기록(cron_failures) + 대표가 실제로 보는 벨(dashboard_notifications).
#   테이블/컬럼은 `src/worker/utils/cron-reporter.ts` 와 같은 모양을 쓴다(스키마 SSOT 한 곳).
SQL=$(python3 - "$MSG" "$RUN_URL" <<'PY'
import json, sys
msg, url = sys.argv[1], sys.argv[2]
q = lambda s: "'" + s.replace("'", "''") + "'"
stmts = [
  f"INSERT INTO cron_failures (job_name, error_message, context, severity) "
  f"VALUES ('deploy', {q(msg)}, {q(json.dumps({'run': url}))}, 'critical')",
  # ⚠️ 컬럼 모양은 `cron-reporter.ts` 와 **정확히 같게** 쓴다. 2026-07-01 에 없는 테이블·컬럼을
  #   참조해 어드민 벨이 조용히 비어 있던 사고가 있었다(그 수습이 지금의 이 모양이다).
  f"INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at) "
  f"VALUES ('admin', NULL, 'cron_failure', '🚨 배포 실패', {q(msg[:200])}, '/admin/cron-failures', datetime('now'))",
]
print(json.dumps({"sql": "; ".join(stmts)}))
PY
) || { echo "::warning::알림 SQL 생성 실패 — 생략"; exit 0; }

printf '%s' "$SQL" > /tmp/deploy-alert.json
RESP=$(curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DB_ID}/query" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/deploy-alert.json 2>&1) || RESP="curl 실패"
rm -f /tmp/deploy-alert.json

case "$RESP" in
  *'"success":true'*) echo "✅ 배포 실패를 어드민에 기록했다 (${PROJECT})" ;;
  *) echo "::warning::어드민 기록 실패(배포 결과에는 영향 없음): ${RESP:0:300}" ;;
esac
exit 0
