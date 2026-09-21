/**
 * 🎨 시안 세트 — 사업자 유저 가입(`/seller/register/supplier`). **2차(2026-09-21 실측 기반 재작성).**
 *
 * 대표: *"여기 UI 디자인 수정 필요. 너무 복잡함"* → *"더 대기업스럽게"* →
 *      *"구현된 형태는 어떻지? 사업자한테 OCR로 받고 있나? … OCR이랑 그리고 카카오맵 혹은
 *       네이버지도로 간편하게도 할 수 있잖아."*
 *
 * ── 1차 시안의 전제가 실측에서 무너졌다 ─────────────────────────────────────
 * 1차는 *"다섯 칸은 국세청 자동 승인에 필요하니 그대로 두고 블록만 줄인다"* 였다. 라이브를 재 보니:
 *   · 셀러 **4명 전원** `representative_name`·`business_start_date` **비어 있음**
 *   · 4명 전원 `nts_verified_at`·`nts_verify_result` **NULL** ⇒ 국세청 자동 승인은 **한 번도 성사된 적 없다**
 *   · 그 두 칸이 비면 재검증 라우트도 `대표자명 / 개업일 누락 — 재검증 불가` 로 되돌아온다
 *     (`internal-admin-tools.routes.ts:1049`)
 * ⇒ **지키려던 다섯 칸이 실제로는 아무 일도 하고 있지 않았다.**
 *
 * ── 대신 이미 잘 돌아가는 것이 있다: 카카오맵 ───────────────────────────────
 * `KakaoMapPicker` 는 가게 하나를 고르면 **여덟 가지**를 준다(상호·도로명·지번·전화·카테고리·위도·경도·place_id).
 * 매장 등록 위저드(`StoreRegisterModal` → `POST /api/seller/stores`)는 그걸 전부 저장한다.
 * 그런데 가입 화면의 `AddressPickerField:61` 은 **주소 문자열 하나만 꺼내고 일곱을 버린다** —
 * 그래서 사장님이 상호·전화를 손으로 다시 친다. 그리고 그 주소마저 `sellers.description` 안
 * `[주소: …]` 텍스트로만 저장되고 **읽는 코드가 레포 전체에 0건**이다(쓰기 전용 문자열).
 *
 * ── OCR 은 🔁 **같은 날 오후에 뒤집혔다** ──────────────────────────────────
 * 이 세트를 쓸 때(09:45 KST)의 측정은 3건 전패였다 — 라이브 `seller_meta.ocr_business_registration`:
 *   15 `unreadable` fill 0 · 16 `mismatch` fill 0.75(상호↔대표자 뒤바뀜, 번호·개업일 null) · 17 `unreadable` fill 0
 * 그런데 같은 날 오전에 다른 세션이 수리를 셋 넣었고(`a014de2` 09:24 · `eebeb2c` 10:13 ·
 * **`3d575e7` 11:17 #1491 — 가입 전 OCR 통로 신설** · `532945e` 11:47), 같은 서류로 다시 재니
 * **fill 1.0 이 3회 연속**이었다(사업자번호·개업일·대표자 정확, 상호만 한 글자 오독).
 * ⇒ **안 F 는 안 B 의 경쟁자가 아니라 짝이다**: 사진이 [사업자 3칸], 지도가 [가게 3칸].
 *   실사진 실측은 여전히 0회다(위는 합성 문서).
 *
 * 🏢 그래서 2차의 축은 "다섯 칸을 어떻게 배치하나" 가 아니라 **"무엇을 묻지 않을 수 있나"** 다.
 *
 * ⚠️ 여기 값은 가짜다. API 를 부르지 않는다. 단, 고른 가게는 **라이브 매장(seller 14)** 의 실제 값이다.
 */
import type { VariantSet, VariantCtx } from '../registry'
import { Field, ChipGroup, INPUT, STORE_CATEGORIES } from '../../seller-register/RegisterFields'
import {
  CARD, Screen, Nav, Progress, Title, AutoBadge, LineRow, Terms, Cta, Escape, Gap,
  MapSearchTile, PickedStoreCard, NotOnMap, NotYet,
} from './seller-signup-parts'

// ── 가짜 데이터 (가게 값은 라이브 seller 14 실제 값) ─────────────────────────
const STORE = {
  name: '홍대돈까스',
  address: '전북특별자치도 전주시 덕진구 가리내10길 10',
  phone: '063-123-4567',
  category: '음식점 > 일식 > 돈까스,우동',
}
const TYPED_FULL = { business_number: '123-45-67890', phone: '010-1234-5678', representative_name: '정지원', business_start_date: '2021-03-02' }
const TYPED_EMPTY = { business_number: '', phone: '', representative_name: '', business_start_date: '' }
const picked = (c: VariantCtx) => c.data === 'full'
const typed = (c: VariantCtx) => (c.data === 'full' ? TYPED_FULL : TYPED_EMPTY)

const F = {
  business_number: { label: '사업자번호', placeholder: '000-00-00000', num: true, hint: '사업자등록증 맨 위 열 자리' },
  phone: { label: '담당자 연락처', placeholder: '010-0000-0000', num: true, type: 'tel', hint: '주문·정산 알림톡을 받는 휴대폰' },
  representative_name: { label: '대표자명', placeholder: '사업자등록증에 적힌 이름' },
  business_start_date: { label: '개업일', placeholder: 'YYYY-MM-DD', num: true, type: 'date' },
} as const

// ── 안 A — 지금 (기준선) ─────────────────────────────────────────────────────
function VariantA(ctx: VariantCtx) {
  const t = typed(ctx)
  const on = picked(ctx)
  const box = 'rounded-[16px] border border-rule bg-white'
  const n = [t.business_number, t.representative_name, t.business_start_date, on ? STORE.name : '', t.phone].filter(Boolean).length
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
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">사업자 정보</h3><span className="dash-num text-[12px] font-bold text-brand-text">{[t.business_number, t.representative_name, t.business_start_date].filter(Boolean).length} / 3</span></div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">사업자등록증에 적힌 그대로. 국세청 정보와 일치하면 심사 없이 바로 승인돼요.</p>
          <div className="mt-3">
            <LineRow idp="a" name="business_number" value={t.business_number} {...F.business_number} hint={undefined} />
            <LineRow idp="a" name="representative_name" value={t.representative_name} {...F.representative_name} />
            <LineRow idp="a" name="business_start_date" value={t.business_start_date} {...F.business_start_date} />
            <Field id="a-cert" label="사업자등록증 사본" hint="지금 등록증을 보고 계시면 한 장 찍어 올려 주세요.">
              <div className="flex h-12 items-center justify-center rounded-xl border border-dashed border-rule-strong text-[14px] font-semibold text-gray-600">사업자등록증 이미지 첨부</div>
            </Field>
          </div>
        </section>
        <section className={`${box} px-4 pb-3 pt-4`}>
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">가게 정보</h3><span className="dash-num text-[12px] font-bold text-brand-text">{[on ? '1' : '', t.phone].filter(Boolean).length} / 2</span></div>
          <p className="mt-0.5 text-[12.5px] text-gray-500">유어샵과 이용권에 그대로 보여요.</p>
          <div className="mt-3">
            <LineRow idp="a" name="business_name" label="가게명" value={on ? STORE.name : ''} placeholder="손님에게 보이는 이름" />
            <LineRow idp="a" name="phone" value={t.phone} {...F.phone} />
            <Field id="a-cat" label="매장 종류"><ChipGroup name="매장 종류" value={on ? 'restaurant' : ''} onChange={() => {}} options={STORE_CATEGORIES} /></Field>
            <Field id="a-addr" label="매장 주소" hint="가게 이름으로 찾으면 주소가 자동으로 들어가요">
              <input id="a-addr" readOnly value={on ? STORE.address : ''} placeholder="가게 이름으로 찾기" className={INPUT} />
            </Field>
            <Field id="a-desc" label="매장 소개 (선택)"><input id="a-desc" readOnly value="" placeholder="매장 분위기, 대표 메뉴, 운영 시간 등" className={INPUT} /></Field>
          </div>
        </section>
        <section className={`${box} px-4 pb-3 pt-4`}>
          <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-extrabold">승인까지 남은 것</h3><span className="text-[12px] font-bold text-tone-warn">3 남음</span></div>
          <dl className="mt-3">{[['사업자등록증', '위에서 첨부'], ['영업신고증', '음식점 필수'], ['정산 계좌', '정산 전까지']].map(([k, v]) => (
            <div key={k} className="flex justify-between border-t border-rule py-2.5 first:border-t-0"><dt className="text-[13.5px] font-semibold">{k}</dt><dd className="text-[11.5px] font-bold text-gray-500">{v}</dd></div>
          ))}</dl>
        </section>
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3"><Terms agreed={on} /></div>
        <ul className="space-y-1 px-1 text-[12px] leading-relaxed text-gray-500">
          <li>결과는 앱 알림과 알림톡으로 알려드려요. 국세청 정보와 일치하면 바로 승인돼요.</li>
          <li>현금 정산에는 승인 뒤 사업자등록증 사진 인증이 한 번 더 필요해요.</li>
        </ul>
      </div>
      <Cta label={`가입 신청 (필수 ${n}/5)`} />
      <NotYet>
        주소 칸이 카카오맵을 쓰긴 하는데 <b>주소 글자만</b> 가져온다. 같은 선택이 주는 상호·전화·업종·좌표는 버려져서
        바로 위 칸들을 손으로 다시 친다. 그리고 그 주소는 <b>읽는 코드가 없는</b> 텍스트로만 저장된다.
      </NotYet>
    </Screen>
  )
}

// ── 안 B — 가게부터 고른다 · ✅ **대표 확정**(2026-09-21 *"응 안 B로 하는데"*) ──────
//    구현은 시안과 한 곳 다르다: **사업자 정보 3칸을 지우지 않았다.** 시안을 그릴 때는
//    대표자명·개업일이 아무 일도 안 하고 있었는데(자동 승인 0회), 같은 날 #1491 이
//    **등록증 사진으로 그 칸들을 채우기** 시작했다. 지우면 그 길을 끊는다.
//    ⇒ 손으로 치는 칸은 결국 시안과 같다 — 담당자 연락처 하나.
function VariantB(ctx: VariantCtx) {
  const t = typed(ctx)
  return (
    <Screen>
      <Nav />
      <Title sub="카카오맵에서 가게를 고르면 상호·주소·전화·업종이 채워져요.">
        어느 가게를<br />파실 건가요?
      </Title>
      <div className="px-4 pt-5">
        {picked(ctx) ? <PickedStoreCard {...STORE} /> : <MapSearchTile />}
      </div>
      {picked(ctx) ? (
        <>
          <div className="px-4 pt-4">
            <section className={`${CARD} px-5 py-2`}>
              <LineRow idp="b" name="business_number" value={t.business_number} {...F.business_number} />
              <LineRow idp="b" name="phone" value={t.phone} {...F.phone} />
            </section>
          </div>
          <Terms agreed />
          <Cta label="가입 신청" />
        </>
      ) : (
        <>
          <NotOnMap />
          <Cta label="가입 신청" ghost />
        </>
      )}
      <Escape />
    </Screen>
  )
}

// ── 안 C — 한 장 (지도 + 나머지) ─────────────────────────────────────────────
function VariantC(ctx: VariantCtx) {
  const t = typed(ctx)
  const on = picked(ctx)
  return (
    <Screen>
      <Nav title="사업자 유저 가입" />
      <Title sub="가게를 고르고 두 칸만 적으면 끝나요.">판매 시작까지<br />두 칸이면 돼요</Title>
      <div className="px-5 pb-1 pt-4"><AutoBadge /></div>
      <div className="px-4 pt-3">
        {on ? <PickedStoreCard {...STORE} /> : <MapSearchTile sub="고르면 상호·주소·전화·업종이 채워져요" />}
        <section className={`${CARD} mt-3 px-5 py-2`}>
          <LineRow idp="c" name="business_number" value={t.business_number} {...F.business_number} />
          <LineRow idp="c" name="phone" value={t.phone} {...F.phone} />
        </section>
      </div>
      <Terms agreed={on} />
      <Cta label="가입 신청" ghost={!on} />
      <NotOnMap />
    </Screen>
  )
}

// ── 안 D — 두 걸음 (가게 → 사업자) ───────────────────────────────────────────
function VariantD(ctx: VariantCtx) {
  const t = typed(ctx)
  const on = picked(ctx)
  return (
    <Screen>
      <Nav right={<span className="dash-num pr-3 text-[13px] font-bold text-gray-400">1 / 2</span>} />
      <Progress step={1} total={2} />
      <Title sub="카카오맵에서 고르면 상호·주소·전화·업종이 채워져요.">어느 가게를<br />파실 건가요?</Title>
      <div className="px-4 pt-5">{on ? <PickedStoreCard {...STORE} /> : <MapSearchTile />}</div>
      <NotOnMap />
      <Cta label="다음" ghost={!on} />
      <Gap />
      <Nav right={<span className="dash-num pr-3 text-[13px] font-bold text-gray-400">2 / 2</span>} />
      <Progress step={2} total={2} />
      <Title sub="정산과 알림톡에 쓰는 정보예요.">사업자 정보를<br />알려 주세요</Title>
      <div className="px-4 pt-5">
        <section className={`${CARD} px-5 py-2`}>
          <LineRow idp="d" name="business_number" value={t.business_number} {...F.business_number} />
          <LineRow idp="d" name="phone" value={t.phone} {...F.phone} />
        </section>
      </div>
      <Terms agreed={on} />
      <Cta label="가입 신청" ghost={!on} caption={false} />
    </Screen>
  )
}

// ── 안 E — 국세청 자동 승인을 살린다면 ───────────────────────────────────────
function VariantE(ctx: VariantCtx) {
  const t = typed(ctx)
  const on = picked(ctx)
  return (
    <Screen>
      <Nav />
      <Title sub="세 칸이 국세청 정보와 맞으면 심사를 기다리지 않아요.">
        어느 가게를<br />파실 건가요?
      </Title>
      <div className="px-4 pt-5">{on ? <PickedStoreCard {...STORE} /> : <MapSearchTile />}</div>
      <div className="px-4 pt-4">
        <section className={`${CARD} px-5 py-2`}>
          <LineRow idp="e" name="business_number" value={t.business_number} {...F.business_number} />
          <LineRow idp="e" name="representative_name" value={t.representative_name} {...F.representative_name} />
          <LineRow idp="e" name="business_start_date" value={t.business_start_date} {...F.business_start_date} />
          <LineRow idp="e" name="phone" value={t.phone} {...F.phone} />
        </section>
      </div>
      <div className="px-5 pt-4"><AutoBadge /></div>
      <Terms agreed={on} />
      <Cta label="가입 신청" ghost={!on} />
      <NotYet>
        국세청 확인은 <b>지금 한 번도 성사된 적이 없다</b>. 라이브 셀러 넷 다 대표자명·개업일이 비어 있고
        <b> 확인 기록도 전부 비어 있다</b>. 이 안을 고르면 그 경로를 실제로 살리는 일이 함께 온다.
      </NotYet>
    </Screen>
  )
}

// ── 안 F — 등록증 사진으로 (OCR) ─────────────────────────────────────────────
function VariantF(ctx: VariantCtx) {
  const t = typed(ctx)
  const read = picked(ctx)
  return (
    <Screen>
      <Nav />
      {read ? (
        <>
          <Title sub="사진에서 읽은 값이에요. 틀린 칸만 고쳐 주세요.">읽은 내용을<br />확인해 주세요</Title>
          <div className="flex items-center gap-3 px-5 pt-5">
            <span className="h-[52px] w-[52px] shrink-0 rounded-xl bg-gray-200" />
            <span className="flex-1 text-[13.5px] font-semibold text-gray-700">사업자등록증.jpg</span>
            <span className="text-[13px] font-bold text-brand-text">다시 찍기</span>
          </div>
          <div className="px-4 pt-4">
            <section className={`${CARD} px-5 py-2`}>
              <LineRow idp="f" name="business_number" value={t.business_number} auto {...F.business_number} />
              <LineRow idp="f" name="representative_name" value={t.representative_name} auto {...F.representative_name} />
              <LineRow idp="f" name="business_start_date" value={t.business_start_date} auto {...F.business_start_date} />
              <LineRow idp="f" name="phone" value={t.phone} {...F.phone} />
            </section>
          </div>
          <Terms agreed />
          <Cta label="가입 신청" />
        </>
      ) : (
        <>
          <Title sub="번호·대표자·개업일을 사진에서 읽어 채워 드려요.">사업자등록증만<br />찍으면 끝나요</Title>
          <div className="px-4 pt-6">
            <button className="flex h-[168px] w-full flex-col items-center justify-center gap-2.5 rounded-[18px] bg-brand text-white">
              <span className="text-[16px] font-bold">사업자등록증 찍기</span>
              <span className="text-[12.5px] opacity-80">앨범에서 골라도 돼요</span>
            </button>
            <p className="mt-5 text-center text-[13.5px] font-semibold text-gray-500">사진 없이 <span className="text-brand-text">직접 입력할게요</span></p>
          </div>
        </>
      )}
      <NotYet>
        이 그림은 <b>아직 못 만든다</b>. 라이브 OCR 3건이 전부 실패했고(못 읽음 2 · 상호와 대표자가 뒤바뀜 1),
        그 입력은 <b>완벽하게 깨끗한 합성 등록증</b>이었다. 사업자번호와 개업일은 세 번 다 못 읽었다.
        게다가 가입 전에 부를 수 있는 통로가 없다.
      </NotYet>
    </Screen>
  )
}

const SET: VariantSet = {
  id: 'seller-signup',
  label: '사업자 유저 가입',
  route: '/seller/register/supplier',
  problem: '지도가 이미 아는 것(상호·전화·업종·좌표)을 버리고 손으로 다시 치게 한다. 그리고 그 다섯 칸을 지키던 근거(국세청 자동 승인)는 라이브에서 한 번도 돈 적이 없다.',
  variants: [
    { id: 'a', label: '안 A · 지금', note: '기준선. 블록 10개·진행 숫자 5종. 주소 칸이 카카오맵을 쓰지만 주소 글자만 가져오고, 같은 선택이 주는 상호·전화·업종은 버린다.', render: VariantA },
    { id: 'b', label: '안 B · 가게부터', note: '가게를 먼저 고른다. 지도가 상호·주소·전화·업종 넷을 채우고 사장님은 사업자번호와 연락처 두 칸만 친다. 추천.', render: VariantB },
    { id: 'c', label: '안 C · 한 장', note: '안 B 와 같은 내용을 한 화면에. 지도를 안 켜도 아래 두 칸이 보여서 무엇을 요구하는지가 먼저 읽힌다.', render: VariantC },
    { id: 'd', label: '안 D · 두 걸음', note: '가게 고르기와 사업자 정보를 나눈다. 화면마다 할 일이 하나뿐이라 가장 가볍지만 탭이 한 번 는다.', render: VariantD },
    { id: 'e', label: '안 E · 자동 승인까지', note: '대표자명·개업일을 더 받아 국세청 즉시 승인을 노린다. 다만 그 경로는 라이브에서 한 번도 돈 적이 없어서, 고르면 그걸 살리는 일이 함께 온다.', render: VariantE },
    { id: 'f', label: '안 F · 사진으로', note: '등록증 사진에서 읽어 채운다. 지금은 못 만든다 — 라이브 OCR 3건이 깨끗한 합성 문서에서도 전부 실패했고 가입 전 통로도 없다. 근거를 보시라고 그려 뒀다.', render: VariantF },
  ],
}
export default SET
