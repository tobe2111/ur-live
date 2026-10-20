/**
 * 🎬 유어쇼츠 보여 주는 규칙 (2026-10-19 대표 *"가장 이상적으로 해줘"*)
 *
 * ① 전체 보기 카드 제목이 유튜브 원제목 그대로라 해시태그·이모지 꼬리표가 세 줄을 먹었다.
 * ② 같은 가게(라이옥) 영상 두 편이 2열 그리드 한 줄에 나란히 섰다 — 서버 순서에서 떨어뜨린다.
 * ③ 뷰어 맨 위에 유튜브가 채널 로고·원제목을 띄웠다 — 재생기를 위로 늘려 잘라 낸다(덮개 없음).
 * ④ 처음 온 사람이 다음 영상이 있는 줄 몰랐다 — 번호 대신 한 번만 넘김 안내.
 *
 * ## 이 테스트가 못 막는 것
 * - 유튜브가 제목 줄을 정확히 몇 px 에 그리는지 · 늘린 만큼 영상이 실제로 안 잘리는지(유튜브가
 *   정한다 — 배포 후 폰에서 눈으로 볼 것. 이 환경에서는 유튜브가 막혀 재생을 못 본다).
 * - 이용권이 안 붙은 같은 가게 영상(아임타이 2편)은 가게를 몰라 떨어뜨리지 못한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { cleanShortTitle, shortDisplayTitle, spreadSameProduct, YT_TITLE_CLIP_PX } from '@/shared/urshorts-display'

describe('① 제목 정리 — 꼬리표만 떼고 말은 그대로', () => {
  it('라이브 원제목 그대로', () => {
    expect(cleanShortTitle("싸와디캅~ 기장 바다🌊 보며 태국 음식🇹🇭 '어밤부' #shorts")).toBe("싸와디캅~ 기장 바다 보며 태국 음식 '어밤부'")
    expect(cleanShortTitle('부산 최초 타이셀렉트 !!! 여기 맛있어용 태국음식집 최애! 📍아임타이 #서면맛집 #전포동맛집 #부산맛집 #부산태국음식'))
      .toBe('부산 최초 타이셀렉트 !!! 여기 맛있어용 태국음식집 최애! 아임타이')
    expect(cleanShortTitle('베트남 쌀국수 실패 없는 곳 #shorts #라이옥 #부산')).toBe('베트남 쌀국수 실패 없는 곳')
  })
  it('남는 글자가 없으면 null — 빈 줄을 그리지 않는다', () => {
    expect(cleanShortTitle('#shorts #맛집 🍜')).toBeNull()
    expect(cleanShortTitle(null)).toBeNull()
  })
  it('원제목이 없으면 상품명', () => {
    expect(shortDisplayTitle({ title: null, product_name: '쌀국수 + 분짜 2인 세트' })).toBe('쌀국수 + 분짜 2인 세트')
    expect(shortDisplayTitle({ title: '#shorts', product_name: null })).toBeNull()
  })
  it('전체 보기 카드와 레일이 이 함수를 쓴다', () => {
    expect(readCode('src/pages/urshorts/BrowseCard.tsx')).toMatch(/const title = shortDisplayTitle\(item\)/)
    expect(readCode('src/pages/urshorts/BrowseCard.tsx'), '원제목을 그대로 그린다').not.toMatch(/\{item\.title\}/)
    expect(readCode('src/components/home/UrShortsRail.tsx')).toMatch(/shortDisplayTitle\(item\)/)
  })
})

describe('② 같은 이용권 영상은 붙지 않는다', () => {
  const ids = (xs: Array<{ id: number }>) => xs.map((x) => x.id)
  it('라이브 순서: 라이옥 두 편이 떨어진다', () => {
    const live = [
      { id: 11, product_id: null }, { id: 10, product_id: null }, { id: 9, product_id: null },
      { id: 8, product_id: 2580 }, { id: 7, product_id: 2580 }, { id: 5, product_id: null }, { id: 4, product_id: null },
    ]
    const out = spreadSameProduct(live)
    expect(ids(out)).toEqual([11, 10, 9, 8, 5, 4, 7])
  })
  it('다른 것은 원래 순서를 지키고, 피할 수 없으면 그대로 둔다', () => {
    expect(ids(spreadSameProduct([{ id: 1, product_id: 1 }, { id: 2, product_id: 2 }, { id: 3, product_id: 3 }]))).toEqual([1, 2, 3])
    expect(ids(spreadSameProduct([{ id: 1, product_id: 1 }, { id: 2, product_id: 1 }]))).toEqual([1, 2])
  })
  it('이용권 없는 영상끼리는 겹친 것으로 보지 않는다', () => {
    expect(ids(spreadSameProduct([{ id: 1, product_id: null }, { id: 2, product_id: null }]))).toEqual([1, 2])
  })
  it('공개 API 가 그 순서로 내보낸다 — 레일·전체 보기·뷰어가 같은 순서를 받는다', () => {
    expect(readCode('src/features/urshorts/api/urshorts.routes.ts')).toMatch(/data: spreadSameProduct\(/)
  })
})

describe('③ 유튜브 제목 줄은 덮지 않고 잘라 낸다', () => {
  const V = readCode('src/pages/VideosPage.tsx')
  it('재생기 껍데기와 폴백 iframe 둘 다 위로 늘린다', () => {
    expect(V).toMatch(/ref=\{hostRef\}\s*\n\s*style=\{\{ top: -YT_TITLE_CLIP_PX \}\}/)
    expect(V).toMatch(/style=\{\{ top: -YT_TITLE_CLIP_PX, height: `calc\(100% \+ \$\{YT_TITLE_CLIP_PX\}px\)` \}\}/)
    expect(YT_TITLE_CLIP_PX).toBeGreaterThanOrEqual(56)
  })
  it('루트가 넘친 부분을 자른다', () => {
    expect(V).toMatch(/relative min-h-\[100dvh\] overflow-hidden/)
  })
  it('번호(1 / 10)는 여전히 없다 — 2026-09-08 대표 결정', () => {
    expect(V).not.toMatch(/\{idx \+ 1\}/)
  })
})

describe('④ 넘김 안내는 한 번만', () => {
  const H = readCode('src/pages/videos/SwipeHint.tsx')
  it('본 적 있으면 다시 안 뜨고, 넘기면 사라지고, 탭을 가로채지 않는다', () => {
    expect(H).toMatch(/localStorage\.getItem\(SEEN_KEY\) !== '1'/)
    expect(H).toMatch(/idx !== startIdx\.current/)
    expect(H).toMatch(/pointer-events-none/)
  })
  it('영상이 둘 이상일 때만 뷰어가 그린다', () => {
    expect(readCode('src/pages/VideosPage.tsx')).toMatch(/items\.length > 1 && <SwipeHint idx=\{idx\} \/>/)
  })
})
