/**
 * 🌐 i18n-lite — i18next 대체가 **i18next 와 같은 문자열**을 내는가 〔2026-10-14〕
 *
 * 화면 문구 수천 곳이 `t(key, { defaultValue, ...vars })` 에 기대고 있다. 하나라도 어긋나면 에러 없이
 * 키 이름이나 `{{x}}` 가 화면에 뜬다. ⇒ ①은 **진짜 i18next 25.8.20 이 낸 값**을 그대로 박아 대조한다
 * (2026-10-14 실측 — 같은 리소스·같은 호출). 나머지는 React 배선과 "다시 들어오지 않는다"를 본다.
 *
 * 못 막는 것: 복수형·서식·중첩(이 앱이 안 쓴다 — 쓰게 되면 여기에 실측값을 더할 것) · 실제 화면 문구.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, act } from '@testing-library/react'
import { I18nLite, useTranslation, Trans, i18n as shared } from '@/lib/i18n-lite'

const resources = {
  ko: { translation: { a: { b: '안녕 {{name}}' }, only: '코만', v: '{{ x }}개', obj: { c: 'd' }, empty: '', m: '{{a}}-{{b}}', tag: '<0>{{n}}</0>님<1/>', 'flat.key': '평평', grp: { 'x.y': '중첩평평' } } },
  en: { translation: { a: { b: 'hi {{name}}' }, e: '', z: '{{count}} items' } },
}

async function make(): Promise<I18nLite> {
  const i = new I18nLite()
  await i.init({ lng: 'en', fallbackLng: 'ko', resources })
  return i
}

describe('① t() = i18next 25.8.20 실측값', () => {
  const cases: Array<[unknown[], string]> = [
    [['a.b', { name: 'K' }], 'hi K'],
    [['a.b'], 'hi {{name}}'],
    [['only'], '코만'],
    [['nope'], 'nope'],
    [['nope', { defaultValue: 'D {{v}}', v: 1 }], 'D 1'],
    [['nope', 'str default'], 'str default'],
    [['v', { x: 3 }], '3개'],
    [['m', { a: 1 }], '1-{{b}}'],
    [['obj'], "key 'obj (en)' returned an object instead of string."],
    [['empty'], ''],
    [['e'], ''],
    [['e', { defaultValue: 'dv' }], ''],
    [['z', { count: 2 }], '2 items'],
    [['a.b', { name: null }], 'hi '],
    [['a.b', { name: 0 }], 'hi 0'],
    [['a.b', { lng: 'ko', name: 'L' }], '안녕 L'],
    [['a.b', { name: '<b>&' }], 'hi <b>&'],
    [['tag', { n: 5 }], '<0>5</0>님<1/>'],
    [['nope.deep', { defaultValue: '' }], ''],
    [['flat.key'], '평평'],
    [['grp.x.y'], '중첩평평'],
  ]
  for (const [args, want] of cases) {
    it(JSON.stringify(args), async () => {
      const i = await make()
      expect((i.t as (...a: unknown[]) => string)(...args)).toBe(want)
    })
  }
})

describe('② 인스턴스 동작', () => {
  it('postProcess 에 적은 후처리기만 돈다', async () => {
    const i = new I18nLite()
    i.use({ type: 'postProcessor', name: 'strip', process: (v: string) => v.replace(/^\[TODO:[a-z]{2}\]\s*/, '') })
    await i.init({ lng: 'ko', resources: { ko: { translation: { k: '[TODO:en] 문구' } } }, postProcess: ['strip'] })
    expect(i.t('k')).toBe('문구')
  })
  it('빠진 키는 missingKeyHandler 를 부른다(대시보드 문구 안전망)', async () => {
    const seen: string[] = []
    const i = new I18nLite()
    await i.init({ lng: 'ko', resources: { ko: { translation: {} } }, saveMissing: true, missingKeyHandler: (_l, _n, k) => { seen.push(k) } })
    i.t('seller.x', { defaultValue: '기본' })
    expect(seen).toEqual(['seller.x'])
  })
  it('addResourceBundle(deep, overwrite=false) 는 이미 있는 키를 덮지 않는다', async () => {
    const i = new I18nLite()
    await i.init({ lng: 'ko', resources: { ko: { translation: { a: { x: '원래' } } } } })
    i.addResourceBundle('ko', 'translation', { a: { x: '새것', y: '더함' } }, true, false)
    expect(i.t('a.x')).toBe('원래')
    expect(i.t('a.y')).toBe('더함')
  })
})

describe('③ React — 다시 그리기 · Trans', () => {
  function Probe() {
    const { t } = useTranslation()
    return <p>{t('probe.k', { defaultValue: '기본값' })}</p>
  }
  it('문구가 더해지면(added) 다시 그린다', () => {
    render(<Probe />)
    expect(screen.getByText('기본값')).toBeTruthy()
    act(() => { shared.addResourceBundle(shared.language, 'translation', { probe: { k: '도착' } }, true, true) })
    expect(screen.getByText('도착')).toBeTruthy()
  })
  it('<Trans> 가 <0>…</0> · <1></1> 을 components 로 바꾼다', () => {
    shared.addResourceBundle(shared.language, 'translation', { tr: { k: '<0>{{name}}</0>님이<1></1>선물' } }, true, true)
    const { container } = render(<Trans i18nKey="tr.k" values={{ name: '민지' }} components={[<span key="0" className="x" />, <br key="1" />]} />)
    expect(container.innerHTML).toBe('<span class="x">민지</span>님이<br>선물')
  })
})

describe('④ 배선 — 앱 코드가 i18next 를 다시 끌어오지 않는다', () => {
  const root = process.cwd()
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'tests' ? [] : walk(path.join(d, e.name)))
      : /\.(tsx?|mjs|js)$/.test(e.name) ? [path.join(d, e.name)] : [])
  it("src(테스트 제외)에 i18next·react-i18next import 0건", () => {
    const files = walk(path.join(root, 'src'))
    expect(files.length).toBeGreaterThan(500)
    const re = /from\s+['"](i18next|react-i18next|i18next-[a-z-]+)['"]|import\(\s*['"](i18next|react-i18next)['"]\s*\)/
    expect(files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f))).toEqual([])
  })
  it('src/i18n.ts 는 i18n-lite 인스턴스를 설정한다', () => {
    expect(fs.readFileSync(path.join(root, 'src/i18n.ts'), 'utf8')).toMatch(/from '\.\/lib\/i18n-lite'/)
  })
})
