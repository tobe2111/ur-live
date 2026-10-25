/**
 * 🍽️ 통신판매 수집의 **레코드 상한을 서비스별로 나눈다** (2026-10-25).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 *
 * `runCommerceNotifyCollect` 은 두 서비스를 한 루프에서 돈다 — `status`(등록현황, **이메일**)와
 * `detail`(등록상세, **취급품목**). 그런데 회차 레코드 상한(`MAX_RECORDS_PER_RUN`, CPU 천장)을 세는
 * `found` 가 **두 서비스의 공유 누적**이라, 먼저 도는 `status` 가 상한을 다 먹고 `detail` 은 루프 첫
 * 검사에서 즉시 빠졌다. 즉 **한 페이지도 받지 못했다.**
 *
 * ```
 *   2026-10-25 라이브:  최근 12회차 전부  stopped_by: records   found 999~1,000
 *                       diag.by_service   = { status: … }        ← detail 없음
 *                       ads_commerce_cursor_detail = 47 (멈춘 지 오래)
 * ```
 *
 * 🔑 취급품목(`trtmntPrdlstNm`)은 **`detail` 에만** 온다. 그래서 그 값을 여태 한 번도 못 봤고,
 * 업종이 발송 가능 리드의 **93.0%(58,389/62,757 — 2026-10-25 재측정)** 에서 `통신판매` 로 남은 원인이
 * 여기였다 — 2026-10-24 에 붙인 탐침(`commerceProbe`)도 **값이 올 수 없어** 빈 채였다.
 *
 * ⚠️ **`stopped_by` 는 이 수리의 E4 신호가 아니다**(2026-10-25 트레이스로 정정). 수리 뒤에도
 * `records` 로 남는다 — `detail` 이 페이지를 받으면 `found` 가 1,000 이 되고 `perService ≥ 2` 라
 * 다음 반복의 전역 상한 판정이 **반드시 한 번 돈다**. 그리고 그 값은 **옳다**(1,000행 = 설계된 CPU
 * 천장). E4 신호는 **`diag.by_service` 의 `detail` 키**와 **`ads_commerce_cursor_detail` 전진** 둘뿐이다.
 *
 * ## 이 시험이 지키는 것
 *
 * 지키려는 성질은 "몫 변수가 있다" 가 아니라 **"마지막 서비스도 최소 한 페이지를 받는다"** 와
 * **"그러면서 파싱량(CPU)이 안 늘어난다"** 두 가지다. 둘 다 상수들 사이의 **산수**로 판정되므로
 * 문자열 검사가 아니라 숫자로 단언한다(상수는 모듈 비공개라 소스에서 뽑는다).
 *
 * ## 이 시험이 못 보는 것
 *
 * · 공정위 API 가 `detail` 에 실제로 무엇을 주는지 — 이 컨테이너는 그 도메인이 막혀 있고(CONNECT 403)
 *   판정은 배포 후 어드민 `commerceProbe.goods.detail.kind` 다.
 * · `detail` 의 수확이 업종 분류를 실제로 채우는지(그건 ②의 다음 단계).
 * · 런타임 루프 동작 — 이 함수는 네트워크·D1·env 를 다 요구해 유닛 밖이다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { COMMERCE_SERVICES } from '@/features/marketing/api/commerce-notify-collect'

/** ⚠️ 판정은 **주석 제거본**으로 — 이 파일의 설명이 옛 패턴을 그대로 인용한다(거짓 통과/실패 둘 다 막는다). */
const SRC = readCode('src/features/marketing/api/commerce-notify-collect.ts')

/** 모듈 비공개 상수를 소스에서 뽑는다(손으로 베끼면 상수를 바꿔도 시험이 안 따라온다). */
function constOf(name: string): number {
  const m = SRC.match(new RegExp(`const ${name} = ([0-9_]+)`))
  expect(m, `${name} 을 못 찾았다 — 이름이 바뀌었으면 이 시험도 재조준할 것`).toBeTruthy()
  return Number(m![1]!.replace(/_/g, ''))
}

describe('통신판매 수집 — 서비스별 레코드 몫 (2026-10-25)', () => {
  it('① 마지막 서비스도 **최소 한 페이지**를 받는다 — 전역 상한이 앞 서비스들에 다 먹히지 않는다', () => {
    const max = constOf('MAX_RECORDS_PER_RUN')
    const rows = constOf('PAGE_ROWS')
    const n = COMMERCE_SERVICES.length
    // 🧮 몫 검사는 페이지를 **받기 전에** 보므로 각 서비스는 몫이 양수인 한 1페이지를 받는다.
    //   그러면 마지막 서비스가 자기 차례에 보는 전역 누적은 최대 rows × (n − 1) 이다.
    //   그 값이 전역 상한에 닿으면 그 서비스는 **또 굶는다**(수리 전 `detail` 이 정확히 그랬다).
    expect(rows * (n - 1), `서비스 ${n}개 · 페이지 ${rows}행 · 전역 상한 ${max} — 마지막 서비스가 굶는다. 상한·마감선을 재측정해 올릴 것(몫만 늘리면 CPU 사망으로 돌아간다)`)
      .toBeLessThan(max)
  })

  it('② 몫은 전역 상한을 서비스 수로 나눈 값이고, **전역 상한은 그대로 남는다**(CPU 천장)', () => {
    expect(SRC, '몫이 전역 상한에서 파생되지 않는다 — 상한을 내려도 몫이 안 따라온다')
      .toMatch(/const recordsPerService = Math\.max\(1, Math\.floor\(MAX_RECORDS_PER_RUN \/ services\.length\)\)/)
    expect(SRC, '전역 상한 검사가 사라졌다 — 몫만 두면 N×(몫+페이지) 로 파싱량이 넘친다(CPU 사망)')
      .toMatch(/if \(found >= MAX_RECORDS_PER_RUN\) \{ stoppedBy = 'records'; break \}/)
    expect(SRC, '몫 검사가 없다 — 앞 서비스가 상한을 다 먹고 뒤가 굶는 상태로 돌아갔다')
      .toMatch(/if \(foundThisService >= recordsPerService\) break/)
  })

  it('③ 몫 소진은 `stopped_by` 를 세우지 않는다 — 회차가 멈춘 게 아니라 정상 종료다', () => {
    const i = SRC.indexOf('if (foundThisService >= recordsPerService)')
    expect(i).toBeGreaterThan(0)
    expect(SRC.slice(i, i + 80), "몫 소진에 stoppedBy 를 세우고 있다 — 'deadline' 을 세우면 바깥 루프가 끊겨 다음 서비스가 다시 굶는다(이 수리가 없앤 그 결함). ⚠️ stopped_by 자체는 E4 신호가 아니다 — 마지막 서비스가 페이지를 받은 뒤 전역 상한에 닿아 records 로 남는 것이 정상이다").not.toMatch(/stoppedBy/)
  })

  it('④ 서비스별 누적은 **전역 `found` 와 별개 변수**이고 같은 자리에서 함께 늘어난다', () => {
    expect(SRC, '서비스별 누적 변수가 서비스 루프 안에서 초기화되지 않는다(회차 전체로 새면 뒤 서비스가 또 굶는다)')
      .toMatch(/const ck = `\$\{CURSOR_KEY\}_\$\{svc\.name\}`[\s\S]{0,400}let foundThisService = 0/)
    expect(SRC, '전역 found 는 늘리는데 서비스별 누적을 안 늘린다 — 몫 검사가 영원히 거짓이 된다')
      .toMatch(/found \+= leads\.length\s*\n\s*foundThisService \+= leads\.length/)
  })

  it('⑤ 서비스 목록은 **두 개 그대로**다 — `detail` 이 사라지면 취급품목을 다시 못 본다', () => {
    expect(COMMERCE_SERVICES.map(s => s.name)).toEqual(['status', 'detail'])
    // 🔭 취급품목은 detail 전용이다(탐침의 전제).
    expect(COMMERCE_SERVICES[1]!.base).toContain('MllBsDtl_3Service')
  })
})
