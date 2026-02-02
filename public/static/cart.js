// 장바구니 페이지 스크립트
const API_BASE = '/api';

// 토스 브릿지에서 유저 정보 가져오기
async function getTossUserInfo() {
  try {
    const response = await axios.get(`${API_BASE}/toss/user-info`);
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('❌ 토스 유저 정보 가져오기 실패:', error);
  }
  
  // 실패 시 게스트 유저 생성
  const guestUserId = `web_user_${Date.now()}`;
  console.log('🎯 게스트 유저 생성:', guestUserId);
  return {
    userId: guestUserId,
    name: '게스트',
    isGuest: true
  };
}

let currentUser = null;
let cartData = [];

// 페이지 로드 시 장바구니 불러오기
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 토스 유저 정보 가져오기
  currentUser = await getTossUserInfo();
  console.log('👤 현재 유저:', currentUser);
  
  // 2. 장바구니 불러오기
  await loadCart();
});

// 장바구니 불러오기
async function loadCart() {
  try {
    const response = await axios.get(`${API_BASE}/cart/${currentUser.userId}`);
    if (response.data.success) {
      cartData = response.data.data;
      renderCart();
    }
  } catch (error) {
    console.error('❌ 장바구니 불러오기 실패:', error);
    document.getElementById('cart-items').innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon"><i class="fas fa-exclamation-circle"></i></div>
        <div class="empty-title">장바구니를 불러올 수 없습니다</div>
        <div class="empty-desc">잠시 후 다시 시도해주세요</div>
        <button class="btn-secondary" onclick="loadCart()">다시 시도</button>
      </div>
    `;
  }
}

// 장바구니 렌더링
function renderCart() {
  const container = document.getElementById('cart-items');
  
  if (cartData.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon"><i class="fas fa-shopping-cart"></i></div>
        <div class="empty-title">장바구니가 비어있습니다</div>
        <div class="empty-desc">라이브 방송에서 마음에 드는 상품을<br>담아보세요</div>
        <button class="btn-secondary" onclick="window.location.href='/live/1'">
          <i class="fas fa-broadcast-tower"></i>
          라이브 보러 가기
        </button>
      </div>
    `;
    document.getElementById('checkout-bar').style.display = 'none';
    return;
  }

  // 장바구니 아이템 렌더링
  container.innerHTML = cartData.map((item, index) => {
    const optionText = item.option_value ? `옵션: ${item.option_value}` : '';
    
    return `
      <div class="cart-item">
        <div class="item-content">
          <img src="${item.image_url || 'https://picsum.photos/80/80?random=' + item.product_id}" 
               alt="${item.product_name}" 
               class="item-image"
               onerror="this.src='https://picsum.photos/80/80?random=${item.product_id}'">
          
          <div class="item-details">
            <div class="item-name">${item.product_name}</div>
            ${optionText ? `<div class="item-option">${optionText}</div>` : ''}
            <div class="item-price-row">
              <span class="item-price">${formatPrice(item.price_snapshot)}원</span>
            </div>
          </div>
        </div>
        
        <div class="quantity-controls">
          <span class="quantity-label">수량</span>
          <div class="quantity-button-group">
            <button class="quantity-btn" onclick="updateQuantity(${index}, -1)" ${item.quantity <= 1 ? 'disabled' : ''}>
              <i class="fas fa-minus"></i>
            </button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">
              <i class="fas fa-plus"></i>
            </button>
            <button class="delete-btn" onclick="removeItem(${index})">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 총 금액 계산 및 표시
  updateTotalPrice();
  document.getElementById('checkout-bar').style.display = 'block';
}

// 수량 변경
async function updateQuantity(index, change) {
  const item = cartData[index];
  const newQuantity = item.quantity + change;
  
  if (newQuantity < 1) return;
  
  try {
    console.log(`🔄 수량 변경: ${item.product_name} ${item.quantity} → ${newQuantity}`);
    
    // API 호출하여 수량 업데이트
    const response = await axios.put(`${API_BASE}/cart/${item.id}`, {
      quantity: newQuantity
    });
    
    if (response.data.success) {
      item.quantity = newQuantity;
      renderCart();
      console.log('✅ 수량 변경 완료');
    }
  } catch (error) {
    console.error('❌ 수량 변경 실패:', error);
    alert('수량 변경에 실패했습니다');
  }
}

// 아이템 삭제
async function removeItem(index) {
  const item = cartData[index];
  
  if (!confirm(`${item.product_name}을(를) 장바구니에서 삭제하시겠습니까?`)) {
    return;
  }
  
  try {
    console.log(`🗑️ 삭제: ${item.product_name}`);
    
    const response = await axios.delete(`${API_BASE}/cart/${item.id}`);
    
    if (response.data.success) {
      cartData.splice(index, 1);
      renderCart();
      console.log('✅ 삭제 완료');
    }
  } catch (error) {
    console.error('❌ 삭제 실패:', error);
    alert('상품 삭제에 실패했습니다');
  }
}

// 총 금액 계산
function updateTotalPrice() {
  const total = cartData.reduce((sum, item) => sum + (item.price_snapshot * item.quantity), 0);
  document.getElementById('subtotal-amount').textContent = formatPrice(total) + '원';
  document.getElementById('total-amount').textContent = formatPrice(total) + '원';
  document.getElementById('checkout-btn-text').textContent = `${formatPrice(total)}원 결제하기`;
}

// 가격 포맷 (천 단위 콤마)
function formatPrice(price) {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 결제하기
async function goToCheckout() {
  if (cartData.length === 0) {
    alert('장바구니가 비어있습니다');
    return;
  }
  
  console.log('💳 결제 시작');
  console.log('👤 유저:', currentUser);
  console.log('🛒 장바구니:', cartData);
  
  try {
    // 1. 결제 생성 요청
    const totalAmount = cartData.reduce((sum, item) => sum + (item.price_snapshot * item.quantity), 0);
    const orderNo = `ORDER-${Date.now()}`;
    const productDesc = cartData.length === 1 
      ? cartData[0].product_name 
      : `${cartData[0].product_name} 외 ${cartData.length - 1}건`;
    
    console.log('📝 결제 정보:', {
      orderNo,
      productDesc,
      amount: totalAmount,
      userKey: currentUser.userId
    });
    
    const createResponse = await axios.post(`${API_BASE}/tosspay/create-payment`, {
      userKey: currentUser.userId,
      orderNo,
      productDesc,
      amount: totalAmount,
      amountTaxFree: 0,
      isTestPayment: true // 테스트 모드
    });
    
    if (!createResponse.data.success) {
      throw new Error('결제 생성 실패: ' + (createResponse.data.error || '알 수 없는 오류'));
    }
    
    const { payToken } = createResponse.data.data;
    console.log('✅ 결제 생성 완료, payToken:', payToken);
    
    // 2. 토스 브릿지 checkoutPayment 호출
    console.log('🔵 토스페이 결제창 호출...');
    
    // TODO: 실제 토스 브릿지 연동
    // const result = await window.TossBridge.checkoutPayment({ payToken });
    
    // 임시: 결제 성공 시뮬레이션
    alert(`결제 기능 준비 중입니다!\n\n주문번호: ${orderNo}\n결제 토큰: ${payToken}\n총 금액: ${formatPrice(totalAmount)}원`);
    
    // 3. 결제 승인 요청
    // const executeResponse = await axios.post(`${API_BASE}/tosspay/execute-payment`, {
    //   userKey: currentUser.userId,
    //   payToken,
    //   orderNo,
    //   isTestPayment: true
    // });
    
    // 4. 주문 완료 페이지로 이동
    // window.location.href = `/orders/${orderNo}`;
    
  } catch (error) {
    console.error('❌ 결제 실패:', error);
    alert('결제에 실패했습니다: ' + (error.response?.data?.error || error.message));
  }
}
