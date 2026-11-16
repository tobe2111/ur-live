// 소비자 딜 글의 [확인된 사실]을 실제 상품 API 에서 만든다.
// 2026-11-16: 전주 덕진구 '홍대돈까스'를 "홍대에서" · #홍대맛집 으로 올린 사고 뒤 신설.
// 가게 이름에 지명이 들어 있어도 위치는 그 이름이 아니라 restaurant_address 에서만 나온다.
// 지명 검수(placeProblems)는 vet.mjs 가 글과 이미지 문구 모두에 적용한다.

const UA = { 'user-agent': 'Mozilla/5.0 (urdeal-marketing-bot)' };

// "전북특별자치도 전주시 덕진구 가리내10길 10" → "전주시 덕진구" · "서울 서초구 방배중앙로 165" → "서울 서초구"
export function regionOf(address) {
  const parts = String(address || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const isProvince = (w) => /(?:도|특별자치도)$/.test(w) && !/(?:시|구|군)$/.test(w);
  const rest = isProvince(parts[0]) ? parts.slice(1) : parts;
  const out = [];
  for (const w of rest) {
    if (/(?:시|군|구|특별시|광역시)$/.test(w) || out.length === 0) out.push(w);
    else break;
    if (out.length >= 2) break;
  }
  return out.join(' ');
}

const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;

// API 상품 한 줄 → 사실 묶음. 값이 없는 항목은 아예 쓰지 않는다(지어내지 않게).
export function factsFromDeal(d) {
  if (!d) return null;
  const price = Number(d.price);
  const orig = Number(d.original_price);
  const hasDiscount = Number.isFinite(price) && Number.isFinite(orig) && orig > price && price > 0;
  const region = regionOf(d.restaurant_address);
  const lines = [
    `상품: ${d.name}`,
    d.restaurant_name ? `가게 이름: ${d.restaurant_name} (가게 이름의 지명은 위치가 아니다. 위치는 아래 주소만 쓴다)` : '',
    d.restaurant_address ? `매장 위치: ${d.restaurant_address} (지역: ${region})` : '매장 위치: 확인 안 됨 — 지역·동네 이름과 지역 해시태그를 쓰지 않는다',
    Number.isFinite(price) && price > 0 ? `유어딜 가격: ${won(price)}` : '',
    hasDiscount ? `매장 정가: ${won(orig)} (차이 ${won(orig - price)}, ${Math.round((1 - price / orig) * 100)}% 낮음)` : '',
  ].filter(Boolean);
  return {
    id: d.id, name: d.name, store: d.restaurant_name || '', address: d.restaurant_address || '', region,
    price: Number.isFinite(price) ? price : null, original_price: hasDiscount ? orig : null,
    text: lines.join('\n'),
  };
}

export async function dealFacts(product, fetchImpl = fetch, base = process.env.URDEAL_API_BASE || 'https://urdeal.kr') {
  if (!product?.id) return null;
  try {
    const j = await (await fetchImpl(`${base}/api/group-buy/products/${product.id}`, { headers: UA })).json();
    if (j?.data) return factsFromDeal(j.data);
  } catch { /* 목록으로 한 번 더 */ }
  try {
    const j = await (await fetchImpl(`${base}/api/group-buy/products?limit=50`, { headers: UA })).json();
    return factsFromDeal((j?.data || []).find((p) => String(p.id) === String(product.id)));
  } catch { return null; }
}
