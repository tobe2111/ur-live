/**
 * 🎨 시안 세트 — 사업자 유저 가입(`/seller/register/supplier`).
 *
 * 대표(2026-09-21): *"여기 UI 디자인 수정 필요. 너무 복잡함. 심플하게 진행 필요. 시안 필요"*
 *                 → *"시안 더 대기업스럽게 완성도있게 시안 여러개 만들어서 줘."*
 *
 * 실측(430px 렌더, `out/visual/signup-asis.png`): 한 화면에 **블록 10개** + **진행 숫자 5종**
 * (헤더 `1 / 3` · `0 / 3` · `0 / 2` · `3 남음` · `필수 0/5`). 각각은 이유가 있어 들어왔지만
 * (09-15 개편 · 09-16 안 2 · 07-02 단일 퍼널) 합쳐 놓으니 **지금 할 일 다섯 칸**이 그 사이에 묻힌다.
 *
 * 🔑 서버가 실제로 요구하는 필수는 셋(가게명·사업자번호·연락처, `seller-registration.routes.ts:387`).
 *    대표자명·개업일은 국세청 자동 승인용이라 다섯을 받는다 ⇒ **줄일 것은 칸이 아니라 블록**이다.
 *    매장 종류·주소·소개는 가입 뒤 매장 등록 위저드(`StoreRegisterModal`)가 카카오맵에서 다시 받는다.
 *
 * 🏢 여섯 안은 축 셋으로 갈린다 — 골라서 섞을 수 있다:
 *    ① 화면 수: 한 장(B·C) / 두 묶음(D) / 한 질문 한 화면(E)
 *    ② 입력 생김새: 밑줄형(B — 09-16 확정 시각 C) / 박스형(C — 업무용 폼)
 *    ③ 타이핑을 줄이는가: 직접 입력(B~E) / 등록증 사진 OCR(F)
 *
 * ⚠️ 여기 값은 전부 가짜다. API 를 부르지 않는다.
 */
import { Camera, Search } from 'lucide-react'
import type { VariantSet, VariantCtx } from '../registry'
import { Field, ChipGroup, INPUT, STORE_CATEGORIES } from '../../seller-register/RegisterFields'
import { CARD, Screen, Nav, Progress, Title, AutoBadge, LineRow, BoxRow, Terms, Cta, Escape, Gap } from './seller-signup-parts'

// ── 가짜 데이터 ───────────────────────────────────────────────────────────────
const FULL = {
  business_number: '123-45-67890', representative_name: '정지원', business_start_date: '2021-03-02',
  business_name: '홍대 매운돈까스', phone: '010-1234-5678',
}
const EMPTY = { business_number: '', representative_name: '', business_start_date: '', business_name: '', phone: '' }
type Form = typeof FULL
const pick = (c: VariantCtx): Form => (c.data === 'full' ? FULL : EMPTY)
const done = (f: Form) => Object.values(f).filter(Boolean).length

/** 다섯 칸의 라벨·자리표시자 — 여섯 안이 같은 문구를 쓴다(안마다 다르면 비교가 안 된다). */
const F = {
  business_number: { label: '사업자번호', placeholder: '000-00-00000', num: true },
  representative_name: { label: '대표자명', placeholder: '사업자등록증에 적힌 이름' },
  business_start_date: { label: '개업일', placeholder: 'YYYY-MM-DD', num: true, type: 'date' },
  business_name: { label: '가게명', placeholder: '손님에게 보이는 이름' },
  phone: { label: '연락처', placeholder: '010-0000-0000', num: true, type: 'tel', hint: '주문·정산 알림톡을 받는 번호' },
} as const
type Key = keyof typeof F

function Rows({ f, idp, keys, box }: { f: Form; idp: string; keys: readonly Key[]; box?: boolean }) {
  const R = box ? BoxRow : LineRow
  return <>{keys.map(k => <R key={k} idp={idp} name={k} value={f[k]} {...F[k]} />)}</>
}

// ── 안 A — 지금 (기준선) ─────────────────────────────────────────────────────
function VariantA(ctx: VariantCtx) {
  const f = pick(ctx)
  const b3 = [f.business_number, f.representative_name, f.business_start_date].filter(Boolean).length
  const s2 = [f.business_name, f.phone].filter(Boolean).length
  const box = 'rounded-[16px] border border-rule bg-white'
  return (
    <Screen>
      <div className="flex h-12 items-center gap-2 border-b border-rule bg-white px-3">
        <span className="text-[15px] font-bold">‹ 사업자 유저 가입</span>
        <span className="dash-num ml-auto text-[12px] font-semibold text-gray-400">1 / 3</span>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className={`${box} flex items-center gap-3 px-4 py-3`}>
          <span className="h-9 w-9 shrink-0 rounded-full bg-brand-tint" />
          <p className="text-[13px] leading-snug text-gray-600"><strong className="text-gray-900">정지원</strong> 카카오 계정에 판매 기능이 추가됩니다. 유어샵·구매내역은 그대로 유지돼요.</p>
        </div>
        <header className="px-1 pt-3">
          <h2 className="text-[24px] font-extrabold leading-[1.26] tracking-[-.03em]">사업자번호만 맞으면 대시보드에 바로 들어가요</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">서류는 들어가서 채워도 됩니다. 승인 전까지 손님에게는 안 보여요.</p>
        </header>
        <p className="px-1 text-center text-[12px] text-gray-500">상품 추천·커미션만 원하시나요? 가입 없이 <span className="font-bold text-brand-text underline">내 유어샵</span>에서 바로 시작할 수 있어요.</p>
        <section className={`${box} px-4 pb-3 pt-4`}>
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">사업자 정보</h3><span className="dash-num text-[12px] font-bold text-brand-text">{b3} / 3</span></div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">사업자등록증에 적힌 그대로. 국세청 정보와 일치하면 심사 없이 바로 승인돼요.</p>
          <div className="mt-3">
            <Rows f={f} idp="a" keys={['business_number', 'representative_name', 'business_start_date']} />
            <Field id="a-cert" label="사업자등록증 사본" hint="지금 등록증을 보고 계시면 한 장 찍어 올려 주세요. 심사가 빨라집니다.">
              <div className="flex h-12 items-center justify-center rounded-xl border border-dashed border-rule-strong text-[14px] font-semibold text-gray-600">사업자등록증 이미지 첨부</div>
            </Field>
          </div>
        </section>
        <section className={`${box} px-4 pb-3 pt-4`}>
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">가게 정보</h3><span className="dash-num text-[12px] font-bold text-brand-text">{s2} / 2</span></div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">유어샵과 이용권에 그대로 보여요. 나중에 대시보드에서 바꿀 수 있어요.</p>
          <div className="mt-3">
            <Rows f={f} idp="a" keys={['business_name', 'phone']} />
            <Field id="a-cat" label="매장 종류"><ChipGroup name="매장 종류" value={ctx.data === 'full' ? 'restaurant' : ''} onChange={() => {}} options={STORE_CATEGORIES} /></Field>
            <Field id="a-addr" label="매장 주소" hint="가게 이름으로 찾으면 주소가 자동으로 들어가요">
              <div className="flex items-center"><input id="a-addr" readOnly value={ctx.data === 'full' ? '서울 마포구 와우산로 00' : ''} placeholder="가게 이름으로 찾기" className={INPUT} /><Search className="h-4 w-4 text-gray-400" /></div>
            </Field>
            <Field id="a-desc" label="매장 소개 (선택)"><input id="a-desc" readOnly value="" placeholder="매장 분위기, 대표 메뉴, 운영 시간 등" className={INPUT} /></Field>
          </div>
        </section>
        <section className={`${box} px-4 pb-3 pt-4`}>
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">승인까지 남은 것</h3><span className="text-[12px] font-bold text-tone-warn">3 남음</span></div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">들어가서 채워도 됩니다. 다 채우면 심사가 시작돼요.</p>
          <dl className="mt-3">{[['사업자등록증', '위에서 첨부'], ['영업신고증', '음식점 필수'], ['정산 계좌', '정산 전까지']].map(([k, v]) => (
            <div key={k} className="flex justify-between border-t border-rule py-2.5 first:border-t-0"><dt className="text-[13.5px] font-semibold">{k}</dt><dd className="text-[11.5px] font-bold text-gray-500">{v}</dd></div>
          ))}</dl>
        </section>
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3"><Terms agreed={ctx.data === 'full'} /></div>
        <ul className="space-y-1 px-1 text-[12px] leading-relaxed text-gray-500">
          <li>결과는 앱 알림과 알림톡으로 알려드려요. 국세청 정보와 일치하면 바로 승인돼요.</li>
          <li>현금 정산에는 승인 뒤 사업자등록증 사진 인증이 한 번 더 필요해요 (대시보드 › 사업자 정보).</li>
        </ul>
      </div>
      <Cta label={`가입 신청 (필수 ${done(f)}/5)`} />
    </Screen>
  )
}

// ── 안 B — 한 장 · 밑줄형 ────────────────────────────────────────────────────
function VariantB(ctx: VariantCtx) {
  const f = pick(ctx)
  return (
    <Screen>
      <Nav />
      <Title sub="사업자등록증에 적힌 그대로 적어 주세요. 서류·매장·계좌는 들어가서 채웁니다.">
        판매 시작까지<br />다섯 칸이면 돼요
      </Title>
      <div className="px-5 pb-1 pt-4"><AutoBadge /></div>
      <div className="px-4 pt-3">
        <section className={`${CARD} px-5 py-2`}>
          <Rows f={f} idp="b" keys={['business_number', 'representative_name', 'business_start_date', 'business_name', 'phone']} />
        </section>
      </div>
      <Terms agreed={ctx.data === 'full'} />
      <Cta label={done(f) === 5 ? '가입 신청' : '가입 신청'} ghost={done(f) < 5} />
      <Escape />
    </Screen>
  )
}

// ── 안 C — 한 장 · 박스형 ────────────────────────────────────────────────────
function VariantC(ctx: VariantCtx) {
  const f = pick(ctx)
  return (
    <Screen>
      <Nav title="사업자 정보 입력" />
      <Title sub="입력하신 정보로 국세청 확인을 거쳐 판매 승인이 진행됩니다.">사업자 정보를<br />입력해 주세요</Title>
      <div className="px-5 pb-1 pt-4"><AutoBadge /></div>
      <div className="px-4 pt-3">
        <section className={`${CARD} px-5 py-5`}>
          <p className="mb-3.5 text-[13px] font-bold text-gray-400">사업자등록증 정보</p>
          <Rows f={f} idp="c" box keys={['business_number', 'representative_name', 'business_start_date']} />
          <p className="mb-3.5 mt-6 text-[13px] font-bold text-gray-400">가게 정보</p>
          <Rows f={f} idp="c" box keys={['business_name', 'phone']} />
        </section>
      </div>
      <Terms agreed={ctx.data === 'full'} />
      <Cta label="가입 신청" ghost={done(f) < 5} />
      <Escape />
    </Screen>
  )
}

// ── 안 D — 두 묶음 ───────────────────────────────────────────────────────────
function VariantD(ctx: VariantCtx) {
  const f = pick(ctx)
  return (
    <Screen>
      <Nav right={<span className="dash-num pr-3 text-[13px] font-bold text-gray-400">1 / 2</span>} />
      <Progress step={1} total={2} />
      <Title sub="세 칸이 국세청 정보와 맞으면 심사 없이 바로 승인돼요.">사업자등록증에<br />적힌 대로예요</Title>
      <div className="px-4 pt-5">
        <section className={`${CARD} px-5 py-2`}>
          <Rows f={f} idp="d1" keys={['business_number', 'representative_name', 'business_start_date']} />
        </section>
      </div>
      <Cta label="다음" ghost={!f.business_number} />
      <Gap />
      <Nav right={<span className="dash-num pr-3 text-[13px] font-bold text-gray-400">2 / 2</span>} />
      <Progress step={2} total={2} />
      <Title sub="가게명은 유어샵과 이용권에 그대로 보여요.">손님에게 보일<br />이름과 연락처예요</Title>
      <div className="px-4 pt-5">
        <section className={`${CARD} px-5 py-2`}>
          <Rows f={f} idp="d2" keys={['business_name', 'phone']} />
        </section>
      </div>
      <Terms agreed={ctx.data === 'full'} />
      <Cta label="가입 신청" ghost={done(f) < 5} caption={false} />
    </Screen>
  )
}

// ── 안 E — 한 질문 한 화면 ───────────────────────────────────────────────────
function VariantE(ctx: VariantCtx) {
  const f = pick(ctx)
  const QS: { k: Key; q: string; sub?: string }[] = [
    { k: 'business_number', q: '사업자번호가\n어떻게 되세요?', sub: '사업자등록증 맨 위에 있는 열 자리예요.' },
    { k: 'representative_name', q: '대표자명을\n적어 주세요', sub: '등록증에 적힌 명의자와 같아야 해요.' },
    { k: 'business_start_date', q: '개업일은\n언제인가요?', sub: '등록증의 개업연월일이에요.' },
    { k: 'business_name', q: '가게 이름은\n무엇인가요?', sub: '유어샵과 이용권에 그대로 보여요.' },
    { k: 'phone', q: '연락받을 번호를\n알려 주세요', sub: '주문과 정산 알림톡을 이 번호로 보내요.' },
  ]
  return (
    <Screen>
      {QS.map((s, i) => (
        <div key={s.k}>
          {i > 0 && <Gap />}
          <Nav right={<span className="dash-num pr-3 text-[13px] font-bold text-gray-400">{i + 1} / 5</span>} />
          <Progress step={i + 1} total={5} />
          <Title sub={s.sub}>{s.q.split('\n').map((l, j) => <span key={j}>{l}{j === 0 && <br />}</span>)}</Title>
          {i === 0 && <div className="px-5 pb-1 pt-4"><AutoBadge /></div>}
          <div className="px-4 pt-4">
            <section className={`${CARD} px-5 py-2`}><Rows f={f} idp={`e${i}`} keys={[s.k]} /></section>
          </div>
          {i === 4 && <Terms agreed={ctx.data === 'full'} />}
          <Cta label={i === 4 ? '가입 신청' : '다음'} ghost={!f[s.k]} caption={i === 0} />
        </div>
      ))}
    </Screen>
  )
}

// ── 안 F — 사진 한 장 (등록증 OCR) ───────────────────────────────────────────
function VariantF(ctx: VariantCtx) {
  const f = pick(ctx)
  const read = ctx.data === 'full'
  return (
    <Screen>
      <Nav />
      {read ? (
        <>
          <Title sub="사진에서 읽은 값이에요. 틀린 칸만 고치고 연락처만 적어 주세요.">읽은 내용을<br />확인해 주세요</Title>
          <div className="flex items-center gap-3 px-5 pt-5">
            <span className="h-[52px] w-[52px] shrink-0 rounded-xl bg-gray-200" />
            <span className="flex-1 text-[13.5px] font-semibold text-gray-700">사업자등록증.jpg</span>
            <span className="text-[13px] font-bold text-brand-text">다시 찍기</span>
          </div>
          <div className="px-4 pt-4">
            <section className={`${CARD} px-5 py-2`}>
              {(['business_number', 'representative_name', 'business_start_date', 'business_name'] as Key[]).map(k => (
                <LineRow key={k} idp="f" name={k} value={f[k]} auto {...F[k]} />
              ))}
              <LineRow idp="f" name="phone" value={f.phone} {...F.phone} />
            </section>
          </div>
          <Terms agreed />
          <Cta label="가입 신청" />
        </>
      ) : (
        <>
          <Title sub="번호·대표자·개업일·가게명을 사진에서 읽어 채워 드려요. 사장님은 확인만 하면 됩니다.">
            사업자등록증만<br />찍으면 끝나요
          </Title>
          <div className="px-4 pt-6">
            <button className="flex h-[168px] w-full flex-col items-center justify-center gap-2.5 rounded-[18px] bg-brand text-white">
              <Camera className="h-8 w-8" strokeWidth={1.6} />
              <span className="text-[16px] font-bold">사업자등록증 찍기</span>
              <span className="text-[12.5px] opacity-80">앨범에서 골라도 돼요</span>
            </button>
            <p className="mt-5 text-center text-[13.5px] font-semibold text-gray-500">사진 없이 <span className="text-brand-text">직접 입력할게요</span></p>
          </div>
          <p className="px-8 pb-8 pt-10 text-center text-[12.5px] leading-relaxed text-gray-400">
            읽은 값은 제출 전에 직접 고칠 수 있어요.<br />사진은 심사가 끝나면 사장님만 볼 수 있습니다.
          </p>
        </>
      )}
    </Screen>
  )
}

const SET: VariantSet = {
  id: 'seller-signup',
  label: '사업자 유저 가입',
  route: '/seller/register/supplier',
  problem: '한 화면에 블록 10개와 진행 숫자 5종(1/3 · 0/3 · 0/2 · 3 남음 · 필수 0/5). 지금 할 일 다섯 칸이 그 사이에 묻힌다. 매장 종류·주소는 가입 뒤 매장 등록 위저드가 또 받는다.',
  variants: [
    { id: 'a', label: '안 A · 지금', note: '기준선. 계정 카드 · 제목 · 탈출구 · 카드 3장 · 약관 상자 · 안내 2줄 · 고정 바. 각각 이유가 있었지만 합치니 열 덩어리.', render: VariantA },
    { id: 'b', label: '안 B · 한 장 (밑줄형)', note: '카드 하나에 다섯 칸. 09-16 확정 시각 C 를 그대로 쓰되 제목을 26px 로 세우고 자동 승인을 뱃지로 올렸다. 숫자 카운터 0, 카드 테두리 0. 지금 코드에서 빼기만 하면 된다.', render: VariantB },
    { id: 'c', label: '안 C · 한 장 (박스형)', note: '안 B 와 구조는 같고 입력 옷만 다르다. 라벨 + 회색 박스 = 업무용 폼 생김새(네이버 스마트스토어·카카오 비즈니스 계열). 채우면 흰 바탕 + 테두리로 바뀐다. 09-16 시각 C 를 되돌리는 선택이다.', render: VariantC },
    { id: 'd', label: '안 D · 두 묶음', note: '등록증 3칸 → 가게 2칸. 진행바 + 1/2. 화면당 칸이 셋 이하라 키보드가 올라와도 다 보인다. 탭 한 번과 단계 상태 코드가 는다.', render: VariantD },
    { id: 'e', label: '안 E · 한 질문 한 화면', note: '다섯 칸을 다섯 화면으로. 화면마다 질문 하나뿐이라 부담이 가장 적다(당근·토스 방식). 탭이 다섯 번인 것이 대가 — 다섯 화면을 이어 붙여 그렸으니 길이를 직접 보고 판단할 것.', render: VariantE },
    { id: 'f', label: '안 F · 사진 한 장', note: '등록증 사진을 OCR 로 읽어 네 칸을 채우고 사장님은 확인 + 연락처만. 읽은 칸에는 자동 표시가 붙는다. 가입 전 호출 가능한 공개 엔드포인트와 정확도 실측이 선행(비어 있음 = 찍기 전, 채움 = 읽은 뒤).', render: VariantF },
  ],
}
export default SET
