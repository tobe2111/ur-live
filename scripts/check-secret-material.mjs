#!/usr/bin/env node
/**
 * 🛡️ 추적 파일 전수 시크릿 자재 스캔 (2026-07-28 신설)
 *
 * 왜 필요한가 — 기존 두 가드가 이 클래스를 놓쳤다:
 *   - verify.yml 의 'Hardcoded secret 검출' 은 **src/ 아래 .ts/.tsx 만** 본다.
 *   - check-no-secrets.sh 는 정해진 키 이름 패턴(CF/JWT/dotenv) 위주다.
 *   → 실제로 archive/ 의 **16개 파일**(.md/.txt)에 Google 서비스계정 개인키·Toss live 시크릿·
 *     Stripe 시크릿이 **추적된 채로** 남아 있었고(2026-07-28 발견) 둘 다 통과시켰다. public 레포다.
 *
 * 무엇을 보나 — 파일 확장자·경로 무관, **git 이 추적하는 전 파일**에서 '진짜 시크릿 자재'만.
 *   자리표시자(REDACTED/xxx/your-…)와 짧은 스텁은 제외해 오탐을 억제한다.
 *
 * 범위 — 작업트리(HEAD)만. **git history 는 보지 않는다**(과거 유출은 스캔이 아니라 *회전*으로만
 *   해결된다 — 히스토리를 검사해봤자 매번 실패만 하고 고칠 수단이 없다). 여기 목적은 **신규 유입 차단**.
 *
 * 예외 — 파일 안에 `secret-material-ok` 주석을 넣으면 그 파일은 통과(의도적 픽스처/문서용).
 */
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const MAX_BYTES = 2_000_000
const ALLOW_MARK = 'secret-material-ok'
const SKIP_PATH = /(^|\/)(package-lock\.json|node_modules\/|dist\/|\.git\/)/
const PLACEHOLDER = /(REDACTED|EXAMPLE|PLACEHOLDER|CHANGEME|YOUR[-_]|<[^>]{0,40}>|x{6,}|\*{4,}|여기에)/i

/** 각 규칙: 매치가 '실제 자재'일 때만 true 를 반환하도록 verify 를 둔다. */
const RULES = [
  {
    id: 'private-key',
    label: 'PEM 개인키(실제 본문)',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    // BEGIN 뒤 END 전까지의 base64 본문이 200자 이상이어야 실제 키. 스텁("...")은 통과.
    verify: (text, m) => {
      const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 4000)
      const body = rest.split(/-----END/)[0].replace(/\s/g, '')
      return body.length >= 200 && !PLACEHOLDER.test(body)
    },
  },
  { id: 'toss-live',  label: 'Toss live 시크릿키', re: /live_sk_[A-Za-z0-9]{15,}/g },
  { id: 'stripe-live',label: 'Stripe 시크릿키',    re: /sk_live_[A-Za-z0-9]{15,}/g },
  { id: 'aws-key',    label: 'AWS 액세스키',       re: /AKIA[0-9A-Z]{16}/g },
  { id: 'slack',      label: 'Slack 토큰',         re: /xox[baprs]-[A-Za-z0-9-]{15,}/g },
  { id: 'anthropic',  label: 'Anthropic API 키',   re: /sk-ant-[A-Za-z0-9_-]{25,}/g },
  { id: 'github-pat', label: 'GitHub PAT',         re: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { id: 'openai',     label: 'OpenAI API 키',      re: /sk-proj-[A-Za-z0-9_-]{25,}/g },
]

let files = []
try {
  files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean)
} catch {
  console.error('git ls-files 실패 — git 저장소가 아닌 듯합니다. 검사를 건너뜁니다.')
  process.exit(0)
}

const findings = []
for (const f of files) {
  if (SKIP_PATH.test(f)) continue
  let text
  try {
    if (statSync(f).size > MAX_BYTES) continue
    text = readFileSync(f, 'utf8')
  } catch { continue }
  if (text.includes(ALLOW_MARK)) continue
  if (text.includes('\0')) continue // 바이너리

  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text)) !== null) {
      if (rule.verify && !rule.verify(text, m)) continue
      if (!rule.verify && PLACEHOLDER.test(m[0])) continue
      const line = text.slice(0, m.index).split('\n').length
      findings.push({ file: f, line, label: rule.label, id: rule.id })
      break // 파일·규칙당 1건만 보고(값 노출 최소화)
    }
  }
}

if (findings.length) {
  console.error('❌ 추적 파일에서 실제 시크릿 자재 발견 — public 레포는 커밋 즉시 영구 노출입니다.\n')
  for (const f of findings) console.error(`   ${f.file}:${f.line}  → ${f.label}`)
  console.error(`
  🔧 조치:
     1) 파일을 레포에서 제거하고(git rm) 값은 비밀번호 관리자/Cloudflare Secret 으로 옮길 것
     2) ⚠️ 제거만으로는 부족하다 — **이미 push 됐다면 그 시크릿은 회전(재발급)해야 한다.**
        git history 와 포크·스캐너 캐시에 남는다.
     3) 의도적인 테스트 픽스처라면 파일에 '${ALLOW_MARK}' 주석을 넣어 예외 처리
`)
  process.exit(1)
}
console.log(`✅ 시크릿 자재 없음 (추적 파일 ${files.length}개 검사)`)
