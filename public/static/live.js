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
  };

  // YouTube Player API 로드 완료 시 호출
  window.onYouTubeIframeAPIReady = function() {
    initApp();
  };

  async function initApp() {
    try {
      // 라이브 스트림 정보 로드
      await loadStreamInfo();
      
      // 폴링 시작 (3초마다 상품 확인)
      startPolling();
      
      // 장바구니 로드
      await loadCart();
      
      // UI 이벤트 바인딩
      setupUIEvents();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showError('앱을 시작할 수 없습니다.');
    }
  }

  async function loadStreamInfo() {
    try {
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}`);
      if (response.data.success) {
        const stream = response.data.data;
        
        // YouTube Player 초기화
        state.player = new YT.Player('youtube-player', {
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
        });

        // 현재 상품 로드 (있는 경우)
        if (stream.current_product_id) {
          state.currentProductId = stream.current_product_id;
          await loadCurrentProduct();
        }
      }
    } catch (error) {
      console.error('Failed to load stream info:', error);
      throw error;
    }
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
      <div class="space-y-4">
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
          alert('모든 옵션을 선택해주세요.');
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
        showToast('장바구니에 추가되었습니다!');
        await loadCart();
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert('장바구니 추가에 실패했습니다.');
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
    // 상품 시트 드래그 핸들 클릭
    const sheet = document.getElementById('product-sheet');
    const handle = sheet.querySelector('.product-sheet-drag-handle');
    
    handle.addEventListener('click', () => {
      state.sheetExpanded = !state.sheetExpanded;
      sheet.classList.toggle('expanded', state.sheetExpanded);
    });

    // 장바구니 버튼 클릭
    document.getElementById('cart-button').addEventListener('click', () => {
      window.location.href = '/cart';
    });
  }

  function showProductChangeAnimation() {
    showToast('새로운 상품이 소개됩니다!', 'info');
    
    // 상품 시트가 닫혀있으면 자동으로 열기
    if (!state.sheetExpanded) {
      const sheet = document.getElementById('product-sheet');
      state.sheetExpanded = true;
      sheet.classList.add('expanded');
    }
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity ${
      type === 'success' ? 'bg-green-500' : 'bg-blue-500'
    } text-white`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
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
