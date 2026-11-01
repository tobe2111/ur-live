/**
 * 🖊️ 커스텀 아이콘은 **lucide 의 크기 계약**을 지켜야 한다 (2026-08-31)
 *
 * ■ 실제로 난 사고
 *   대표 신고: *"유어샵 아이콘만 너무 커."* 원인은 취향이 아니라 **버그**였다.
 *   `BottomNav` 는 다섯 탭에 똑같이 `<Icon size={22} />` 를 준다. 그런데 `size` 는
 *   **lucide 가 자기 컴포넌트 안에서 width/height 로 변환해 주는 lucide 전용 prop** 이고
 *   표준 SVG 속성이 아니다. 커스텀 아이콘(`UrShopIcon`)은 그걸 `<svg size="22">` 로
 *   그대로 흘려보냈고 브라우저는 그 속성을 **무시**한다 → width/height 가 없어
 *   그 아이콘만 크기가 안 먹었다. 타입체크도 빌드도 통과한다 — 에러가 없다.
 *
 * ■ 불변식
 *   `src/components/icons/` 의 아이콘은 lucide 아이콘과 **같은 자리에 섞여 쓰이므로**
 *   `size` 를 받아 width/height 로 변환해야 한다.
 *
 * ⚠️ 이 검사가 못 잡는 것: 소스에 배선은 있는데 실제 렌더 크기가 틀린 경우(DOM 미실행).
 *    그건 `visual-preview` 로 눈으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(process.cwd(), 'src/components/icons')

describe('커스텀 아이콘 크기 계약 (lucide 와 섞여 쓰인다)', () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx$/.test(f))

  it('검사 대상이 있어야 한다 — 0건은 통과가 아니라 실패다', () => {
    expect(files.length, '아이콘 경로가 낡았다').toBeGreaterThan(0)
  })

  for (const f of files) {
    it(`${f} — size 를 받아 width/height 로 변환한다`, () => {
      const src = readFileSync(resolve(DIR, f), 'utf-8')
      // 🔀 2026-11-01 재조준 — `sns-logos.tsx`(유튜브·인스타·틱톡 공용 글리프)가 `export function
      //   YouTubeLogo` 모양이라 종전 `export const \w+Icon` 패턴에 **한 글자도 안 걸렸다**.
      //   그 파일은 계약을 지키고 있었는데도 "내보낸 아이콘이 없다" 로 빨간불이 났다 — 즉 패턴이
      //   좁아서 **새 아이콘 파일이 조용히 검사 밖으로 나가는** 쪽이 더 위험했다(이번엔 0건이라
      //   드러났지만, 파일에 `*Icon` 이 하나라도 섞여 있었으면 나머지는 그냥 안 봤을 것이다).
      //   ⇒ 선언 형태(const/function)와 접미사(Icon/Logo) 둘 다 넓힌다. `CategoryTile` 처럼
      //      아이콘이 아닌 부품은 접미사로 걸러진다.
      const exported = [...src.matchAll(/export (?:const|function) (\w+(?:Icon|Logo))\b/g)].map((m) => m[1])
      expect(exported.length, `${f} 에 내보낸 아이콘이 없다`).toBeGreaterThan(0)

      // 각 아이콘이 size 를 구조분해로 꺼내고, svg 에 width/height 로 넘기는가.
      for (const name of exported) {
        const i = src.search(new RegExp(`export (?:const|function) ${name}\\b`))
        // 🔚 다음 `export` 까지가 그 아이콘의 몸통이다. 종전엔 `indexOf('})')` 로 끊었는데
        //    `export function` 선언엔 그 두 글자가 없어 **파일 끝까지** 삼켰다(남의 아이콘이
        //    width/height 를 갖고 있으면 그걸로 통과한다 = 지키는 척).
        const after = src.slice(i + 1).search(/\nexport /)
        const body = src.slice(i, after === -1 ? undefined : i + 1 + after)
        expect(body, `${name}: size 를 prop 으로 꺼내지 않는다 (lucide 는 이걸 준다)`)
          .toMatch(/\{\s*size\s*=/)
        expect(body, `${name}: size 를 width/height 로 넘기지 않는다 — <svg size=".."> 는 브라우저가 무시한다`)
          .toMatch(/width=\{size\}[\s\S]*height=\{size\}/)
      }
    })
  }
})
