// Seller Dashboard JavaScript
const API_BASE = '/api';
let sessionToken = localStorage.getItem('sessionToken');
let currentProducts = [];
let currentLiveStreams = [];
let liveStreamPollingInterval = null;

// Check authentication
async function checkAuth() {
    if (!sessionToken) {
        window.location.href = '/seller/login';
        return false;
    }

    try {
        const response = await axios.get(`${API_BASE}/auth/verify`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success && response.data.data.user.type === 'seller') {
            const user = response.data.data.user;
            document.getElementById('sellerName').textContent = `${user.name} (${user.business_name || user.businessName})`;
            return true;
        } else {
            localStorage.removeItem('sessionToken');
            window.location.href = '/seller/login';
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('sessionToken');
        window.location.href = '/seller/login';
        return false;
    }
}

// Logout
function logout() {
    axios.post(`${API_BASE}/auth/logout`, {}, {
        headers: { 'X-Session-Token': sessionToken }
    }).finally(() => {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('userName');
        window.location.href = '/seller/login';
    });
}

// Load stats
async function loadStats() {
    try {
        const response = await axios.get(`${API_BASE}/seller/stats`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success) {
            const stats = response.data.data;
            document.getElementById('statTotalProducts').textContent = stats.totalProducts;
            document.getElementById('statActiveProducts').textContent = stats.activeProducts;
            document.getElementById('statTotalStock').textContent = stats.totalStock;
            document.getElementById('statRevenue').textContent = formatPrice(stats.totalRevenue) + '원';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load products
async function loadProducts() {
    try {
        const response = await axios.get(`${API_BASE}/seller/products`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success) {
            currentProducts = response.data.data;
            renderProducts(currentProducts);
        }
    } catch (error) {
        console.error('Failed to load products:', error);
        document.getElementById('productsList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
                <p style="margin-top: 16px;">상품을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

// Render products
function renderProducts(products) {
    const container = document.getElementById('productsList');

    if (products.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--ur-gray-600);">
                <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px;">등록된 상품이 없습니다.</p>
                <p style="font-size: 14px; margin-top: 8px;">새 상품 등록 버튼을 클릭하여 시작하세요.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image_url || 'https://picsum.photos/120/120?random=' + product.id}" 
                 alt="${product.name}" 
                 class="product-image"
                 onerror="this.src='https://picsum.photos/120/120?random=${product.id}'">
            
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <h3 style="font-size: 16px; font-weight: 600; color: var(--ur-gray-900); margin: 0;">
                        ${product.name}
                    </h3>
                    <span class="status-badge status-${product.is_active ? 'active' : 'inactive'}">
                        ${product.is_active ? '판매중' : '판매중지'}
                    </span>
                    ${product.discount_rate > 0 ? `
                        <span style="background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${product.discount_rate}% 할인
                        </span>
                    ` : ''}
                </div>
                
                <p style="font-size: 14px; color: var(--ur-gray-600); margin-bottom: 12px;">
                    ${product.description || '설명 없음'}
                </p>
                
                <div style="display: flex; gap: 24px; font-size: 14px; margin-bottom: 12px;">
                    <div>
                        <span style="color: var(--ur-gray-600);">판매가:</span>
                        <strong style="color: var(--seller-pink); font-size: 18px; font-weight: 700; margin-left: 8px;">
                            ${formatPrice(product.price)}원
                        </strong>
                        ${product.original_price ? `
                            <span style="text-decoration: line-through; color: var(--ur-gray-600); margin-left: 8px;">
                                ${formatPrice(product.original_price)}원
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div style="display: flex; gap: 16px; font-size: 13px; color: var(--ur-gray-600);">
                    <span>
                        <i class="fas fa-tag"></i> ${product.category || '기타'}
                    </span>
                    <span>
                        <i class="fas fa-warehouse"></i> 재고 ${product.stock}개
                    </span>
                    <span>
                        <i class="fas fa-calendar"></i> ${formatDate(product.created_at)}
                    </span>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                <button onclick="toggleActive(${product.id}, ${product.is_active})" 
                        class="btn ${product.is_active ? 'btn-secondary' : 'btn-primary'}" 
                        style="padding: 8px 16px; font-size: 13px; white-space: nowrap;">
                    <i class="fas fa-${product.is_active ? 'pause' : 'play'}-circle"></i>
                    ${product.is_active ? '판매중지' : '판매시작'}
                </button>
                <button onclick="editProduct(${product.id})" 
                        class="btn btn-primary" 
                        style="padding: 8px 16px; font-size: 13px;">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button onclick="deleteProduct(${product.id})" 
                        class="btn btn-danger" 
                        style="padding: 8px 16px; font-size: 13px;">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `).join('');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('ko-KR').format(price);
}

// Open create modal
function openCreateModal() {
    document.getElementById('modalTitle').textContent = '새 상품 등록';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productModal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('productModal').classList.remove('show');
}

// Edit product
function editProduct(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('modalTitle').textContent = '상품 수정';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.original_price || '';
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productCategory').value = product.category || '기타';
    document.getElementById('productImageUrl').value = product.image_url || '';
    document.getElementById('productModal').classList.add('show');
}

// Toggle active status
async function toggleActive(id, currentStatus) {
    const newStatus = !currentStatus;
    const statusText = newStatus ? '판매 시작' : '판매 중지';
    
    if (!confirm(`이 상품을 ${statusText}하시겠습니까?`)) return;

    try {
        await axios.put(`${API_BASE}/seller/products/${id}`, 
            { is_active: newStatus },
            { headers: { 'X-Session-Token': sessionToken } }
        );

        alert(`상품이 ${statusText}되었습니다.`);
        loadProducts();
        loadStats();
    } catch (error) {
        console.error('Failed to toggle status:', error);
        alert('상태 변경에 실패했습니다.');
    }
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('정말 이 상품을 삭제하시겠습니까?')) return;

    try {
        await axios.delete(`${API_BASE}/seller/products/${id}`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        alert('상품이 삭제되었습니다.');
        loadProducts();
        loadStats();
    } catch (error) {
        console.error('Failed to delete product:', error);
        alert('삭제에 실패했습니다.');
    }
}

// Handle product form submit
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = parseInt(document.getElementById('productPrice').value);
    const original_price = document.getElementById('productOriginalPrice').value ? 
                          parseInt(document.getElementById('productOriginalPrice').value) : null;
    const stock = parseInt(document.getElementById('productStock').value);
    const category = document.getElementById('productCategory').value;
    const image_url = document.getElementById('productImageUrl').value || null;

    try {
        if (id) {
            // Update
            await axios.put(`${API_BASE}/seller/products/${id}`, 
                { name, description, price, original_price, stock, category, image_url },
                { headers: { 'X-Session-Token': sessionToken } }
            );
            alert('상품이 수정되었습니다.');
        } else {
            // Create
            await axios.post(`${API_BASE}/seller/products`, 
                { name, description, price, original_price, stock, category, image_url },
                { headers: { 'X-Session-Token': sessionToken } }
            );
            alert('상품이 등록되었습니다.');
        }

        closeModal();
        loadProducts();
        loadStats();
    } catch (error) {
        console.error('Failed to save product:', error);
        alert(error.response?.data?.error || '저장에 실패했습니다.');
    }
});

// Initialize
(async () => {
    const authenticated = await checkAuth();
    if (authenticated) {
        loadStats();
        loadProducts();
        loadLiveStreams();
        // Start polling live streams every 5 seconds
        liveStreamPollingInterval = setInterval(loadLiveStreams, 5000);
    }
})();

// ===============================
// Live Stream Management Functions
// ===============================

// Load live streams
async function loadLiveStreams() {
    try {
        const response = await axios.get(`${API_BASE}/streams`);
        
        if (response.data.success) {
            currentLiveStreams = response.data.data;
            renderLiveStreams(currentLiveStreams);
        }
    } catch (error) {
        console.error('Failed to load live streams:', error);
        document.getElementById('liveStreamsList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
                <p style="margin-top: 16px;">라이브 방송을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

// Render live streams
function renderLiveStreams(streams) {
    const container = document.getElementById('liveStreamsList');
    const liveStreams = streams.filter(s => s.status === 'live');
    
    // Update LIVE badge
    const liveBadge = document.getElementById('liveStatusBadge');
    if (liveStreams.length > 0) {
        liveBadge.style.display = 'inline-block';
    } else {
        liveBadge.style.display = 'none';
    }
    
    if (liveStreams.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--ur-gray-600);">
                <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px;">현재 진행 중인 라이브 방송이 없습니다.</p>
                <p style="font-size: 14px; margin-top: 8px; color: var(--ur-gray-600);">관리자 대시보드에서 라이브 방송을 시작하세요.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = liveStreams.map(stream => `
        <div class="live-stream-card">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                <div>
                    <h3 style="font-size: 18px; font-weight: 700; color: var(--ur-gray-900); margin: 0 0 8px 0;">
                        <i class="fas fa-broadcast-tower" style="color: #ef4444;"></i>
                        ${stream.title}
                    </h3>
                    <p style="font-size: 14px; color: var(--ur-gray-600); margin: 0;">
                        ${stream.description || '설명 없음'}
                    </p>
                </div>
                <a href="/live/${stream.id}" target="_blank" class="btn btn-secondary" style="white-space: nowrap;">
                    <i class="fas fa-external-link-alt"></i> 라이브 보기
                </a>
            </div>
            
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 12px; background: white; border-radius: 8px;">
                <div style="flex: 1;">
                    <div style="font-size: 13px; color: var(--ur-gray-600); margin-bottom: 4px;">현재 소개 중인 상품</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--ur-gray-900);" id="current-product-${stream.id}">
                        ${stream.product_name || '선택된 상품 없음'}
                    </div>
                    ${stream.price ? `
                        <div style="font-size: 14px; color: var(--seller-pink); font-weight: 600; margin-top: 4px;">
                            ${formatPrice(stream.price)}원
                        </div>
                    ` : ''}
                </div>
                <div style="font-size: 24px; color: var(--ur-gray-600);">
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
            
            <div class="product-selector" id="product-selector-${stream.id}">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <h4 style="font-size: 14px; font-weight: 600; color: var(--ur-gray-900); margin: 0;">
                        상품 선택 (클릭하여 변경)
                    </h4>
                    <span style="font-size: 12px; color: var(--ur-gray-600);">
                        <i class="fas fa-info-circle"></i> 현재 상품은 강조 표시됩니다
                    </span>
                </div>
                <div class="product-grid" id="products-grid-${stream.id}">
                    <div style="text-align: center; padding: 20px; color: var(--ur-gray-600); grid-column: 1 / -1;">
                        <i class="fas fa-spinner fa-spin"></i> 상품 불러오는 중...
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Load products for each live stream
    liveStreams.forEach(stream => {
        loadProductsForStream(stream.id, stream.current_product_id);
    });
}

// Load products for a specific stream
async function loadProductsForStream(streamId, currentProductId) {
    try {
        const response = await axios.get(`${API_BASE}/seller/products`, {
            headers: { 'X-Session-Token': sessionToken }
        });
        
        if (response.data.success) {
            const products = response.data.data.filter(p => p.is_active);
            renderProductsForStream(streamId, products, currentProductId);
        }
    } catch (error) {
        console.error('Failed to load products for stream:', error);
        document.getElementById(`products-grid-${streamId}`).innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ef4444; grid-column: 1 / -1;">
                상품을 불러올 수 없습니다.
            </div>
        `;
    }
}

// Render products for stream
function renderProductsForStream(streamId, products, currentProductId) {
    const container = document.getElementById(`products-grid-${streamId}`);
    
    if (products.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--ur-gray-600); grid-column: 1 / -1;">
                <i class="fas fa-box-open" style="font-size: 24px; margin-bottom: 8px;"></i>
                <p>판매 가능한 상품이 없습니다.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-item ${product.id === currentProductId ? 'current' : ''}" 
             onclick="changeProduct(${streamId}, ${product.id})">
            <img src="${product.image_url || 'https://picsum.photos/200/200?random=' + product.id}" 
                 alt="${product.name}"
                 onerror="this.src='https://picsum.photos/200/200?random=${product.id}'">
            <div class="name">${product.name}</div>
            <div class="price">${formatPrice(product.price)}원</div>
            ${product.id === currentProductId ? `
                <div style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-top: 4px;">
                    <i class="fas fa-check-circle"></i> 현재 소개 중
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Change product for stream
async function changeProduct(streamId, productId) {
    if (!confirm('이 상품으로 변경하시겠습니까?\n\n라이브 방송에서 즉시 반영됩니다.')) return;
    
    try {
        const response = await axios.post(`${API_BASE}/admin/streams/${streamId}/change-product`, 
            { product_id: productId },
            { headers: { 'X-Session-Token': sessionToken } }
        );
        
        if (response.data.success) {
            alert('상품이 변경되었습니다! 🎉');
            // Reload live streams to reflect changes
            loadLiveStreams();
        } else {
            throw new Error(response.data.error || '상품 변경 실패');
        }
    } catch (error) {
        console.error('Failed to change product:', error);
        alert('상품 변경에 실패했습니다: ' + (error.response?.data?.error || error.message));
    }
}

// Refresh live streams manually
function refreshLiveStreams() {
    loadLiveStreams();
}
