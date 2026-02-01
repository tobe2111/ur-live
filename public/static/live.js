// 라이브 스트림 뷰어 JavaScript (폴링 방식)
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // 앱 상태
  const state = {
    streamId: STREAM_ID,
    currentProductId: null,
    currentProduct: null,
    cart: [],
    userId: 'toss_user_001', // 실제로는 토스 로그인에서 받아옴
    player: null,
    sheetExpanded: false,
    pollingInterval: null,
    initAttempts: 0,
  };

  let appInitialized = false;

  // YouTube Player API 로드 완료 시 호출
  window.onYouTubeIframeAPIReady = function() {
    console.log('✅ YouTube IFrame API Ready');
    if (!appInitialized) {
      initApp();
    }
  };

  // DOM 로드 완료 후 초기화 시도
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    tryInitialize();
  });

  // 페이지 로드 완료 후에도 시도
  window.addEventListener('load', function() {
    console.log('Window Load Complete');
    tryInitialize();
  });

  // YouTube API 로딩 대기 및 재시도
  function tryInitialize() {
    if (appInitialized) {
      console.log('App already initialized');
      return;
    }

    if (window.YT && window.YT.Player) {
      console.log('✅ YouTube API available, initializing...');
      initApp();
    } else {
      state.initAttempts++;
      console.log(`⏳ YouTube API not ready yet (attempt ${state.initAttempts}), retrying...`);
      
      if (state.initAttempts < 20) { // 최대 10초 대기 (20 * 500ms)
        setTimeout(tryInitialize, 500);
      } else {
        console.error('❌ YouTube API failed to load after 10 seconds');
        showError('YouTube API를 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      }
    }
  }

  async function initApp() {
    if (appInitialized) {
      console.log('⚠️ App already initialized, skipping...');
      return;
    }
    
    appInitialized = true;
    console.log('🚀 Initializing app...');
    
    try {
      // 라이브 스트림 정보 로드
      await loadStreamInfo();
      
      // 폴링 시작 (3초마다 상품 확인)
      startPolling();
      
      // 장바구니 로드
      await loadCart();
      
      // UI 이벤트 바인딩
      setupUIEvents();
      
      // 페이지 가시성 변경 감지 (페이지로 돌아왔을 때)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.player && typeof state.player.playVideo === 'function') {
          console.log('Page visible again, resuming video...');
          try {
            state.player.playVideo();
          } catch (e) {
            console.warn('Failed to resume video:', e);
          }
        }
      });
      
      console.log('✅ App initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      appInitialized = false; // 실패 시 다시 시도 가능하도록
      showError('앱을 시작할 수 없습니다.');
    }
  }

  async function loadStreamInfo() {
    try {
      console.log('Loading stream info...');
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}`);
      if (response.data.success) {
        const stream = response.data.data;
        console.log('Stream data:', stream);
        
        // 라이브 타이틀 업데이트
        const titleEl = document.getElementById('stream-title');
        if (titleEl) {
          titleEl.textContent = stream.title;
        }
        
        // YouTube Player 초기화
        console.log('Creating YouTube Player with video ID:', stream.youtube_video_id);
        
        // 기존 플레이어 완전히 제거하고 컨테이너 재생성
        const playerContainer = document.getElementById('youtube-player');
        if (!playerContainer) {
          console.error('YouTube player container not found!');
          throw new Error('Player container not found');
        }
        
        // 기존 플레이어 파괴
        if (state.player && typeof state.player.destroy === 'function') {
          console.log('Destroying existing player...');
          try {
            state.player.destroy();
          } catch (e) {
            console.warn('Failed to destroy player:', e);
          }
          state.player = null;
        }
        
        // 컨테이너 내용 지우기
        playerContainer.innerHTML = '';
        
        // 새 플레이어 생성
        state.player = new YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 1,
            mute: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
          }
        });

        console.log('YouTube Player created');

        // 현재 상품 로드 (있는 경우)
        if (stream.current_product_id) {
          state.currentProductId = stream.current_product_id;
          await loadCurrentProduct();
        } else {
          console.warn('No current product');
          renderProduct(); // 빈 상태 렌더링
        }
      }
    } catch (error) {
      console.error('Failed to load stream info:', error);
      document.getElementById('product-content').innerHTML = `
        <div class="text-center py-8 text-red-500">
          <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
          <p class="font-semibold">방송 정보를 불러올 수 없습니다</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">
            다시 시도
          </button>
        </div>
      `;
      throw error;
    }
  }

  function onPlayerReady(event) {
    console.log('YouTube Player Ready');
    // 자동 재생 시도
    event.target.playVideo();
  }

  function onPlayerStateChange(event) {
    const states = {
      '-1': 'unstarted',
      '0': 'ended',
      '1': 'playing',
      '2': 'paused',
      '3': 'buffering',
      '5': 'video cued'
    };
    console.log('Player State:', event.data, '(' + (states[event.data] || 'unknown') + ')');
    
    // 재생 중인 경우
    if (event.data === 1) {
      console.log('✅ Video is playing');
    }
  }

  function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    const errorMessages = {
      2: '잘못된 비디오 ID입니다',
      5: 'HTML5 플레이어 오류입니다',
      100: '비디오를 찾을 수 없습니다',
      101: '비디오 소유자가 임베드를 허용하지 않습니다',
      150: '비디오 소유자가 임베드를 허용하지 않습니다'
    };
    showToast(`❌ ${errorMessages[event.data] || '재생 오류가 발생했습니다'}`, 'info');
  }

  function startPolling() {
    // 3초마다 현재 상품 확인
    state.pollingInterval = setInterval(async () => {
      await checkCurrentProduct();
    }, 3000);
  }

  async function checkCurrentProduct() {
    try {
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}/current-product`);
      if (response.data.success && response.data.data) {
        const newProduct = response.data.data.product;
        
        // 상품이 변경되었는지 확인
        if (newProduct && newProduct.id !== state.currentProductId) {
          state.currentProductId = newProduct.id;
          state.currentProduct = response.data.data;
          renderProduct();
          showProductChangeAnimation();
        }
      }
    } catch (error) {
      console.error('Failed to check current product:', error);
    }
  }

  async function loadCurrentProduct() {
    try {
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}/current-product`);
      if (response.data.success && response.data.data) {
        state.currentProduct = response.data.data;
        renderProduct();
      }
    } catch (error) {
      console.error('Failed to load current product:', error);
    }
  }

  async function loadProduct(productId) {
    try {
      const response = await axios.get(`${API_BASE}/products/${productId}`);
      if (response.data.success) {
        state.currentProduct = response.data.data;
        renderProduct();
      }
    } catch (error) {
      console.error('Failed to load product:', error);
    }
  }

  function renderProduct() {
    if (!state.currentProduct) {
      document.getElementById('product-content').innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-box-open text-4xl mb-2"></i>
          <p>현재 소개 중인 상품이 없습니다</p>
        </div>
      `;
      return;
    }

    const { product, options } = state.currentProduct;
    const discountPercent = product.discount_rate || 0;
    
    document.getElementById('product-content').innerHTML = `
      <!-- 축약형 (접힌 상태) -->
      <div class="product-content-compact">
        <img src="${product.image_url || 'https://via.placeholder.com/100'}" 
             alt="${product.name}" 
             class="w-20 h-20 object-cover rounded-lg flex-shrink-0">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold text-gray-800 truncate">${product.name}</h3>
          <div class="flex items-center gap-2 mt-1">
            ${discountPercent > 0 ? `<span class="text-xl font-bold text-red-500">${discountPercent}%</span>` : ''}
            <span class="text-xl font-bold text-gray-900">${formatPrice(product.price)}원</span>
            ${product.original_price ? `<span class="text-sm text-gray-400 line-through">${formatPrice(product.original_price)}원</span>` : ''}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            <i class="fas fa-box"></i> 재고 ${product.stock}개
          </div>
        </div>
      </div>
      
      <!-- 전체형 (확장 상태) -->
      <div class="product-content-full space-y-4">
        <!-- 상품 이미지 -->
        <img src="${product.image_url || 'https://via.placeholder.com/400'}" 
             alt="${product.name}" 
             class="w-full h-64 object-cover rounded-lg">
        
        <!-- 상품 정보 -->
        <div>
          ${product.category ? `<span class="text-sm text-blue-600 font-semibold">${product.category}</span>` : ''}
          <h2 class="text-2xl font-bold text-gray-800 mt-1">${product.name}</h2>
          <p class="text-gray-600 mt-2">${product.description || ''}</p>
        </div>

        <!-- 가격 정보 -->
        <div class="flex items-end gap-3">
          ${discountPercent > 0 ? `
            <span class="text-3xl font-bold text-red-500">${discountPercent}%</span>
            <span class="text-2xl text-gray-400 line-through">${formatPrice(product.original_price)}원</span>
          ` : ''}
          <span class="text-3xl font-bold text-gray-900">${formatPrice(product.price)}원</span>
        </div>

        <!-- 재고 정보 -->
        <div class="flex items-center gap-2 text-sm">
          <i class="fas fa-box text-gray-500"></i>
          <span class="text-gray-600">재고: ${product.stock}개</span>
        </div>

        <!-- 옵션 선택 -->
        ${renderOptions(options)}

        <!-- 구매 버튼 -->
        <div class="grid grid-cols-2 gap-3 pt-4">
          <button onclick="addToCart()" class="bg-white border-2 border-blue-500 text-blue-500 font-bold py-4 rounded-lg hover:bg-blue-50 transition">
            <i class="fas fa-cart-plus mr-2"></i>
            장바구니
          </button>
          <button onclick="buyNow()" class="toss-primary text-white font-bold py-4 rounded-lg hover:opacity-90 transition">
            <i class="fas fa-bolt mr-2"></i>
            바로 구매
          </button>
        </div>
      </div>
    `;
  }

  function renderOptions(options) {
    if (!options || options.length === 0) return '';

    // 옵션 타입별로 그룹화
    const groupedOptions = {};
    options.forEach(opt => {
      if (!groupedOptions[opt.option_type]) {
        groupedOptions[opt.option_type] = [];
      }
      groupedOptions[opt.option_type].push(opt);
    });

    return `
      <div class="space-y-3">
        ${Object.entries(groupedOptions).map(([type, opts]) => `
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">${type}</label>
            <select id="option-${type}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">선택하세요</option>
              ${opts.map(opt => `
                <option value="${opt.id}" data-adjustment="${opt.price_adjustment}" data-stock="${opt.stock}">
                  ${opt.option_value} ${opt.price_adjustment > 0 ? `(+${formatPrice(opt.price_adjustment)}원)` : ''}
                  ${opt.stock > 0 ? '' : '(품절)'}
                </option>
              `).join('')}
            </select>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.addToCart = async function() {
    if (!state.currentProduct) return;

    const { product, options } = state.currentProduct;
    
    // 옵션 선택 확인
    let selectedOptionId = null;
    if (options && options.length > 0) {
      const optionSelects = document.querySelectorAll('[id^="option-"]');
      for (const select of optionSelects) {
        if (!select.value) {
          showToast('❌ 모든 옵션을 선택해주세요');
          return;
        }
        selectedOptionId = parseInt(select.value);
      }
    }

    try {
      const response = await axios.post(`${API_BASE}/cart`, {
        userId: state.userId,
        productId: product.id,
        optionId: selectedOptionId,
        quantity: 1,
        priceSnapshot: product.price,
        liveStreamId: state.streamId,
      });

      if (response.data.success) {
        showToast('✓ 장바구니에 추가되었습니다!');
        await loadCart();
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      showToast('❌ 장바구니 추가에 실패했습니다', 'info');
    }
  };

  window.buyNow = async function() {
    await addToCart();
    window.location.href = '/cart';
  };

  async function loadCart() {
    try {
      const response = await axios.get(`${API_BASE}/cart/${state.userId}`);
      if (response.data.success) {
        state.cart = response.data.data;
        updateCartBadge();
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }

  function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const count = state.cart.length;
    
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('flex');
    }
  }

  function setupUIEvents() {
    // 장바구니 버튼 클릭
    document.getElementById('cart-button').addEventListener('click', () => {
      window.location.href = '/cart';
    });
  }

  function showProductChangeAnimation() {
    showToast('✨ 새로운 상품이 소개됩니다!', 'info');
    
    // 상품 시트 자동으로 확장
    const sheet = document.getElementById('product-sheet');
    if (!state.sheetExpanded) {
      sheet.classList.add('expanded');
      state.sheetExpanded = true;
    }
  }

  function showToast(message, type = 'success') {
    const toastEl = document.getElementById('toast-message');
    if (!toastEl) {
      console.error('Toast element not found');
      return;
    }
    
    // 아이콘 선택
    const icon = type === 'success' ? '✓' : 'ℹ';
    toastEl.textContent = `${icon} ${message}`;
    
    // 토스트 표시
    toastEl.classList.add('show');
    
    // 2초 후 숨김
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2000);
  }

  function formatPrice(price) {
    return price.toLocaleString('ko-KR');
  }

  function showError(message) {
    alert(message);
  }

  function handleStreamStatusChange(data) {
    if (data.status === 'ended') {
      alert('라이브 방송이 종료되었습니다.');
      window.location.href = '/';
    }
  }
})();
