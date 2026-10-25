/**
 * 🏠 생활 업체 모집 랜딩 — 로그인 전 `/life/pro` (2026-10-25 대표 "1~3 다 하자").
 *
 * 종전엔 "사장님 계정으로 들어와 주세요" 한 장뿐이라 무엇을 받는지·얼마인지·어떻게 굴러가는지 몰랐고,
 * 그래서 검색에도 내놓지 못했다(robots 차단). 이제 [누구의 일 · 흐름 셋 · 조건 · 받는 일 목록]을 그리고 색인한다.
 * 🔒 숫자는 규칙 SSOT(`home-service.ts`)에서 받는다. 참여권 가격은 어드민이 바꾸므로 **적지 않는다**(로그인 뒤 충전 화면이 보여 준다).
 * 🔒 크롤러 본문(`surface-copy.ts` 의 `/life/pro`)은 이 파일의 문장을 그대로 쓴다 — 가드가 대조한다.
 */
import { Link } from 'react-router-dom'
import { HOME_SERVICE_CATEGORIES, MAX_QUOTES_PER_REQUEST, SIGNUP_FREE_CREDITS, UNVIEWED_REFUND_HOURS } from '@/shared/home-service'

const AUDIENCES = [
  { key: 'store', title: '가게 일' },
  { key: 'lodging', title: '숙소 일' },
  { key: 'home', title: '사장님 집 일' },
] as const

const STEPS = [
  { title: '할 일과 지역을 고르세요', body: '방역·후드 청소·설비 수리·간판처럼 하는 일과 일하는 시·구를 고르면 준비 끝이에요.' },
  { title: '근처 요청이 알림톡으로 와요', body: '식당·카페·숙소 사장님이 요청서를 올리면 그 일과 지역을 고른 업체에 알림이 가요.' },
  { title: '견적을 보내고 선택을 기다리세요', body: '참여권으로 견적을 보내고, 사장님이 고르면 서로 연락처가 공개돼요.' },
] as const

export default function ProLanding() {
  return (
    <div className="space-y-8 pt-2">
      <section>
        <h2 className="text-[24px] font-bold leading-snug tracking-tight">근처 사장님들의 가게 일을<br />알림톡으로 받으세요</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
          식당·카페·숙소 사장님이 올린 견적 요청을 받고, 원하는 일에만 견적을 보내요.
        </p>
      </section>

      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-medium text-white">{i + 1}</span>
            <div>
              <p className="text-[15px] font-bold">{s.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section>
        <h2 className="text-[17px] font-bold">조건</h2>
        <ul className="mt-2 divide-y divide-rule border-y border-rule text-[15px]">
          <li className="flex justify-between gap-3 py-3"><span>처음 등록</span><span className="font-bold">참여권 {SIGNUP_FREE_CREDITS}장 무료</span></li>
          <li className="flex justify-between gap-3 py-3"><span>견적 보내기</span><span className="font-bold">참여권 사용</span></li>
          <li className="flex justify-between gap-3 py-3"><span>요청 하나에 받는 견적</span><span className="font-bold">먼저 보낸 {MAX_QUOTES_PER_REQUEST}곳</span></li>
          <li className="flex justify-between gap-3 py-3"><span>손님이 취소하거나 {UNVIEWED_REFUND_HOURS}시간 안에 안 열어 보면</span><span className="font-bold">참여권 반환</span></li>
        </ul>
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">유어딜은 연결만 해요. 계약과 대금은 사장님과 직접 주고받아요.</p>
      </section>

      <section>
        <h2 className="text-[17px] font-bold">받을 수 있는 일</h2>
        {AUDIENCES.map((a) => (
          <div key={a.key} className="mt-3">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{a.title}</p>
            <p className="mt-1 text-[15px] leading-relaxed">
              {HOME_SERVICE_CATEGORIES.filter((d) => d.audience === a.key).map((d) => d.label).join(', ')}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">유어딜에 가게(사업자)를 등록한 업체만 견적을 보낼 수 있어요.</p>
        <Link to="/login?returnUrl=%2Flife%2Fpro" className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center">카카오로 로그인하고 시작하기</Link>
        <Link to="/store/new" className="block py-2 text-center text-[13px] font-medium text-brand-text">아직 등록한 가게가 없어요 · 가게 등록하기</Link>
      </section>
    </div>
  )
}
