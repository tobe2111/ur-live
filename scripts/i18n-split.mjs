/**
 * 🌐 번역 파일을 손님용(core)과 대시보드용(dash)으로 나눈다 — 2026-10-11 (대표 "다 해줘")
 *
 * 왜: 손님이든 셀러든 첫 접속 때 언어 파일 하나(ko 309 KB · gzip 91 KB)를 통째로 받았는데,
 *   그중 약 64% 가 손님은 볼 일이 없는 셀러·어드민·에이전시·제조사·도매 문구였다.
 *
 * 어떻게:
 *   - `DASH_NAMESPACES` 로 시작하는 키는 dash 로 보낸다.
 *   - 단, **손님이 볼 수 있는 파일**(아래 `isDashOnlyFile` 가 아닌 모든 src 파일)이 그 키를 문자열로 언급하면
 *     core 에 남긴다. 템플릿(`t(\`seller.x.${y}\`)`)이면 접두어 아래를 통째로 남긴다.
 *   - 판정은 **보수적**이다 — 애매하면 core 에 남긴다(손님 화면에 키가 그대로 뜨는 쪽이 훨씬 나쁘다).
 *   - 그래도 빠진 키가 런타임에 요청되면 `src/i18n.ts` 가 dash 를 불러오고 다시 그린다(이중 안전망).
 *
 * 순수 함수 + 파일 스캔 하나. vite.config(플러그인)와 테스트가 같은 함수를 쓴다.
 */
import fs from 'node:fs'
import path from 'node:path'

export const DASH_NAMESPACES = ['seller', 'admin', 'agency', 'supplier', 'wholesale', 'live', 'liveWs']

const NS_ALT = DASH_NAMESPACES.join('|')
const LITERAL_RE = new RegExp(`['"\`]((?:${NS_ALT})\\.[A-Za-z0-9_.-]+)['"\`]`, 'g')
const TEMPLATE_RE = new RegExp('`((?:' + NS_ALT + ')\\.[A-Za-z0-9_.-]*)\\$\\{', 'g')

/**
 * 대시보드 안에서만 그려지는 파일인가. **여기 없는 파일은 전부 손님이 볼 수 있다고 본다.**
 * ⚠️ `SellerPublicPage`·`seller-public/`·`user-profile/`(마이) 는 손님 화면이라 제외한다.
 */
export function isDashOnlyFile(rel) {
  const p = rel.replace(/\\/g, '/')
  if (/^src\/pages\/(SellerPublicPage|seller-public\/)/.test(p)) return false
  return /^src\/(pages\/(Admin|admin\/|Agency|agency|Supplier|supplier|Wholesale|wholesale|Distributor|distributor|Seller|seller-)|components\/(admin|wholesale|supplier|agency|dashboard|seller|seller-layout)\/|components\/(SellerLayout|AdminLayout|AgencyLayout)|routes\/)/.test(p)
}

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (n !== 'tests' && n !== 'node_modules') walk(p, out) }
    else if (/\.(tsx?|jsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

/** 손님이 볼 수 있는 파일이 언급하는 dash 키(정확한 경로)와 접두어(템플릿). */
export function collectConsumerDashKeys(root) {
  const exact = new Set()
  const prefixes = new Set()
  for (const f of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, f)
    if (isDashOnlyFile(rel)) continue
    const s = fs.readFileSync(f, 'utf-8')
    for (const m of s.matchAll(LITERAL_RE)) exact.add(m[1].replace(/\.$/, ''))
    for (const m of s.matchAll(TEMPLATE_RE)) prefixes.add(m[1].replace(/\.$/, ''))
  }
  return { exact, prefixes }
}

function isDashKey(key) {
  const head = key.split('.')[0]
  return DASH_NAMESPACES.includes(head)
}

/** keep 판정 — 그 경로 자체, 그 경로의 조상(통째 언급), 템플릿 접두어 아래면 core 에 남긴다. */
function makeKeep({ exact, prefixes }) {
  return (p) => {
    if (exact.has(p)) return true
    for (const x of exact) if (p.startsWith(x + '.')) return true
    for (const x of prefixes) if (p === x || p.startsWith(x + '.') || x === '') return true
    return false
  }
}

/**
 * 번역 객체를 core / dash 로 나눈다. 원본은 건드리지 않는다.
 * 평면 키(`"admin.dashboard.x": "…"`)와 중첩 객체가 섞여 있어도 같은 규칙으로 나눈다.
 */
export function splitTranslation(obj, used) {
  const keep = makeKeep(used)
  const core = {}
  const dash = {}
  const put = (target, pathParts, value) => {
    let cur = target
    for (let i = 0; i < pathParts.length - 1; i++) {
      const k = pathParts[i]
      if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
      cur = cur[k]
    }
    cur[pathParts[pathParts.length - 1]] = value
  }
  for (const [top, value] of Object.entries(obj)) {
    if (!isDashKey(top)) { core[top] = value; continue }
    dash[top] = value
    if (top.includes('.')) { if (keep(top)) core[top] = value; continue }
    // 중첩 — 잎까지 내려가며 keep 인 가지만 core 로 복사
    const visit = (node, parts) => {
      const p = parts.join('.')
      if (keep(p)) { put(core, parts, node); return }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) visit(v, [...parts, k])
    }
    visit(value, [top])
  }
  return { core, dash }
}

/** Vite 플러그인 — `translation.json?i18n-core|dash` 를 나눠서 돌려준다(쿼리 없으면 그대로). */
export function i18nSplitPlugin(root) {
  let used = null
  return {
    name: 'i18n-split',
    enforce: 'pre',
    buildStart() { used = collectConsumerDashKeys(root) },
    transform(code, id) {
      const m = id.match(/\/locales\/[a-z]{2}\/translation\.json\?i18n-(core|dash)$/)
      if (!m) return null
      if (!used) used = collectConsumerDashKeys(root)
      const parts = splitTranslation(JSON.parse(code), used)
      return { code: JSON.stringify(parts[m[1]]), map: null }
    },
  }
}
