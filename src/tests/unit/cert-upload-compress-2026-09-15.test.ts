/**
 * 📄 사업자등록증 업로드 압축 (2026-09-15, 대표 신고 — 업로드 413).
 *
 * 무엇을 지키는가: 이 레포의 이미지 업로드는 전부 `compressForUpload` 계열을 거치는데
 * **사업자등록증 두 경로만 원본을 그대로 올리고 있었다.** 서버 상한은 10MB(`upload.routes` MAX_SIZE)인데
 * 요즘 폰 사진은 그걸 쉽게 넘는다 → 413. 그리고 사장님이 할 수 있는 일이 없어 **매장 등록이 거기서 막힌다**
 * (에러는 콘솔에만 남고 화면은 "업로드 실패" 한 줄이다).
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 압축 품질(어드민이 등록증을 읽을 수 있는가)은 눈으로 봐야 한다.
 *   여기서는 **상품 사진용 기본값(500KB·1280px)으로 되돌아가지 않는 것**까지만 고정한다.
 *
 * 주입 매니페스트: scripts/mutations/cert-upload-compress.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { compressForDocument } from '../../lib/image-compress'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const MODAL = read('src/components/seller/StoreRegisterModal.tsx')
const SIGNUP = read('src/components/BusinessCertUpload.tsx')

describe('① 두 업로드 경로 모두 압축을 거친다', () => {
  it('매장 등록(/store/new) 이 압축본을 올린다 — 원본이 아니라', () => {
    expect(MODAL).toContain('compressForDocument')
    // 배선이 아니라 **무엇을 보내는가**를 본다: fd 에 담기는 것이 prepared 여야 한다
    expect(MODAL).toMatch(/fd\.append\('file', prepared\)/)
    expect(MODAL).not.toMatch(/fd\.append\('file', file\)/)
  })
  it('가입 단계 업로드도 같다', () => {
    expect(SIGNUP).toContain('compressForDocument')
    expect(SIGNUP).toMatch(/fd\.append\('file', prepared\)/)
    expect(SIGNUP).not.toMatch(/fd\.append\('file', file\)/)
  })
})

describe('② 압축이 등록을 막지 않는다 (fail-soft)', () => {
  it('압축이 실패하면 원본으로 시도한다 — 두 경로 모두', () => {
    for (const src of [MODAL, SIGNUP]) {
      expect(src).toMatch(/compressForDocument\(file\)\.catch\(\(\) => file\)/)
    }
  })
})

describe('③ 가입 경로가 큰 사진을 "그냥 거절" 하지 않는다', () => {
  it('압축 전 크기로 잘라내던 옛 가드가 되살아나지 않는다', () => {
    // 종전: `if (file.size > 10MB) { toast.error(...); return }` — 폰 사진은 그걸 넘는데 할 수 있는 일이 없었다.
    expect(SIGNUP).not.toMatch(/if \(file\.size > 10 \* 1024 \* 1024\)/)
    // 압축 **뒤에도** 넘으면 그때는 말해 준다(그건 정당한 거절이다).
    expect(SIGNUP).toMatch(/prepared\.size > 10 \* 1024 \* 1024/)
  })
})

describe('④ 문서는 상품 사진 기본값으로 압축하지 않는다 (심사 가독성)', () => {
  const SRC = stripComments(readFileSync('src/lib/image-compress.ts', 'utf8'))
  it('maxWidthOrHeight 가 상품 사진(1280)보다 크다 — 사업자번호·상호가 읽혀야 한다', () => {
    const at = SRC.indexOf('export async function compressForDocument')
    expect(at).toBeGreaterThan(0)
    const body = SRC.slice(at, at + 300)
    const w = Number(body.match(/maxWidthOrHeight:\s*(\d+)/)?.[1])
    expect(w).toBeGreaterThanOrEqual(2000)
    const mb = Number(body.match(/maxSizeMB:\s*([\d.]+)/)?.[1])
    expect(mb).toBeGreaterThan(0.5)   // 상품 사진 기본값(0.5MB)으로 되돌아가면 글자가 뭉개진다
    expect(mb).toBeLessThan(10)       // 서버 상한(10MB) 아래여야 압축한 보람이 있다
  })
})

describe('⑤ 동작 — 이미 작은 파일은 그대로 돌려준다(라이브러리 다운로드 0)', () => {
  it('2MB 미만 이미지는 손대지 않는다', async () => {
    const small = new File([new Uint8Array(1024)], 'cert.jpg', { type: 'image/jpeg' })
    const out = await compressForDocument(small)
    expect(out).toBe(small)
  })
})
