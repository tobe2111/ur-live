// 토스페이먼츠 결제 위젯 JavaScript
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // 토스페이먼츠 설정 (실제 사용 시 환경 변수로 관리)
  const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'; // 테스트용 키
  
  // 앱 상태
  const state = {
    userId: 'toss_user_001',
    cart: [],
    selectedItems: [],
    shippingInfo: {
      name: '',
      phone: '',
      address: '',
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await initCart();
  });

  async function initCart() {
    await loadCart();
    renderCart();
    setupUIEvents();
  }

  async function loadCart() {
    try {
      const response = await axios.get(`${API_BASE}/cart/${state.userId}`);
      if (response.data.success) {
        state.cart = response.data.data;
        state.selectedItems = state.cart.map(item => item.id);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }

  function renderCart() {
    const container = document.getElementById('cart-container');
    
    if (state.cart.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16">
          <i class="fas fa-shopping-cart text-6xl text-gray-300 mb-4"></i>
          <p class="text-xl text-gray-600 mb-4">장바구니가 비어있습니다</p>
          <a href="/" class="inline-block toss-primary text-white px-6 py-3 rounded-lg font-semibold">
            쇼핑 계속하기
          </a>
        </div>
      `;
      return;
    }

    const totalAmount = calculateTotalAmount();
    
    container.innerHTML = `
      <div class="space-y-4">
        ${state.cart.map(item => renderCartItem(item)).join('')}
      </div>

      <!-- 총 금액 -->
      <div class="mt-8 bg-white rounded-lg shadow p-6">
        <div class="space-y-3">
          <div class="flex justify-between text-lg">
            <span>상품 금액</span>
            <span>${formatPrice(totalAmount)}원</span>
          </div>
          <div class="flex justify-between text-lg">
            <span>배송비</span>
            <span class="text-green-600">무료</span>
          </div>
          <hr>
          <div class="flex justify-between text-2xl font-bold">
            <span>총 결제 금액</span>
            <span class="toss-text-primary">${formatPrice(totalAmount)}원</span>
          </div>
        </div>
      </div>

      <!-- 배송 정보 입력 -->
      <div class="mt-8 bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">배송 정보</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">받는 사람</label>
            <input type="text" id="shipping-name" placeholder="이름을 입력하세요" 
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">연락처</label>
            <input type="tel" id="shipping-phone" placeholder="010-0000-0000" 
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">배송 주소</label>
            <input type="text" id="shipping-address" placeholder="배송 받을 주소를 입력하세요" 
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg">
          </div>
        </div>
      </div>

      <!-- 주문 버튼 -->
      <button onclick="proceedToPayment()" 
              class="w-full mt-8 toss-primary text-white font-bold py-4 rounded-lg text-xl hover:opacity-90 transition">
        <i class="fas fa-check-circle mr-2"></i>
        ${formatPrice(totalAmount)}원 결제하기
      </button>
    `;
  }

  function renderCartItem(item) {
    const isSelected = state.selectedItems.includes(item.id);
    
    return `
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex gap-4">
          <input type="checkbox" 
                 class="w-5 h-5 mt-1"
                 ${isSelected ? 'checked' : ''}
                 onchange="toggleItemSelection(${item.id})">
          
          <img src="${item.product_image || 'https://via.placeholder.com/100'}" 
               alt="${item.product_name}" 
               class="w-24 h-24 object-cover rounded">
          
          <div class="flex-1">
            <h3 class="font-bold text-gray-800">${item.product_name}</h3>
            ${item.option_info ? `<p class="text-sm text-gray-600 mt-1">${item.option_info}</p>` : ''}
            <p class="text-lg font-bold mt-2">${formatPrice(item.price_snapshot)}원</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-sm text-gray-600">수량:</span>
              <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})" 
                      class="w-8 h-8 border rounded hover:bg-gray-100">-</button>
              <span class="w-12 text-center">${item.quantity}</span>
              <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})" 
                      class="w-8 h-8 border rounded hover:bg-gray-100">+</button>
            </div>
          </div>
          
          <button onclick="removeFromCart(${item.id})" 
                  class="text-gray-400 hover:text-red-500">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>
    `;
  }

  window.toggleItemSelection = function(itemId) {
    const index = state.selectedItems.indexOf(itemId);
    if (index > -1) {
      state.selectedItems.splice(index, 1);
    } else {
      state.selectedItems.push(itemId);
    }
    renderCart();
  };

  window.updateQuantity = async function(itemId, newQuantity) {
    if (newQuantity < 1) return;
    
    // 실제로는 서버에 PATCH 요청을 보내야 함
    const item = state.cart.find(i => i.id === itemId);
    if (item) {
      item.quantity = newQuantity;
      renderCart();
    }
  };

  window.removeFromCart = async function(itemId) {
    if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) return;
    
    try {
      await axios.delete(`${API_BASE}/cart/${itemId}`);
      state.cart = state.cart.filter(item => item.id !== itemId);
      state.selectedItems = state.selectedItems.filter(id => id !== itemId);
      renderCart();
      showToast('장바구니에서 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  window.proceedToPayment = async function() {
    // 배송 정보 검증
    const name = document.getElementById('shipping-name').value.trim();
    const phone = document.getElementById('shipping-phone').value.trim();
    const address = document.getElementById('shipping-address').value.trim();

    if (!name || !phone || !address) {
      alert('배송 정보를 모두 입력해주세요.');
      return;
    }

    if (state.selectedItems.length === 0) {
      alert('결제할 상품을 선택해주세요.');
      return;
    }

    state.shippingInfo = { name, phone, address };

    try {
      // 주문 생성
      const response = await axios.post(`${API_BASE}/orders`, {
        userId: state.userId,
        cartItemIds: state.selectedItems,
        shippingInfo: state.shippingInfo,
      });

      if (response.data.success) {
        const { orderId, orderNumber, totalAmount } = response.data.data;
        
        // 토스페이먼츠 결제 위젯 초기화 및 결제 요청
        await initiateTossPayment(orderNumber, totalAmount);
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('주문 생성에 실패했습니다.');
    }
  };

  async function initiateTossPayment(orderNumber, amount) {
    // 토스페이먼츠 결제 위젯 SDK 로드 확인
    if (typeof TossPayments === 'undefined') {
      alert('결제 모듈을 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      // 토스페이먼츠 객체 생성
      const tossPayments = TossPayments(TOSS_CLIENT_KEY);
      
      // 결제창 호출
      await tossPayments.requestPayment('카드', {
        amount: amount,
        orderId: orderNumber,
        orderName: `토스 라이브 커머스 주문 (${orderNumber})`,
        customerName: state.shippingInfo.name,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (error) {
      console.error('Payment initiation failed:', error);
      alert('결제 요청에 실패했습니다.');
    }
  }

  function calculateTotalAmount() {
    return state.cart
      .filter(item => state.selectedItems.includes(item.id))
      .reduce((sum, item) => sum + (item.price_snapshot * item.quantity), 0);
  }

  function setupUIEvents() {
    // 추가 이벤트 핸들러 설정
  }

  function formatPrice(price) {
    return price.toLocaleString('ko-KR');
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
})();
