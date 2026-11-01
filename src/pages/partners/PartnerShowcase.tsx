/**
 * 🏪 사장님 몫 + 실제 화면 — 고급화 시안 ③④⑤ (2026-11-01 대표 *"전부 세 페이지에 모두 적용해줘"*)
 *
 * 한 묶음(`ToneScroll`) 안에서 바탕이 어둠 → 밝음으로 넘어간다:
 *   ① 어두운 바탕에 화면을 채우는 **90%** — 지나가는 만큼 파랗게 찬다(사장님 몫).
 *   ② 밝은 바탕에 **실기기 폰 두 대** — 손님 쪽은 라이브 앱을 녹화한 영상, 사장님 쪽은 QR 스캔 화면.
 *
 * ⚠️ 숫자는 `PARTNER_FACTS` 에서만 읽는다(`partners-facts.test.ts` 가 대표 승인 덱과 대조).
 *   90% 는 **직접 입점 기준**이라 그 말을 숫자 바로 아래 적는다 — 대행사를 통하면 다르다.
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { Reveal } from '../landing/motion'
import { DeviceStage, GiantNumber, ToneScroll } from '../landing/premium'
import { SHOT } from './PartnerPhone'

const SHARE = Number.parseInt(F.storeShareDirect, 10) / 100

export default function PartnerShowcase() {
  return (
    <ToneScroll initial="ink">
      <section data-tone="ink">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-24 lg:py-40 overflow-hidden">
          <GiantNumber value={String(Math.round(SHARE * 100))} unit="%" fill={SHARE}
            label={`팔린 금액의 ${F.storeShareDirect}가 사장님 몫`} />
          <div className="mt-10 lg:mt-14 grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-20">
            <Reveal><h2 className="ur-tone-fg text-[28px] lg:text-[48px] font-extrabold leading-[1.22]">
              팔린 금액의 {F.storeShareDirect}가<br />사장님 통장으로
            </h2></Reveal>
            <Reveal delay={120}>
              <div className="ur-share-bar" aria-hidden>
                <i className="bg-brand" style={{ width: F.storeShareDirect }} />
              </div>
              <div className="mt-3 flex justify-between text-[13px] ur-tone-mu tabular-nums">
                <span>사장님 {F.storeShareDirect}</span><span>수수료 {F.feeDirect}</span>
              </div>
              <p className="mt-4 text-[13px] lg:text-[15px] ur-tone-mu">
                직접 입점 기준. 대행사를 통하면 수수료 {F.feeBrokered}. 미리 내는 돈 0원.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section data-tone="paper">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-20 lg:py-36 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
          <div>
            <Reveal><h2 className="ur-tone-fg text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold leading-[1.18]">
              손님은 사진 보고 사고,<br />사장님은 QR 한 번
            </h2></Reveal>
            <Reveal as="p" delay={80} className="mt-5 lg:mt-7 text-[15px] lg:text-[17px] leading-[1.7] ur-tone-mu max-w-[24em]">
              손님 화면은 실제 앱을 녹화한 영상입니다.
            </Reveal>
          </div>
          <DeviceStage
            back={{ shot: SHOT('customer-home-poster'), video: '/static/partners/customer-home.mp4', alt: '손님이 동네 이용권 목록을 넘겨 보는 실제 앱 화면', tag: '손님 화면', live: true }}
            front={{ shot: SHOT('seller-scan'), alt: '매장 폰으로 손님 QR 을 찍는 화면', tag: '사장님 화면' }}
            toast={{ title: '이용권 사용 완료', sub: '정산 목록에 올라갔어요' }}
          />
        </div>
      </section>
    </ToneScroll>
  )
}
