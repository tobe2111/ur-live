/**
 * 되돌려-검증 주입 — 한 문서에 같은 `@type` 을 **두 벌** 내지 않는다 (2026-10-14).
 *
 * 이 처방의 위험은 **양방향**이고 둘 다 조용하다:
 *   · 거르기가 꺼지면 → 약 380 URL 이 같은 종류를 다시 두 벌 낸다(에러 0 · 화면 무변화).
 *   · 거르기가 **넓어지면** → 서버가 안 낸 종류까지 지워 구조화 데이터가 통째로 사라진다
 *     (이쪽이 더 나쁘다 — 리치결과가 조용히 없어진다).
 * 그래서 절반을 반대 방향으로 심는다.
 */
const SEO = 'src/components/SEO.tsx'
const LIB = 'src/shared/seo/jsonld-dedupe.ts'
const T = 'src/tests/unit/jsonld-dedupe-2026-10-14.test.tsx'

export default [
  {
    name: '🧬 JSON-LD 중복 — 거르기를 꺼서 fail-open 으로 고정한다(380 URL 이 두 벌로 돌아간다)',
    file: SEO,
    find: '  return dropServerDuplicates(jsonLd, firstLoad ? serverJsonLdTypes(document) : new Set<string>())',
    replace: '  return dropServerDuplicates(jsonLd, new Set<string>())',
    test: T,
    why: '서버·클라가 같은 URL 에 서로 다른 내용의 같은 종류를 선언한다 — 어느 쪽이 쓰일지 정해져 있지 않고 둘 다 버려질 수도 있다.',
  },
  {
    name: '🧬 JSON-LD 중복 — 첫 로드 경로 게이트를 없앤다(SPA 이동 뒤 지금 페이지 노드를 지운다)',
    file: SEO,
    find: "  const firstLoad = INITIAL_PATH !== null && typeof document !== 'undefined'\n    && typeof location !== 'undefined' && location.pathname === INITIAL_PATH",
    replace: "  const firstLoad = typeof document !== 'undefined'",
    test: T,
    why: '서버 노드는 head 에 남으므로 클라 라우팅 뒤에는 *첫 페이지* 종류와 비교하게 된다 — 지금 페이지의 노드를 지운다(반대 방향).',
  },
  {
    name: '🧬 JSON-LD 중복 — 렌더가 다시 원본 jsonLd 를 직접 map 한다(거르는 경로 우회)',
    file: SEO,
    find: '      {usableJsonLd(jsonLd).map((ld, i) => (',
    replace: '      {(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).map((ld, i) => (',
    test: T,
    why: '함수는 남아 있는데 아무도 안 부르면 "있지만 안 도는" 상태가 된다 — 이 레포가 반복해 당한 조용한 부재.',
  },
  {
    name: '🧬 JSON-LD 중복 — 종류를 깊이 훑는다(안쪽 Offer 때문에 클라 Product 를 지운다)',
    file: LIB,
    find: '    push(o[\'@type\'])\n    const g = o[\'@graph\']\n    if (Array.isArray(g)) for (const m of g) visitOne(m)',
    replace: '    push(o[\'@type\'])\n    for (const v of Object.values(o)) { if (Array.isArray(v)) { for (const m of v) visitOne(m) } else visitOne(v) }',
    test: T,
    why: '깊이 훑으면 `Offer`·`PostalAddress`·`ListItem` 같은 안쪽 종류가 잡혀 겹침 판정이 과잉이 된다(반대 방향 — 구조화 데이터가 사라진다).',
  },
  // 🩸 여기 원래 `if (!serverTypes.size) return list` 를 지우는 주입이 있었는데 **헛돌았다** —
  //   그 줄은 성능 단축이고, 지워도 빈 집합에 대한 `types.every(...)` 가 전부 false 라 **행동이 같다**.
  //   ⇒ 행동이 안 바뀌는 자리에 주입을 두면 커버리지를 가진 척만 한다. 실제로 지켜지는 관용으로 옮겼다.
  {
    name: '🧬 JSON-LD 중복 — 깨진 서버 블록 하나가 전체를 못 쓰게 만든다',
    file: LIB,
    find: "      } catch { /* 깨진 블록 하나가 전체를 못 쓰게 만들지 않는다 */ }",
    replace: "      } catch (e) { throw e }",
    test: T,
    why: '남이 넣은 JSON-LD 가 깨져 있으면(광고 스크립트·확장) 그 하나로 거르기 전체가 죽는다 — 관용이 사라지면 렌더가 던진다.',
  },
  {
    name: '🧬 JSON-LD 중복 — 종류를 못 읽은 노드를 버린다(판단 근거 없이 삭제)',
    file: LIB,
    find: '    if (!types.length) return true',
    replace: '    if (!types.length) return false',
    test: T,
    why: '`@type` 이 없는 노드(미래의 다른 모양)를 근거 없이 지운다 — 거르기는 *확실할 때만* 한다(반대 방향).',
  },
  {
    name: '🧬 JSON-LD 중복 — helmet 노드까지 서버 노드로 센다(자기 노드를 자기가 지운다)',
    file: LIB,
    find: "    const els = doc.querySelectorAll('script[type=\"application/ld+json\"]:not([data-rh])')",
    replace: "    const els = doc.querySelectorAll('script[type=\"application/ld+json\"]')",
    test: T,
    why: '`[data-rh]` 제외가 빠지면 클라가 **자기 노드**를 서버 노드로 읽어 다음 렌더에서 스스로를 지운다(반대 방향).',
  },
  {
    name: '🧬 JSON-LD 중복 — 여러 종류 중 하나만 겹쳐도 버린다',
    file: LIB,
    find: '    return !types.every((t) => serverTypes.has(t))',
    replace: '    return !types.some((t) => serverTypes.has(t))',
    test: T,
    why: '`@graph` 로 여러 종류를 담은 노드는 **전부** 겹칠 때만 버려야 한다 — 일부만 겹쳐 버리면 안 겹친 종류가 함께 사라진다(반대 방향).',
  },
]
