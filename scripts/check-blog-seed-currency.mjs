#!/usr/bin/env node
/**
 * 🛡️ 2026-07-01: 블로그 시드 최신성 방어 (대표 지시 — "코드 수정될 때마다 블로그도 자동 반영").
 *
 * 배경: 소비자 블로그(`/blog`) 시드는 `src/features/blog/api/blog.routes.ts` 의
 *   `blogSeedPosts()` 배열 + `BLOG_SEED_VERSION` 으로 버전 재시드된다.
 *   시드 콘텐츠가 폐기된 명칭/기능(식사권·공구권·라이브커머스 등)으로 되돌아가면
 *   라이브 블로그가 다시 낡아진다. 명칭 SSOT(CLAUDE.md) 위반을 결정론으로 차단.
 *
 * 룰: 블로그 시드 파일에 아래 폐기 용어가 나타나면 안 된다.
 *   - 소비자 명칭 폐기어: 식사권, 공구권, 인플루언서, 크리에이터, 큐레이터(사람)
 *   - 영구중단 기능을 현재처럼: "라이브 커머스"/"라이브커머스", "라이브 방송", 쇼츠
 *   - 서비스 분리 위반(도매몰 유입): 유통스타트, 판매사, 제조사, 유통사
 *
 * 자동 제외: 같은 줄에 `blog-currency-ok` 주석.
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_BLOG_SEED=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_BLOG_SEED === '1'
const ROOT = process.cwd()
const FILE = path.join(ROOT, 'src/features/blog/api/blog.routes.ts')

// 폐기 용어 (정규식). 카테고리 라벨 "식사"(단독)는 허용 — "식사권"만 금지.
const FORBIDDEN = [
  { re: /식사권/, why: '폐기 명칭 — "이용권" 사용 (카테고리 칩은 "식사")' },
  { re: /공구권/, why: '폐기 명칭 — "이용권" 사용' },
  { re: /인플루언서/, why: '사람 지칭 금지 — "유저"/"사업자 유저" 사용' },
  { re: /크리에이터/, why: '사람 지칭 금지 — "유저"/"사업자 유저" 사용' },
  { re: /큐레이터/, why: '사람 지칭 금지 — "유저" 사용 ("큐레이션"은 허용)' },
  { re: /라이브\s?커머스/, why: '라이브커머스 영구중단 — 현재 기능처럼 서술 금지' },
  { re: /라이브\s?방송/, why: '라이브 영구중단 — 현재 기능처럼 서술 금지' },
  { re: /쇼츠/, why: '라이브/쇼츠 영구중단 — 현재 기능처럼 서술 금지' },
  { re: /유통스타트/, why: '도매몰(B2B) 내용 — 소비자 블로그 유입 금지(서비스 분리)' },
  { re: /판매사/, why: '도매몰(B2B) 명칭 — 소비자 블로그 유입 금지(서비스 분리)' },
  { re: /제조사/, why: '도매몰(B2B) 명칭 — 소비자 블로그 유입 금지(서비스 분리)' },
  { re: /유통사/, why: '도매몰(B2B) 폐기 명칭 — 소비자 블로그 유입 금지' },
]

if (!fs.existsSync(FILE)) {
  console.log('ℹ️  blog seed 파일 없음 — skip')
  process.exit(0)
}

const lines = fs.readFileSync(FILE, 'utf-8').split('\n')
const hits = []
lines.forEach((line, i) => {
  if (line.includes('blog-currency-ok')) return
  // LEGACY_SEED_SLUGS 및 정의 주석 라인은 영어 slug/설명이라 무관 — 한글 폐기어만 매칭됨
  for (const { re, why } of FORBIDDEN) {
    if (re.test(line)) hits.push({ ln: i + 1, term: re.source, why, text: line.trim().slice(0, 90) })
  }
})

if (hits.length === 0) {
  console.log('✅ 블로그 시드 최신성 OK — 폐기 용어 없음.')
  process.exit(0)
}

const tag = STRICT ? '❌' : '⚠️ '
console.log(`${tag} 블로그 시드에 폐기 용어 ${hits.length}건:`)
for (const h of hits) {
  console.log(`   ${path.relative(ROOT, FILE)}:${h.ln}  [${h.term}] ${h.why}`)
  console.log(`      ${h.text}`)
}
console.log('   → 명칭 SSOT(CLAUDE.md) 준수로 수정하고 BLOG_SEED_VERSION 을 +1 하세요.')
console.log('   (의도적 예외는 해당 줄에 `blog-currency-ok` 주석)')
process.exit(STRICT ? 1 : 0)
