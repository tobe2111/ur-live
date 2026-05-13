#!/bin/bash
# check-silent-errors.sh — silent error swallowing 검출 (warn-only)
#
# 패턴: .catch(() => {})  또는  catch {}  (빈 catch)
# 영향: 운영 중 발생하는 에러가 silent → 디버깅 불가
#
# 정책: WARN only (commit 차단 안 함). STRICT_SILENT_ERRORS=1 환경변수 또는
#   commit message 에 [STRICT_SILENT] 면 차단.
#
# 예외:
#   - 의도적 무시: // intentional 코멘트가 같은 줄 또는 직전 줄에 있음
#   - DEV 로깅 wrapper: console.warn/error 가 catch 내부에 있음

set -e

# 새로 추가되거나 수정된 파일에서만 검사 (existing violations 는 무관)
staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '\.(ts|tsx)$' \
  | grep -vE 'node_modules/|dist/|\.test\.|\.spec\.|/tests/' \
  || true)

if [ -z "$staged" ]; then
  exit 0
fi

found_count=0
samples=""

for f in $staged; do
  [ -f "$f" ] || continue

  # 패턴: .catch(() => {})   .catch(() => { })   .catch(() => /*comment*/ {})
  matches=$(grep -nE "\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)" "$f" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      ln_num=$(echo "$line" | cut -d: -f1)
      # intentional 코멘트 확인 (같은 줄 또는 직전 줄)
      ctx=$(sed -n "$((ln_num-1)),${ln_num}p" "$f" 2>/dev/null)
      if echo "$ctx" | grep -qE "intentional|ignore|fire-and-forget|swallow|noop"; then
        continue
      fi
      found_count=$((found_count + 1))
      [ $found_count -le 5 ] && samples="$samples\n  $f:$ln_num"
    done <<< "$matches"
  fi
done

if [ $found_count -gt 0 ]; then
  echo ""
  echo "⚠️  Silent error 패턴 발견 ($found_count 건):"
  echo -e "$samples"
  if [ $found_count -gt 5 ]; then
    echo "  ... 그 외 $((found_count - 5))건 더"
  fi
  echo ""
  echo "  권장: .catch((e) => { if (import.meta.env.DEV) console.warn(e) })"
  echo "  의도적 무시: 직전 줄에 // intentional: 사유"
  echo ""
  echo "  ⚠️ WARN only — 차단 안 함. STRICT_SILENT_ERRORS=1 로 차단 모드."
  if [ "${STRICT_SILENT_ERRORS:-}" = "1" ] || echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[STRICT_SILENT\]"; then
    exit 1
  fi
fi

exit 0
