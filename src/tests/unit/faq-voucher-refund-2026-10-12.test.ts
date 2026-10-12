/**
 * 🎟️ `/faq` 가 **자기 설명이 약속한 답**을 준다 (2026-10-12)
 *
 * **왜 있나(라이브 실측 — Googlebot UA 로 서버 HTML 을 받아 파싱했다)**: `/faq` 는 크롤러 본문이
 * **1,515자**로 소비자 표면 중 가장 길고, AI 검색이 브랜드 질의에 가장 많이 인용하는 페이지다.
 * 그런데 그 페이지의 메타가 약속한 것을 **안 주고 있었다**:
 *
 *     title        자주 묻는 질문 - 이용권 사용·**환불**
 *     description  이용권은 어떻게 쓰는지, **유효기간이 지나면 어떻게 되는지**, 환불은 언제 되는지
 *     ────────────────────────────────────────────────────────────────────────────
 *     Q&A 14건 중  유효기간 만료 답 **0건**
 *                  유일한 환불 답(q6)은 **배송 상품** 절차("상품 회수 확인 후 3-7 영업일")
 *
 * ⇒ *"유어딜 이용권 환불돼?"* 를 물으면 AI 가 **택배 반품 절차**를 인용한다. 간판 상품(이용권)의
 * 환불 경로가 가장 많이 읽히는 페이지에 한 글자도 없었다 — 에러도 배포 실패도 없다.
 *
 * 🔒 **답은 코드에서 확인한 것만 적었다**(지어내기 금지):
 *   - 만료 자동환불 → `handleExpiredVoucherRefunds`(`worker/cron/auto-settlement.ts`)
 *   - 사용 전 환불 요청 → `pages/my-vouchers/QRModal.tsx` → `POST /api/returns/request`
 * 그래서 이 시험은 **그 근거가 살아 있는지도 함께** 본다(근거가 사라지면 FAQ 가 거짓말이 된다).
 *
 * ⚠️ **이 시험이 못 보는 것**: AI 가 실제로 그 답을 인용하는지(외부 판정 · 수일~수주) ·
 *    만료 환불 cron 이 라이브에서 실제로 도는지(하트비트·원장만 안다) · 번역 품질
 *    (다섯 언어는 기존 관례대로 `[TODO:xx] <한국어>` 자리표시자다 — 지어낸 번역보다 낫다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { CONCEPT_FAQ } from '@/shared/seo/concept-content'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'

/** 판정은 **주석을 뺀 실행되는 줄**로 — 설명이 인용한 문자열에 걸려 거짓 통과/빨간불이 난다. */
const code = readCode
const CRON = 'src/worker/cron/auto-settlement.ts'
const QR = 'src/pages/my-vouchers/QRModal.tsx'

/** 이용권 환불을 다루는 두 답(이번에 추가분). */
const expiry = () => CONCEPT_FAQ.find((f) => f.key === 'faq.q15')!
const preUse = () => CONCEPT_FAQ.find((f) => f.key === 'faq.q16')!

describe('① 메타가 약속한 답이 실재한다 — 양방향', () => {
  it('description·title 이 유효기간·환불을 약속하고, 그 답이 Q&A 에 있다', () => {
    const meta = CONSUMER_SURFACE_SEO['/faq']
    // 🔴 양방향이다: 약속을 지우면 이 줄이, 답을 지우면 아래 줄이 빨간불이 된다.
    //    한 방향만 보면 "답을 지우고 약속도 같이 지우기" 로 조용히 빠져나갈 수 있다.
    expect(meta.description, '/faq 설명이 유효기간을 약속하지 않는다').toContain('유효기간이 지나면')
    expect(meta.title, '/faq 제목이 환불을 약속하지 않는다').toContain('환불')

    const qs = CONCEPT_FAQ.map((f) => f.question).join(' ')
    expect(qs, '유효기간 만료 답이 없다 — 설명이 약속한 것을 안 준다').toContain('유효기간이 지나면')
  })

  it('이용권 환불 답 둘이 실재하고 비어 있지 않다', () => {
    for (const f of [expiry(), preUse()]) {
      expect(f, '이용권 환불 Q&A 가 사라졌다').toBeTruthy()
      expect(f.answer.length, `빈 답변: ${f.key}`).toBeGreaterThan(30)
      expect(f.categoryKey, '환불 답이 교환/환불 묶음 밖에 있다').toBe('faq.catExchange')
    }
  })
})

describe('② 이용권 답과 배송 답이 섞이지 않는다', () => {
  it('배송 절차를 답하는 두 질문은 **배송 상품**으로 스코프돼 있다', () => {
    // 🩸 답변은 byte-불변으로 두고 **질문만** 좁혔다 — 정책을 바꾼 게 아니라 범위를 밝힌 것이다.
    const q5 = CONCEPT_FAQ.find((f) => f.key === 'faq.q5')!
    const q6 = CONCEPT_FAQ.find((f) => f.key === 'faq.q6')!
    expect(q5.question, '배송 교환/반품 질문이 다시 전체를 가리킨다').toContain('배송 상품')
    expect(q6.question, '배송 환불 질문이 다시 전체를 가리킨다').toContain('배송 상품')
    // 그 답변은 원래 운영 안내 그대로여야 한다(이 변경이 정책을 건드리지 않았다는 증거).
    expect(q5.answer).toContain('왕복 배송비')
    expect(q6.answer).toContain('영업일')
  })

  it('이용권 환불 답에 택배·배송비가 섞이지 않는다', () => {
    for (const f of [expiry(), preUse()]) {
      for (const bad of ['배송비', '택배', '회수', '왕복']) {
        expect(f.answer, `${f.key} 에 배송 절차가 섞였다: ${bad}`).not.toContain(bad)
      }
    }
  })

  it('🔴 교환권(기프티콘) 만료를 말하지 않는다 — 다른 레일이라 확인하지 않았다', () => {
    // `handleExpiredVoucherRefunds` 는 `vouchers` 테이블을 돈다. 교환권은 `voucher_orders`(KT)
    // 라 같은 규칙이라고 말할 근거가 없다 — 모르는 것을 답하지 않는 쪽이 지어내기보다 낫다.
    for (const f of [expiry(), preUse()]) {
      for (const bad of ['교환권', '기프티콘']) {
        expect(f.answer, `${f.key} 가 확인하지 않은 레일(${bad})을 답한다`).not.toContain(bad)
      }
    }
  })
})

describe('③ 코드 근거가 살아 있다 — 근거가 사라지면 FAQ 가 거짓말이 된다', () => {
  it('만료 자동환불 cron 이 실재하고, 신청 없이 환불 + 알림을 한다', () => {
    const c = code(CRON)
    expect(c, '만료 환불 함수가 사라졌다').toContain('export async function handleExpiredVoucherRefunds')
    // 답변이 약속하는 두 경로: 딜 결제 → 딜로 · 카드 결제 → 카드로.
    expect(c, '딜 환불 경로가 사라졌다').toMatch(/payment_method === 'deal_points'[\s\S]{0,400}adjustUserPoints/)
    expect(c, '카드 환불 경로가 사라졌다').toMatch(/payment_method === 'toss' \|\| voucher\.payment_method === 'CARD'/)
    expect(c, '환불 알림이 사라졌다 — 답변은 "알림으로 알려드립니다" 라고 약속한다').toContain('INSERT INTO notifications')
    expect(expiry().answer).toContain('알림')
  })

  it('소비자 화면도 같은 약속을 한다 — 화면과 FAQ 가 갈리지 않는다', () => {
    // 🔑 비율(100%)의 SSOT 는 **화면**이다(이 배열은 규율 ③ 으로 수치를 적지 않는다).
    //    그래서 화면의 약속이 사라지면 FAQ 의 "자동으로 환불" 도 근거를 잃는다 — 여기서 묶는다.
    // 🩸 첫 판은 두 파일을 **이어 붙여** 검사했는데, 한쪽에서 약속을 지워도 다른 쪽 문자열이
    //    남아 통과했다(주입이 잡았다). 구매 화면은 모바일 바와 PC 박스 **둘**이고 둘 다 약속한다
    //    — 한쪽만 거두면 그 화면에서만 FAQ 와 갈리므로 **파일별로** 본다.
    for (const f of ['src/pages/group-buy/DealBottomBar.tsx', 'src/pages/group-buy/DealPurchaseBox.tsx']) {
      expect(code(f), `${f} 의 자동환불 약속이 사라졌다`).toContain('자동환불')
    }
    expect(expiry().answer, 'FAQ 가 자동환불을 말하지 않는다').toContain('자동으로 환불')
  })

  it('사용 전 환불 요청 경로가 실재한다', () => {
    const q = code(QR)
    expect(q, '환불 요청 요청 경로가 사라졌다').toContain("'/api/returns/request'")
    expect(preUse().answer, 'FAQ 가 버튼 이름과 다른 말을 한다').toContain('환불 요청')
    // 화면 토스트가 "확인 후 처리해 드릴게요" 라 FAQ 도 즉시 환불이라고 말하지 않는다.
    expect(q, '접수-후-처리 안내가 사라졌다').toContain('확인 후 처리')
    expect(preUse().answer, 'FAQ 가 즉시 환불처럼 말한다').toContain('접수 후 확인')
  })
})

describe('④ 출력 — 빌더를 돌려 셋에 다 실리는지 본다', () => {
  it('FAQPage JSON-LD 가 SSOT 전부를 내고 새 둘이 들어 있다', () => {
    // 리터럴을 지어내지 않고 **진짜 표면 메타**를 쓴다(설명의 약속과 같은 출처). `canonical` 은
    // 워커가 조립해 넘기는 값이라 여기서만 보탠다.
    const meta = { ...CONSUMER_SURFACE_SEO['/faq'], canonical: 'https://urdeal.kr/faq' }
    const out = buildSurfaceListJsonLd('/faq', '', 'https://urdeal.kr', meta, null)
    const g = JSON.parse(out.replace(/\\u003c/g, '<')) as { '@graph': Array<Record<string, unknown>> }
    const faq = g['@graph'].find((n) => n['@type'] === 'FAQPage') as
      | { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }
      | undefined
    expect(faq, '/faq 가 FAQPage 를 안 낸다').toBeTruthy()
    expect(faq!.mainEntity).toHaveLength(CONCEPT_FAQ.length)
    const names = faq!.mainEntity.map((q) => q.name)
    expect(names).toContain(expiry().question)
    expect(names).toContain(preUse().question)
  })

  it('크롤러 본문에 두 답이 실린다', () => {
    const ns = buildStaticSurfaceNoscript('/faq', null)
    const txt = ns.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(txt.length, '본문이 비었다 — 0자면 통과가 아니라 고장이다').toBeGreaterThan(1200)
    expect(txt).toContain(expiry().question)
    expect(txt).toContain('따로 신청하지 않아도')
  })

  it('llms.txt 에도 두 답이 실린다 — AI 가 받는 안내서', () => {
    const t = buildLlmsTxt('https://urdeal.kr')
    expect(t).toContain(expiry().question)
    expect(t).toContain(preUse().question)
  })
})

describe('⑤ 여섯 언어 로케일 동기', () => {
  it('새 두 건이 여섯 언어에 다 있다 — 한 언어만 비면 그 언어 사용자는 한국어를 본다', () => {
    for (const lang of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const t = JSON.parse(readRaw(`public/locales/${lang}/translation.json`)) as { faq: Record<string, string> }
      for (const n of ['15', '16']) {
        expect(t.faq[`q${n}`], `${lang} 로케일에 faq.q${n} 이 없다`).toBeTruthy()
        expect(t.faq[`a${n}`], `${lang} 로케일에 faq.a${n} 이 없다`).toBeTruthy()
      }
      // 스코프한 두 질문도 로케일까지 따라가야 한다(한쪽만 바뀌면 화면과 구조화 데이터가 갈린다).
      for (const n of ['5', '6']) {
        expect(t.faq[`q${n}`], `${lang} 로케일 faq.q${n} 이 배송 스코프를 잃었다`).toContain('배송 상품')
      }
    }
  })
})
