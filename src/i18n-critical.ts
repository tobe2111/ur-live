/**
 * 🛡️ 2026-05-25 (loading P0): critical i18n inline — main bundle 에 포함.
 *
 * 목적:
 *   - bootstrap 의 ko translation.json (~212KB) 도착 전 첫 paint 부터 한국어 표시
 *   - locale chunk fetch + parse + addResourceBundle (~200-500ms) 차단 0
 *   - defaultValue fallback 으로도 동작하지만, 키 누락 시 빈 string 깜빡임 회피
 *
 * 포함 키 (~50개, ~5KB gzip):
 *   - common.* (전 페이지 공통 — login / loading / error / back ...)
 *   - nav.* (BottomNav — home / shop / vouchers / linkshop / my)
 *   - mainHome.* (메인 페이지 — ariaSearch / ariaCart ...)
 *
 * 운영:
 *   - 새 critical 키 추가 시 본 파일 직접 수정 (vite 가 자동 main bundle 에 포함)
 *   - full translation.json 의 같은 키는 background load 시 자동 덮어쓰기 (i18next addResourceBundle deep=true)
 *   - 6언어 모두 유지 — 첫 진입 언어 무관 즉시 사용 가능
 */

export const CRITICAL_I18N: Record<string, Record<string, any>> = {
  ko: {
    common: {
      login: '로그인',
      logout: '로그아웃',
      signup: '회원가입',
      cancel: '취소',
      confirm: '확인',
      save: '저장',
      delete: '삭제',
      edit: '수정',
      search: '검색',
      loading: '로딩 중...',
      error: '오류',
      success: '성공',
      back: '뒤로',
      next: '다음',
      submit: '제출',
      close: '닫기',
      all: '전체',
    },
    nav: {
      home: '홈',
      shop: '쇼핑',
      vouchers: '교환권',
      live: '라이브',
      linkshop: '링크샵',
      my: '마이',
      cart: '장바구니',
      myPage: '마이페이지',
    },
    mainHome: {
      ariaSearch: '검색',
      ariaCart: '장바구니',
    },
    // 🗺️ 2026-07-07 (대표 신고 — 홈 로딩 중 'restaurantMap.nearMe' 등 원본 키 노출): 홈(`/`)=동네딜 지도
    //   list 뷰라 그 상단 라벨(내 주변/정렬)이 critical 셋에 없어 full translation.json 도착 전 raw 노출됨.
    restaurantMap: {
      nearMe: '내 주변',
      sort: { distance: '거리순', discount: '할인율순', price: '가격 낮은순', rating: '평점순' },
    },
    seo: {
      home: {
        title: '돈버는 쇼핑, 오프라인 공동구매 & 라이브커머스',
        description: '동네 가게 공동구매로 결제하고 딜 적립까지. 인플루언서 추천 이용권 + 라이브 쇼핑.',
      },
    },
  },
  en: {
    common: {
      login: 'Login', logout: 'Logout', signup: 'Sign Up',
      cancel: 'Cancel', confirm: 'Confirm', save: 'Save', delete: 'Delete', edit: 'Edit',
      search: 'Search', loading: 'Loading...', error: 'Error', success: 'Success',
      back: 'Back', next: 'Next', submit: 'Submit', close: 'Close', all: 'All',
    },
    nav: {
      home: 'Home', shop: 'Shop', vouchers: 'Vouchers', live: 'Live',
      linkshop: 'Linkshop', my: 'My', cart: 'Cart', myPage: 'My Page',
    },
    mainHome: { ariaSearch: 'Search', ariaCart: 'Cart' },
    restaurantMap: { nearMe: 'Near me', sort: { distance: 'By distance', discount: 'By discount', price: 'Lowest price', rating: 'By rating' } },
    seo: { home: { title: 'Money-saving shopping — group buying & live commerce', description: '' } },
  },
  ja: {
    common: {
      login: 'ログイン', logout: 'ログアウト', signup: '新規登録',
      cancel: 'キャンセル', confirm: '確認', save: '保存', delete: '削除', edit: '編集',
      search: '検索', loading: '読み込み中...', error: 'エラー', success: '成功',
      back: '戻る', next: '次へ', submit: '送信', close: '閉じる', all: '全て',
    },
    nav: {
      home: 'ホーム', shop: 'ショップ', vouchers: 'クーポン', live: 'ライブ',
      linkshop: 'リンクショップ', my: 'マイ', cart: 'カート', myPage: 'マイページ',
    },
    mainHome: { ariaSearch: '検索', ariaCart: 'カート' },
    restaurantMap: { nearMe: '現在地周辺', sort: { distance: '距離順', discount: '割引率順', price: '価格が安い順', rating: '評価順' } },
    seo: { home: { title: 'お得なショッピング — 共同購入 & ライブコマース', description: '' } },
  },
  zh: {
    common: {
      login: '登录', logout: '退出', signup: '注册',
      cancel: '取消', confirm: '确认', save: '保存', delete: '删除', edit: '编辑',
      search: '搜索', loading: '加载中...', error: '错误', success: '成功',
      back: '返回', next: '下一步', submit: '提交', close: '关闭', all: '全部',
    },
    nav: {
      home: '首页', shop: '购物', vouchers: '券', live: '直播',
      linkshop: '链接店', my: '我的', cart: '购物车', myPage: '我的',
    },
    mainHome: { ariaSearch: '搜索', ariaCart: '购物车' },
    restaurantMap: { nearMe: '附近', sort: { distance: '按距离', discount: '按折扣', price: '价格从低到高', rating: '按评分' } },
    seo: { home: { title: '省钱购物 — 团购与直播电商', description: '' } },
  },
  es: {
    common: {
      login: 'Entrar', logout: 'Salir', signup: 'Registrarse',
      cancel: 'Cancelar', confirm: 'Confirmar', save: 'Guardar', delete: 'Eliminar', edit: 'Editar',
      search: 'Buscar', loading: 'Cargando...', error: 'Error', success: 'Éxito',
      back: 'Atrás', next: 'Siguiente', submit: 'Enviar', close: 'Cerrar', all: 'Todos',
    },
    nav: {
      home: 'Inicio', shop: 'Tienda', vouchers: 'Cupones', live: 'En vivo',
      linkshop: 'Linkshop', my: 'Mi', cart: 'Carrito', myPage: 'Mi página',
    },
    mainHome: { ariaSearch: 'Buscar', ariaCart: 'Carrito' },
    restaurantMap: { nearMe: 'Cerca de mí', sort: { distance: 'Por distancia', discount: 'Por descuento', price: 'Precio más bajo', rating: 'Por valoración' } },
    seo: { home: { title: 'Compras inteligentes — compras grupales y live commerce', description: '' } },
  },
  fr: {
    common: {
      login: 'Connexion', logout: 'Déconnexion', signup: "S'inscrire",
      cancel: 'Annuler', confirm: 'Confirmer', save: 'Enregistrer', delete: 'Supprimer', edit: 'Modifier',
      search: 'Recherche', loading: 'Chargement...', error: 'Erreur', success: 'Succès',
      back: 'Retour', next: 'Suivant', submit: 'Soumettre', close: 'Fermer', all: 'Tous',
    },
    nav: {
      home: 'Accueil', shop: 'Boutique', vouchers: 'Bons', live: 'En direct',
      linkshop: 'Linkshop', my: 'Mon', cart: 'Panier', myPage: 'Mon compte',
    },
    mainHome: { ariaSearch: 'Recherche', ariaCart: 'Panier' },
    restaurantMap: { nearMe: 'Près de moi', sort: { distance: 'Par distance', discount: 'Par remise', price: 'Prix croissant', rating: 'Par évaluation' } },
    seo: { home: { title: 'Achats malins — achats groupés & live commerce', description: '' } },
  },
}
