// ==========================================
// 설정
// ==========================================
const API_BASE = '/api';

// ==========================================
// 상태 관리
// ==========================================
let orders = [];
let currentOrder = null;

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadOrders();
});

// ==========================================
// 인증 확인
// ==========================================
function checkAuth() {
    const userId = localStorage.getItem('userId');
    const session = localStorage.getItem('session');
    
    if (!userId || !session) {
        alert('로그인이 필요합니다.');
        window.location.href = '/live/1';
        return false;
    }
    
    return true;
}

// ==========================================
// 주문 목록 불러오기
// ==========================================
async function loadOrders() {
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        showEmptyState();
        return;
    }
    
    try {
        console.log('📦 주문 내역 로딩 중...', { userId });
        
        const response = await axios.get(`${API_BASE}/orders/user/${userId}`);
        
        console.log('📦 주문 내역 응답:', response.data);
        
        if (response.data.success) {
            orders = response.data.data || [];
            
            if (orders.length === 0) {
                showEmptyState();
            } else {
                renderOrders();
            }
        } else {
            throw new Error(response.data.error || '주문 내역을 불러올 수 없습니다');
        }
        
    } catch (error) {
        console.error('❌ 주문 내역 로딩 실패:', error);
        
        // 네트워크 오류거나 404인 경우 빈 상태 표시
        if (error.response?.status === 404 || !error.response) {
            showEmptyState();
        } else {
            alert('주문 내역을 불러오는데 실패했습니다.\n' + (error.response?.data?.error || error.message));
            showEmptyState();
        }
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// ==========================================
// 빈 상태 표시
// ==========================================
function showEmptyState() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('empty-state').classList.add('show');
    document.getElementById('orders-list').classList.remove('show');
}

// ==========================================
// 주문 목록 렌더링
// ==========================================
function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    
    ordersList.innerHTML = orders.map(order => {
        const items = order.items || [];
        const firstItem = items[0] || {};
        const moreItemsCount = items.length - 1;
        
        return `
            <div class="order-card" onclick="showOrderDetail('${order.order_number}')">
                <div class="order-header">
                    <div>
                        <div class="order-number">${order.order_number}</div>
                        <div class="order-date">${formatDate(order.created_at)}</div>
                    </div>
                    <span class="order-status ${getStatusClass(order.payment_status, order.shipping_status)}">
                        ${getStatusText(order.payment_status, order.shipping_status)}
                    </span>
                </div>
                
                <div class="order-items">
                    ${items.slice(0, 2).map(item => `
                        <div class="order-item">
                            <img src="${item.image_url || 'https://via.placeholder.com/60'}" 
                                 alt="${item.product_name}" 
                                 class="item-image">
                            <div class="item-info">
                                <div class="item-name">${item.product_name || '상품명'}</div>
                                <div class="item-details">
                                    ${formatPrice(item.price)}원 · ${item.quantity}개
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    ${moreItemsCount > 0 ? `
                        <div style="font-size: 13px; color: #6B7684; margin-top: 8px;">
                            외 ${moreItemsCount}개 상품
                        </div>
                    ` : ''}
                </div>
                
                <div class="order-footer">
                    <div>
                        <span class="order-total-label">총 결제금액</span>
                        <span class="order-total">${formatPrice(order.total_amount)}원</span>
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-outline" onclick="event.stopPropagation(); showOrderDetail('${order.order_number}')">
                            상세보기
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('orders-list').classList.add('show');
    document.getElementById('empty-state').classList.remove('show');
}

// ==========================================
// 주문 상세 보기
// ==========================================
async function showOrderDetail(orderNumber) {
    try {
        console.log('📋 주문 상세 조회:', orderNumber);
        
        const response = await axios.get(`${API_BASE}/orders/${orderNumber}`);
        
        if (response.data.success) {
            currentOrder = response.data.data;
            renderOrderDetail();
            document.getElementById('order-modal').classList.add('show');
        } else {
            throw new Error(response.data.error || '주문 정보를 불러올 수 없습니다');
        }
        
    } catch (error) {
        console.error('❌ 주문 상세 조회 실패:', error);
        alert('주문 정보를 불러오는데 실패했습니다.\n' + (error.response?.data?.error || error.message));
    }
}

// ==========================================
// 주문 상세 렌더링
// ==========================================
function renderOrderDetail() {
    if (!currentOrder) return;
    
    const items = currentOrder.items || [];
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <!-- 주문 정보 -->
        <div class="info-section">
            <div class="section-title">주문 정보</div>
            <div class="info-row">
                <span class="info-label">주문번호</span>
                <span class="info-value">${currentOrder.order_number}</span>
            </div>
            <div class="info-row">
                <span class="info-label">주문일시</span>
                <span class="info-value">${formatDate(currentOrder.created_at)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">결제상태</span>
                <span class="info-value">
                    <span class="order-status ${getStatusClass(currentOrder.payment_status, currentOrder.shipping_status)}">
                        ${getStatusText(currentOrder.payment_status, currentOrder.shipping_status)}
                    </span>
                </span>
            </div>
        </div>
        
        <!-- 주문 상품 -->
        <div class="info-section">
            <div class="section-title">주문 상품</div>
            ${items.map(item => `
                <div class="order-item" style="margin-bottom: 16px;">
                    <img src="${item.image_url || 'https://via.placeholder.com/60'}" 
                         alt="${item.product_name}" 
                         class="item-image">
                    <div class="item-info">
                        <div class="item-name">${item.product_name || '상품명'}</div>
                        <div class="item-details">
                            ${formatPrice(item.price)}원 · ${item.quantity}개
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- 배송 정보 -->
        <div class="info-section">
            <div class="section-title">배송 정보</div>
            <div class="info-row">
                <span class="info-label">받는 분</span>
                <span class="info-value">${currentOrder.shipping_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">연락처</span>
                <span class="info-value">${currentOrder.shipping_phone || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">배송지</span>
                <span class="info-value" style="max-width: 60%; word-break: break-word;">
                    ${currentOrder.shipping_address || '-'}
                </span>
            </div>
            ${currentOrder.tracking_number ? `
                <div class="info-row">
                    <span class="info-label">송장번호</span>
                    <span class="info-value">${currentOrder.tracking_number}</span>
                </div>
            ` : ''}
        </div>
        
        <!-- 결제 정보 -->
        <div class="info-section">
            <div class="section-title">결제 정보</div>
            <div class="info-row">
                <span class="info-label">상품 금액</span>
                <span class="info-value">${formatPrice(currentOrder.total_amount)}원</span>
            </div>
            <div class="info-row">
                <span class="info-label">배송비</span>
                <span class="info-value">무료</span>
            </div>
            <div class="info-row" style="border-top: 2px solid #191F28; padding-top: 12px; margin-top: 8px;">
                <span class="info-label" style="font-weight: 700; color: #191F28;">총 결제금액</span>
                <span class="info-value" style="font-size: 18px; font-weight: 700; color: #3182F6;">
                    ${formatPrice(currentOrder.total_amount)}원
                </span>
            </div>
        </div>
        
        <!-- 액션 버튼 -->
        <div style="display: flex; gap: 8px; margin-top: 24px;">
            ${currentOrder.payment_status === 'approved' && currentOrder.shipping_status === 'pending' ? `
                <button class="btn btn-outline" style="flex: 1;" onclick="requestRefund('${currentOrder.order_number}')">
                    <i class="fas fa-undo"></i> 주문 취소
                </button>
            ` : ''}
            ${currentOrder.tracking_number ? `
                <button class="btn btn-primary" style="flex: 1;" onclick="trackDelivery('${currentOrder.tracking_number}')">
                    <i class="fas fa-truck"></i> 배송 조회
                </button>
            ` : ''}
        </div>
    `;
}

// ==========================================
// 모달 닫기
// ==========================================
function closeModal() {
    document.getElementById('order-modal').classList.remove('show');
    currentOrder = null;
}

// 모달 외부 클릭 시 닫기
document.getElementById('order-modal').addEventListener('click', (e) => {
    if (e.target.id === 'order-modal') {
        closeModal();
    }
});

// ==========================================
// 환불 요청
// ==========================================
async function requestRefund(orderNumber) {
    // 취소 사유 입력 받기
    const reason = prompt('취소 사유를 입력해주세요:', '단순 변심');
    
    if (!reason || reason.trim() === '') {
        alert('취소 사유를 입력해주세요.');
        return;
    }
    
    if (!confirm(`주문을 취소하시겠습니까?\n\n취소 사유: ${reason}\n\n결제가 취소되고 환불 처리됩니다.`)) {
        return;
    }
    
    try {
        console.log('🔄 주문 취소 요청:', {
            orderNumber,
            reason
        });
        
        // 취소 API 호출
        const response = await axios.post(`${API_BASE}/payments/nicepay/cancel`, {
            orderNo: orderNumber,
            tid: currentOrder.payment_key, // TID는 payment_key에 저장되어 있음
            cancelAmt: currentOrder.total_amount.toString(),
            cancelMsg: reason.trim()
        });
        
        console.log('✅ 취소 응답:', response.data);
        
        if (response.data.success) {
            alert('주문 취소가 완료되었습니다.\n환불은 영업일 기준 3-5일 소요될 수 있습니다.');
            closeModal();
            loadOrders(); // 목록 새로고침
        } else {
            throw new Error(response.data.error || '주문 취소에 실패했습니다');
        }
        
    } catch (error) {
        console.error('❌ 환불 요청 실패:', error);
        
        let errorMessage = '주문 취소에 실패했습니다.';
        
        if (error.response?.data?.error) {
            errorMessage += '\n' + error.response.data.error;
        } else if (error.message) {
            errorMessage += '\n' + error.message;
        }
        
        alert(errorMessage);
    }
}

// ==========================================
// 배송 조회
// ==========================================
function trackDelivery(trackingNumber) {
    alert(`배송 조회 기능은 준비 중입니다.\n송장번호: ${trackingNumber}`);
    // TODO: 실제 배송 조회 페이지로 이동
}

// ==========================================
// 유틸리티 함수
// ==========================================

// 날짜 포맷
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}.${month}.${day} ${hours}:${minutes}`;
}

// 가격 포맷
function formatPrice(price) {
    if (!price && price !== 0) return '0';
    return Number(price).toLocaleString('ko-KR');
}

// 상태 클래스
function getStatusClass(paymentStatus, shippingStatus) {
    if (paymentStatus === 'failed') return 'status-failed';
    if (paymentStatus === 'pending') return 'status-pending';
    if (shippingStatus === 'delivered') return 'status-delivered';
    if (shippingStatus === 'shipping') return 'status-shipping';
    if (paymentStatus === 'approved') return 'status-approved';
    return 'status-pending';
}

// 상태 텍스트
function getStatusText(paymentStatus, shippingStatus) {
    if (paymentStatus === 'failed') return '결제 실패';
    if (paymentStatus === 'pending') return '결제 대기';
    if (shippingStatus === 'delivered') return '배송 완료';
    if (shippingStatus === 'shipping') return '배송 중';
    if (shippingStatus === 'pending' && paymentStatus === 'approved') return '배송 준비';
    if (paymentStatus === 'approved') return '결제 완료';
    return '주문 접수';
}
