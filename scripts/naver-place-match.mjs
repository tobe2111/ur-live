/**
 * 🧭 2026-10-26 네이버 지도 검색 결과에서 **그 가게**를 고른다 — 순수 함수(시험 대상).
 *
 * 브라우저 수집기(naver-photo-collect.mjs)가 쓴다. 틀린 가게의 사진은 사진이 없는 것보다 나쁘므로
 *   ① 이름이 맞아야 하고(공백·태그·기호 무시, 한쪽이 다른 쪽을 포함) ② 주소의 시·군·구가 맞아야 한다.
 *   둘 중 하나라도 확인이 안 되면 null — 고르지 않는다(첫 결과로 떨어지지 않는다).
 */

export function nameKey(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase()
}

/** 주소에서 시·군·구 단위 낱말들(예: "충북 청주시 서원구 …" → ["청주시","서원구"]). */
export function districtTokens(address) {
  return String(address || '').split(/\s+/).filter((w) => /^[가-힣]{1,6}(시|군|구)$/.test(w))
}

/**
 * 후보 목록에서 그 가게를 고른다.
 * @param {Array<{id:string,name:string,address?:string}>} candidates
 * @param {string} name   우리 DB 의 가게 이름
 * @param {string} [address] 우리 DB 의 주소
 */
export function pickNaverPlace(candidates, name, address) {
  const want = nameKey(name)
  if (want.length < 2) return null
  const dists = districtTokens(address)
  for (const c of candidates || []) {
    if (!c || !/^\d{5,12}$/.test(String(c.id || ''))) continue
    const got = nameKey(c.name)
    if (got.length < 2 || !(got.includes(want) || want.includes(got))) continue
    // 주소를 아는데 시·군·구가 하나도 안 맞으면 동명의 다른 지점이다.
    if (dists.length && c.address && !dists.some((d) => String(c.address).includes(d.replace(/(시|군|구)$/, '')))) continue
    // 주소를 모르면(후보에 주소 없음) 이름만으로는 고르지 않는다 — 체인점은 이름이 같다.
    if (dists.length && !c.address) continue
    return c
  }
  return null
}

/** 네이버 업체 사진 CDN — 서버(naver-place-photo.ts BUSINESS_PHOTO_HOST)와 같은 판정. */
export function businessPhotoUrls(text, limit = 8) {
  const t = String(text || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
  const out = []
  const seen = new Set()
  for (const m of t.matchAll(/https:\/\/ldb-phinf\.pstatic\.net\/[^"'\s\\<>)?]+/gi)) {
    const u = m[0]
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (out.length >= limit) break
  }
  return out
}

/** __APOLLO_STATE__ 에서 가게 후보(id·이름·주소)를 뽑는다. 키 이름이 바뀌어도 모양으로 줍는다. */
export function candidatesFromApollo(state) {
  const out = []
  if (!state || typeof state !== 'object') return out
  for (const v of Object.values(state)) {
    if (!v || typeof v !== 'object') continue
    const id = v.id ?? v.placeId
    const name = v.name ?? v.title
    if (!id || !name || !/^\d{5,12}$/.test(String(id))) continue
    const address = v.roadAddress || v.address || v.fullAddress || v.commonAddress || ''
    out.push({ id: String(id), name: String(name), address: String(address || '') })
  }
  return out
}
