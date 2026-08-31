/**
 * 🔌 cron 이 쓰는 바인딩은 wrangler.toml 에 있어야 한다
 *
 * ## 🩸 실제로 났던 일 (2026-08-31 실측)
 * 데모 이미지 이관 cron(`demo-image-rehost`)이 **넉 달간 한 건도 못 옮기고 있었다.**
 *   · 이관 대기 큐 **338건**, 그 전부가 `img_rehost_tries = 0`(한 번도 시도된 적 없음)
 *   · 하트비트는 `ok:true` · `reconditioned=3 migrated=0 images=0 done=0`
 *   · 데모 숙소 46건의 커버가 **전부 남의 서버**(카카오맵 36 · 네이버 블로그 10, R2 0건)
 *
 * 원인은 코드가 아니라 **배포가 둘**이라는 것이었다:
 *   · Pages(요청 처리) — 대시보드에 `MEDIA_BUCKET` 등록됨 → `/api/media` 서빙 정상
 *   · Workers(cron)    — 바인딩은 **`wrangler.toml` 에서만** 온다. 거기 `MEDIA_BUCKET` 이
 *                        주석 처리돼 있어 `if (!MEDIA_BUCKET) return` 으로 매 5분 조기 반환
 *
 * ⚠️ **에러가 안 난다.** cron 은 성공으로 기록되고 큐만 영원히 안 줄어든다. 화면상 사진은
 * 외부 원본으로 그대로 떠서 아무도 이상을 못 느낀다 — 이 레포가 반복해 겪는 "조용한 부재" 다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 대시보드(Pages) 쪽 바인딩. 레포가 볼 수 없다 — 그건 배포 후 실측으로만 확인된다.
 * - 버킷 **이름**이 실재하는지. 이름이 틀리면 `wrangler deploy` 가 실패해서 알게 된다.
 * - cron 이 아닌 요청 경로에서만 쓰는 바인딩(그쪽은 Pages 대시보드 소관이라 대상이 아니다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8')

/** wrangler.toml 에서 **주석이 아닌** 줄만 본다 — 주석 해제를 잊는 것이 바로 이 사고였다. */
function declaredBindings(): Set<string> {
  const live = read('wrangler.toml')
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n')
  return new Set([...live.matchAll(/^binding\s*=\s*"([^"]+)"/gm)].map((m) => m[1]))
}

/** cron 모듈 전수 — 파일명이 아니라 내용으로 판정한다. */
function cronSources(): { file: string; src: string }[] {
  const dir = resolve(root, 'src/worker/cron')
  return readdirSync(dir)
    .filter((n) => n.endsWith('.ts'))
    .map((n) => ({ file: `src/worker/cron/${n}`, src: readFileSync(resolve(dir, n), 'utf-8') }))
}

describe('cron 이 참조하는 바인딩이 wrangler.toml 에 선언돼 있다', () => {
  it('스캔 대상이 비어 있지 않다 (0건 통과 방지)', () => {
    expect(cronSources().length, 'cron 디렉터리를 못 읽었다 — 경로가 낡았다').toBeGreaterThan(10)
    expect(declaredBindings().size, 'wrangler.toml 에서 바인딩을 못 읽었다 — 셀렉터가 낡았다').toBeGreaterThan(2)
  })

  it('부재 시 통째로 건너뛰는 바인딩이 전부 선언돼 있다', () => {
    // 🎯 대상을 **조기반환 게이트가 걸린 바인딩**으로 좁힌다. 그게 이 사고의 모양이다 —
    //   없으면 그 cron 이 아무 일도 안 하고 성공으로 기록된다.
    //   ⚠️ 폴백이 있는 참조(예: `getFeatureFlags(RATE_LIMIT_KV, env.DB)` 는 KV 없으면 DB 로)는
    //     제외한다. 그건 성능/중복알림 수준으로 degrade 할 뿐 기능이 죽지 않고, 무엇보다
    //     **여기서 실패시키면 내가 못 고치는 것으로 CI 를 막는다**(KV id 는 대시보드에만 있다).
    const declared = declaredBindings()
    const missing: string[] = []
    for (const { file, src } of cronSources()) {
      // 한 홉 별칭까지 따라간다: `const bucket = (env as …).MEDIA_BUCKET` → `if (!bucket) return`
      const alias = new Map<string, string>()
      for (const m of src.matchAll(/const\s+(\w+)\s*=[^\n]*?\.([A-Z][A-Z0-9_]*(?:_BUCKET|_KV))\b/g)) alias.set(m[1], m[2])
      for (const m of src.matchAll(/if\s*\(\s*!\s*([\w.]+)\s*\)\s*return/g)) {
        const expr = m[1]
        const direct = expr.match(/([A-Z][A-Z0-9_]*(?:_BUCKET|_KV))$/)?.[1]
        const name = direct || alias.get(expr)
        if (name && !declared.has(name)) missing.push(`${file} → ${name}`)
      }
    }
    expect(missing, `없으면 cron 이 통째로 건너뛰는데 wrangler.toml 에 없는 바인딩:\n${missing.join('\n')}`).toEqual([])
  })
})

describe('바인딩이 없어 못 돈 것을 "할 일 없었음"과 구분한다', () => {
  it('바인딩 부재 조기반환이 사유를 남긴다', () => {
    // 🔑 이 사고를 못 본 진짜 이유. 전부 0 으로 반환하면 하트비트에서 정상과 구분이 안 된다.
    //   `skipped` 를 실어야 `migrated=0` 이 "옮길 게 없었다"인지 "옮길 수 없었다"인지 읽힌다.
    for (const f of ['src/worker/cron/demo-image-rehost.ts', 'src/worker/cron/r2-orphan-cleanup.ts']) {
      const src = read(f)
      const at = src.search(/if\s*\(\s*!\s*(bucketEnv\.MEDIA_BUCKET|bucket)\s*\)\s*return/)
      expect(at, `${f}: 바인딩 부재 조기반환을 못 찾았다 — 앵커가 낡았다`).toBeGreaterThan(0)
      const line = src.slice(at, src.indexOf('\n', at))
      expect(line, `${f}: 못 돈 사유를 안 남긴다 — 하트비트에서 정상과 구분 불가`).toContain('skipped')
    }
  })
})
