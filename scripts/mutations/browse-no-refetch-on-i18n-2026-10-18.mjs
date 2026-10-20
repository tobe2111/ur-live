// 🔁 쇼핑 — 번역 도착이 목록 요청을 다시 부르지 않는다 (2026-10-18)
const TEST = 'src/tests/unit/browse-no-refetch-on-i18n-2026-10-18.test.ts'

export default [
  {
    name: '[browse-i18n] loadProducts 가 다시 t 에 묶인다',
    file: 'src/pages/BrowsePage.tsx',
    find: '  }, [category, sortBy, priceRange])',
    replace: '  }, [category, sortBy, priceRange, t])',
    test: TEST,
    why: '번역 묶음이 첫 요청 뒤에 오면 리셋 effect 가 다시 돌아 /api/products 1페이지를 또 받는다(dup 간헐 빨간불).',
  },
  {
    name: '[browse-i18n] 정렬을 바꿔도 다시 안 받는다(반대 방향)',
    file: 'src/pages/BrowsePage.tsx',
    find: '  }, [category, sortBy, priceRange])',
    replace: '  }, [category, priceRange])',
    test: TEST,
    why: '`t` 를 빼다가 정렬까지 빼면 정렬 칩이 서버 목록을 안 바꾼다.',
  },
]
