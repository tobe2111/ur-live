/**
 * 🏨 숙소 데모 시드 호출 — 생성 + **기존 정비**
 *
 * 이 호출은 이름과 달리 "채우기"만 하지 않는다. 서버가 같은 요청 안에서 기존 데모의
 * 좌표·가격·이용권명·사진·**소개 문구**·시설을 함께 고친다. 대표가 2026-08-31 에
 * *"재시드 버튼이 어딨어?"* 라고 물은 이유가 이것이다 — 정비 기능이 생성 버튼에 숨어 있다.
 *
 * ⚠️ **고친 건수는 반드시 화면까지 올려야 한다.** 서버가 `descHealed` 를 보내는데 화면이 안 읽어,
 * 눌러도 무엇이 몇 개 됐는지 알 수 없던 적이 있다(같은 날 수리). 백필은
 * "서버가 고친다 + 숫자가 사람 눈에 닿는다" 가 한 쌍이라야 판정이 된다.
 */
export interface StaySeedTotals {
  created: number; skipped: number; photos: number
  healed: number; photoHealed: number; descHealed: number; amenityHealed: number
  varied: number; reviewed: number
}

type Poster = (url: string, body: unknown, cfg: unknown) => Promise<{ data?: { data?: Record<string, unknown> } }>

/** 실숙소 매칭+실사진(카카오/네이버 외부호출) — 요청당 한도 보호로 6개씩 청크(동네딜 8개와 같은 이유). */
const CHUNK = 6

export async function seedStayDemos(
  post: Poster, count: number, region: string | undefined, cfg: unknown,
): Promise<StaySeedTotals> {
  const t: StaySeedTotals = {
    created: 0, skipped: 0, photos: 0, healed: 0, photoHealed: 0, descHealed: 0, amenityHealed: 0, varied: 0, reviewed: 0,
  }
  const n = (v: unknown) => Number(v ?? 0) || 0
  for (let done = 0; done < count; done += CHUNK) {
    const r = await post('/api/admin/stays/seed-demo', { region: region || undefined, count: Math.min(CHUNK, count - done) }, cfg)
    const d = r.data?.data || {}
    t.created += n(d.created); t.skipped += n(d.skipped); t.photos += n(d.realPhotos)
    t.healed += n(d.healed); t.photoHealed += n(d.photoHealed)
    t.descHealed += n(d.descHealed); t.amenityHealed += n(d.amenityHealed)
    t.varied += n(d.varied); t.reviewed += n(d.reviewed)
  }
  return t
}

/** 정비 결과 요약 — 0 인 항목은 아예 안 쓴다(없는 성과를 지어내지 않는다). */
export function staySeedHealNote(t: StaySeedTotals): string {
  return [
    t.healed && ` · 기존 ${t.healed}개 보정(좌표·가격·이용권명)`,
    t.photoHealed && ` · 사진·지도링크 보정 ${t.photoHealed}개`,
    t.descHealed && ` · 소개 문구 ${t.descHealed}개 교체`,
    t.amenityHealed && ` · 시설 ${t.amenityHealed}개 보강`,
    t.varied && ` · 오퍼 다양화 ${t.varied}개`,
    t.reviewed && ` · 리뷰 생성 ${t.reviewed}개(응답 후 반영)`,
  ].filter(Boolean).join('')
}

/** 정비만 있었는가(신규 0) — 그때도 "아무 일 없었다"로 보이면 안 된다. */
export function staySeedHealedAny(t: StaySeedTotals): boolean {
  return t.healed > 0 || t.photoHealed > 0 || t.descHealed > 0 || t.amenityHealed > 0 || t.varied > 0 || t.reviewed > 0
}
