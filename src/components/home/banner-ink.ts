/**
 * 🖋️ 배너 글자색을 **그림이 정한다** (2026-10-12 대표 — NOL 파스텔 배너 *"이런색도 괜찮네"*).
 *
 * 밝은 파스텔 그림 위엔 짙은 글자, 짙은 그림 위엔 흰 글자. 어드민이 고르게 하면 매번 틀린다 —
 * 그래서 화면이 **글자가 얹히는 자리(왼쪽 아래)** 의 밝기를 직접 재서 정한다.
 *
 * 재는 법: 그림을 32×16 캔버스로 줄여 그리고, 제목이 놓이는 왼쪽 58% · 아래 60% 의 평균 상대 휘도를 본다.
 * cfImage 는 같은 출처(`/cdn-cgi/image/…`)라 캔버스가 오염되지 않는다. 못 재면(외부 출처 등) 흰 글자 = 종전 동작.
 */
export type BannerInk = 'light' | 'dark'

/** WCAG 상대 휘도(0~1). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/**
 * 배경 휘도 → 글자색. 흰 글자(1.0)와 짙은 글자(#16181C ≈ 0.009) 중 **대비가 더 큰 쪽**을 고른다.
 * 경계는 약 0.18 — 그보다 밝으면 짙은 글자가 더 잘 읽힌다.
 */
export function inkForLuminance(L: number): BannerInk {
  const withWhite = 1.05 / (L + 0.05)
  const withInk = (L + 0.05) / (0.009 + 0.05)
  return withInk > withWhite ? 'dark' : 'light'
}

/** 로드된 <img> 의 제목 자리 평균 휘도. 캔버스가 막히면 null. */
export function measureTitleLuminance(img: HTMLImageElement): number | null {
  try {
    const W = 32, H = 16
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !img.naturalWidth) return null
    ctx.drawImage(img, 0, 0, W, H)
    const x1 = Math.round(W * 0.58), y0 = Math.round(H * 0.4)
    const d = ctx.getImageData(0, y0, x1, H - y0).data
    let sum = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { sum += relativeLuminance(d[i], d[i + 1], d[i + 2]); n++ }
    return n ? sum / n : null
  } catch {
    return null // 외부 출처 그림이면 getImageData 가 막힌다 — 종전(흰 글자)으로.
  }
}
