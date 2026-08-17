import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 🖼️ 데모 이미지 출처(provenance) 불변식 — 2026-08-17 UX 전수검사 실사고에서 도출.
 *
 * 라이브 /stays 첫 화면에 **연합뉴스 워터마크 사진**(demo-stay-80)이 떠 있었다. 08-08 에 언론사
 * 차단 목록(BLOCKED_PHOTO_HOSTS)을 만들었지만 세 개의 구멍으로 살아남았다:
 *   ① 7월에 이미 R2 로 이관(세탁)된 사진은 URL 호스트 검사가 영영 못 잡는다
 *   ② recondition 의 keepOld(옛 커버 유지)가 차단 검사를 안 했다
 *   ③ 이관 경로가 차단 URL 을 그대로 R2 로 옮겨 세탁을 계속 만들 수 있었다
 *
 * ⚠️ 이 테스트가 못 막는 것: 이미 세탁돼 /api/media/… 가 된 과거분은 코드로 판정 불가 —
 *   그건 DEMO_COND_V=5 재조정(demo-stay 는 근거 사진 필수, 없으면 내림)이 데이터에서 수렴시킨다.
 *   여기서는 "구멍 세 개가 다시 열리지 않는가"만 소스로 고정한다.
 */

const cron = readFileSync(join(process.cwd(), 'src/worker/cron/demo-image-rehost.ts'), 'utf8')

describe('데모 이미지 출처 불변식 (demo-image-rehost)', () => {
  it('② keepOld 는 차단 출처 커버를 유지할 수 없다', () => {
    const m = cron.match(/const keepOld =[\s\S]{0,400}?validateImageLoads/)?.[0] ?? ''
    expect(m).toMatch(/!isBlockedPhotoUrl\(/)
  })

  it('② keepOld 는 demo-stay 에 적용되지 않는다 (세탁된 옛 커버는 출처 판정 불가)', () => {
    const m = cron.match(/const keepOld =[\s\S]{0,400}?validateImageLoads/)?.[0] ?? ''
    expect(m).toMatch(/!row\.slug\.startsWith\('demo-stay-'\)/)
  })

  it('③ 이관(rehost)은 차단 출처 URL 을 R2 로 세탁하지 않는다 — 두 경로 모두', () => {
    // rehostImageToR2 호출 앞에 isBlockedPhotoUrl 게이트가 있어야 한다. 호출은 3곳
    // (bulk 1 + cron 스테이지② 1 + heal 재획득 경로는 fetchDemoPhotos 산출이라 이미 필터됨).
    const bulk = cron.match(/demo-bulk-rehost/g) ?? []
    expect(bulk.length).toBeGreaterThan(0)
    const bulkBlock = cron.match(/const fetched = await Promise\.all[\s\S]{0,600}?demo-bulk-rehost/)?.[0] ?? ''
    expect(bulkBlock).toMatch(/isBlockedPhotoUrl/)
    const stage2 = cron.match(/for \(const u of externals\) \{[\s\S]{0,600}?demo-image-rehost/)?.[0] ?? ''
    expect(stage2).toMatch(/isBlockedPhotoUrl\(u\)/)
  })

  it('시도 카운터는 버전별로 리셋된다 (버전 bump 가 문제 행에서 무효가 되지 않게)', () => {
    expect(cron).toMatch(/demo_cond_try_v === DEMO_COND_V \? Number\(meta\.demo_cond_tries/)
    expect(cron).toMatch(/demo_cond_try_v: DEMO_COND_V/)
  })

  it('시도 소진(포기) 시에도 차단 출처 커버는 내려간다', () => {
    const giveUp = cron.match(/tries >= MAX_TRIES\) \{[\s\S]{0,700}?continue\s*\}/)?.[0] ?? ''
    expect(giveUp).toMatch(/isBlockedPhotoUrl\(row\.image_url/)
    expect(giveUp).toMatch(/SET is_active = 0/)
  })
})
