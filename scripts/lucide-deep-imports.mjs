/**
 * 🧩 lucide-react 이름 import → 아이콘 파일 직접 import (2026-10-13 — 첫 방문 로딩).
 *
 * 왜: `import { Gift } from 'lucide-react'` 는 배럴(lucide-react.js)을 거친다. 배럴은 아이콘 1,500여 개를
 * 전부 정적으로 다시 내보내므로, 모듈 그래프만 보면 **셸이 배럴을 쓰는 순간 모든 아이콘이 첫 화면 소속**처럼
 * 보인다. 그래서 번들러가 페이지별로 아이콘을 나누지 못하고 큰 봉투 하나(`lucide` 13KB br)가 상세·지도·유어샵
 * 어디서나 통째로 실려 왔다. 파일을 직접 가리키면 그래프가 정확해져 아이콘이 **쓰는 페이지 쪽으로** 간다.
 * (Next.js `optimizePackageImports` 가 lucide-react 에 하는 것과 같은 변환이다.)
 *
 * 규칙: 배럴의 `export { default as X, … } from './icons/x.js'` 를 읽어 이름 → 파일 표를 만든다.
 * 표에 없는 이름(타입·createLucideIcon 등)과 `import type` 은 원래 import 로 남긴다. src/ 만 변환한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export function buildLucideIconMap(barrelSource) {
  const map = new Map()
  const re = /export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([a-z0-9-]+)\.js'/g
  for (const m of barrelSource.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const mm = part.trim().match(/^default\s+as\s+([A-Za-z0-9_$]+)$/)
      if (mm) map.set(mm[1], m[2])
    }
  }
  return map
}

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])lucide-react\2\s*;?/g

/** 순수 변환 — 테스트가 직접 부른다. 바꿀 것이 없으면 null. */
export function rewriteLucideImports(code, iconMap) {
  if (!code.includes('lucide-react')) return null
  let changed = false
  const out = code.replace(IMPORT_RE, (all, specs) => {
    const keep = []
    const direct = []
    for (const raw of specs.split(',')) {
      const s = raw.trim()
      if (!s) continue
      const m = s.match(/^(type\s+)?([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/)
      if (!m || m[1] || !iconMap.has(m[2])) { keep.push(s); continue }
      direct.push(`import ${m[3] || m[2]} from 'lucide-react/dist/esm/icons/${iconMap.get(m[2])}.js';`)
    }
    if (!direct.length) return all
    changed = true
    // 줄 수를 보존한다(여러 줄 import 를 한 줄로 접으면 그 아래 줄 번호가 밀려 소스맵·에러 위치가 어긋난다).
    const nl = '\n'.repeat((all.match(/\n/g) || []).length)
    return (keep.length ? `import { ${keep.join(', ')} } from 'lucide-react';` : '') + direct.join('') + nl
  })
  return changed ? out : null
}

export function lucideDeepImportsPlugin() {
  const require = createRequire(import.meta.url)
  let iconMap = null
  return {
    name: 'lucide-deep-imports',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.+\.(?:t|j)sx?$/.test(id.split('?')[0]) || id.includes('node_modules')) return null
      if (!iconMap) {
        const pkg = path.dirname(require.resolve('lucide-react/package.json'))
        iconMap = buildLucideIconMap(fs.readFileSync(path.join(pkg, 'dist/esm/lucide-react.js'), 'utf8'))
        if (iconMap.size < 500) throw new Error(`lucide-deep-imports: 아이콘 표가 ${iconMap.size}개뿐 — 배럴 형식이 바뀌었다`)
      }
      const out = rewriteLucideImports(code, iconMap)
      return out == null ? null : { code: out, map: null }
    },
  }
}
