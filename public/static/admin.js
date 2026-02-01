// 관리자 대시보드 JavaScript
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // 앱 상태
  const state = {
    currentStream: null,
    products: [],
    selectedProductId: null,
  };

  // 페이지 로드 시 초기화
  document.addEventListener('DOMContentLoaded', async () => {
    await initAdmin();
  });

  async function initAdmin() {
    try {
      await loadCurrentStream();
      await loadProducts();
      renderUI();
    } catch (error) {
      console.error('Failed to initialize admin:', error);
      showError('관리자 페이지를 로드할 수 없습니다.');
    }
  }

  async function loadCurrentStream() {
    try {
      const response = await axios.get(`${API_BASE}/streams`);
      if (response.data.success && response.data.data.length > 0) {
        state.currentStream = response.data.data[0]; // 첫 번째 라이브 스트림
      }
    } catch (error) {
      console.error('Failed to load current stream:', error);
      throw error;
    }
  }

  async function loadProducts() {
    if (!state.currentStream) return;

    try {
      const response = await axios.get(`${API_BASE}/streams/${state.currentStream.id}/products`);
      if (response.data.success) {
        state.products = response.data.data;
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      throw error;
    }
  }

  function renderUI() {
    renderCurrentStream();
    renderProducts();
  }

  function renderCurrentStream() {
    const container = document.getElementById('current-stream');
    
    if (!state.currentStream) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-video-slash text-3xl mb-2"></i>
          <p>진행 중인 라이브가 없습니다</p>
        </div>
      `;
      return;
    }

    const stream = state.currentStream;
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span class="font-semibold text-red-500">LIVE</span>
          </div>
          <a href="/live/${stream.id}" target="_blank" class="text-blue-500 hover:underline">
            <i class="fas fa-external-link-alt mr-1"></i>
            보기
          </a>
        </div>
        
        <div>
          <h3 class="text-lg font-bold text-gray-800">${stream.title}</h3>
          <p class="text-sm text-gray-600">${stream.description || ''}</p>
        </div>

        <div class="bg-gray-50 p-3 rounded">
          <div class="text-sm text-gray-600">YouTube Video ID</div>
          <div class="font-mono text-sm">${stream.youtube_video_id}</div>
        </div>

        ${stream.current_product_id ? `
          <div class="bg-blue-50 border border-blue-200 p-3 rounded">
            <div class="text-sm text-blue-600 font-semibold">현재 소개 중인 상품</div>
            <div class="text-sm">상품 ID: ${stream.current_product_id}</div>
          </div>
        ` : `
          <div class="bg-yellow-50 border border-yellow-200 p-3 rounded">
            <div class="text-sm text-yellow-600">소개 중인 상품이 없습니다</div>
          </div>
        `}
      </div>
    `;
  }

  function renderProducts() {
    const container = document.getElementById('product-list');
    
    if (state.products.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-box-open text-3xl mb-2"></i>
          <p>등록된 상품이 없습니다</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.products.map(product => `
      <div class="border rounded-lg p-4 hover:shadow-md transition ${
        state.currentStream?.current_product_id === product.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }">
        <div class="flex gap-4">
          <img src="${product.image_url || 'https://via.placeholder.com/100'}" 
               alt="${product.name}" 
               class="w-20 h-20 object-cover rounded">
          
          <div class="flex-1">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-bold text-gray-800">${product.name}</h3>
                <p class="text-sm text-gray-600 mt-1">${formatPrice(product.price)}원</p>
                ${product.discount_rate > 0 ? `
                  <span class="inline-block bg-red-100 text-red-600 text-xs px-2 py-1 rounded mt-1">
                    ${product.discount_rate}% 할인
                  </span>
                ` : ''}
              </div>
              
              ${state.currentStream?.current_product_id === product.id ? `
                <span class="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                  소개 중
                </span>
              ` : ''}
            </div>
            
            <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span><i class="fas fa-box mr-1"></i>재고: ${product.stock}</span>
              <span><i class="fas fa-tag mr-1"></i>${product.category || '미분류'}</span>
            </div>
            
            ${state.currentStream?.current_product_id !== product.id ? `
              <button 
                onclick="changeProduct(${product.id})" 
                class="mt-3 w-full toss-primary text-white py-2 rounded hover:opacity-90 transition text-sm font-semibold"
              >
                <i class="fas fa-exchange-alt mr-1"></i>
                이 상품으로 전환
              </button>
            ` : `
              <div class="mt-3 w-full bg-gray-200 text-gray-500 py-2 rounded text-center text-sm">
                현재 소개 중
              </div>
            `}
          </div>
        </div>
      </div>
    `).join('');
  }

  window.changeProduct = async function(productId) {
    if (!state.currentStream) {
      alert('진행 중인 라이브가 없습니다.');
      return;
    }

    if (!confirm('상품을 전환하시겠습니까?\n모든 시청자에게 새로운 상품이 표시됩니다.')) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/admin/streams/${state.currentStream.id}/change-product`,
        { productId }
      );

      if (response.data.success) {
        showToast('상품이 전환되었습니다!');
        
        // 현재 스트림 정보 업데이트
        state.currentStream.current_product_id = productId;
        
        // UI 다시 렌더링
        renderUI();
      }
    } catch (error) {
      console.error('Failed to change product:', error);
      alert('상품 전환에 실패했습니다.');
    }
  };

  function formatPrice(price) {
    return price.toLocaleString('ko-KR');
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function showError(message) {
    alert(message);
  }
})();
