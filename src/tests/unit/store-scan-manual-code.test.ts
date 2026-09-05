/**
 * 🎟️ 2026-09-05 대표 *"매장 계산대 페이지에서 바우처 코드 직접 입력하는게 왜 필요하지? 확인해줘"*
 *
 * 답: **필요하다** — 카메라 권한 거부·기기 카메라 없음·손님 화면 파손/저조도에서 유일한 통로다.
 * 그런데 파 보니 **그 폴백이 반쪽으로 동작하고 있었다.**
 *
 *   · 발급 코드 알파벳(`generateVoucherCode`)은 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 전부 대문자.
 *   · 서버 조회는 `WHERE code = ?` — SQLite 기본 BINARY 대조라 대소문자를 가린다.
 *   · 입력칸엔 `autoCapitalize` 가 없어 폰 키보드가 소문자로 시작한다.
 *   ⇒ 유효한 바우처인데 404 "바우처를 찾을 수 없습니다".
 *
 * 라이브 실측(2026-09-05): `vouchers` 전량 대문자 · 소문자로 조회하면 **0건**.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 실제 폰 키보드 동작, 카메라 권한 흐름, 서버측 대조 규칙
 *    (서버는 손대지 않았다 — 정규화는 입력을 받는 클라이언트 몫이다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { extractCode } from '@/components/voucher/VoucherScanner'

const LOCALES = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const

describe('손으로 친 코드 정규화', () => {
  it('소문자로 쳐도 실제 코드(대문자)로 바뀐다 — 이게 안 되면 404 가 뜬다', () => {
    expect(extractCode('ur-a3k7-9m2p')).toBe('UR-A3K7-9M2P')
    expect(extractCode('Ur-A3k7-9M2p')).toBe('UR-A3K7-9M2P')
  })

  it('띄어 치거나 공백이 딸려 붙어도 받는다', () => {
    expect(extractCode('UR A3K7 9M2P')).toBe('URA3K79M2P')
    expect(extractCode('  UR-A3K7-9M2P \n')).toBe('UR-A3K7-9M2P')
  })

  it('QR 경로는 그대로다 — 이미 대문자라 정규화가 무해(idempotent)', () => {
    expect(extractCode('https://urdeal.kr/v/UR-A3K7-9M2P')).toBe('UR-A3K7-9M2P')
    expect(extractCode('https://urdeal.kr/v/ur-a3k7-9m2p')).toBe('UR-A3K7-9M2P')
  })

  it('코드가 아닌 것은 여전히 거른다 (빈값·짧은 값·서버 규격 밖 문자)', () => {
    expect(extractCode('')).toBeNull()
    expect(extractCode('   ')).toBeNull()
    expect(extractCode('UR')).toBeNull()
    expect(extractCode('한글코드입니다')).toBeNull()
    expect(extractCode('https://evil.example/steal')).toBeNull()
  })

  it('발급 알파벳이 대문자 전용이라는 전제가 아직 사실이다', () => {
    // 이 전제가 깨지면 위 대문자 정규화가 **유효한 코드를 망가뜨린다**.
    const src = readFileSync('src/features/group-buy/api/helpers.ts', 'utf-8')
    const m = src.match(/const chars = '([^']+)'/)
    expect(m, '코드 알파벳 상수를 못 찾았다 — 정규화 전제를 재확인할 것').toBeTruthy()
    expect(m![1]).toBe(m![1].toUpperCase())
  })
})

describe('입력칸이 소문자로 시작하지 않는다', () => {
  const src = readFileSync('src/components/voucher/VoucherScanner.tsx', 'utf-8')
  const input = src.slice(src.indexOf('<input'), src.indexOf('</form>'))

  it('autoCapitalize / autoCorrect / spellCheck 가 붙어 있다', () => {
    expect(input).toMatch(/autoCapitalize="characters"/)
    expect(input).toMatch(/autoCorrect="off"/)
    expect(input).toMatch(/spellCheck=\{false\}/)
  })
})

describe('안내 문구가 코드 형식을 알려 준다', () => {
  /**
   * 🩸 `defaultValue` 만 고치면 소용없다 — locale 값이 이긴다(CLAUDE.md 가 기록한 함정).
   *    그래서 **6개 언어 파일**을 판정 대상으로 삼는다.
   */
  for (const lang of LOCALES) {
    it(`${lang}: seller.scan.manualPlaceholder 에 UR-XXXX-XXXX 형식이 있다`, () => {
      const j = JSON.parse(readFileSync(`public/locales/${lang}/translation.json`, 'utf-8'))
      expect(j?.seller?.scan?.manualPlaceholder ?? '').toContain('UR-XXXX-XXXX')
    })
  }
})
