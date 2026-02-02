// Seller Dashboard JavaScript
const API_BASE = '/api';
let sessionToken = localStorage.getItem('sessionToken');
let currentProducts = [];

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
            <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
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
                    <h3 style="font-size: 16px; font-weight: 600; color: var(--toss-gray-900); margin: 0;">
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
                
                <p style="font-size: 14px; color: var(--toss-gray-600); margin-bottom: 12px;">
                    ${product.description || '설명 없음'}
                </p>
                
                <div style="display: flex; gap: 24px; font-size: 14px; margin-bottom: 12px;">
                    <div>
                        <span style="color: var(--toss-gray-600);">판매가:</span>
                        <strong style="color: var(--seller-pink); font-size: 18px; font-weight: 700; margin-left: 8px;">
                            ${formatPrice(product.price)}원
                        </strong>
                        ${product.original_price ? `
                            <span style="text-decoration: line-through; color: var(--toss-gray-600); margin-left: 8px;">
                                ${formatPrice(product.original_price)}원
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div style="display: flex; gap: 16px; font-size: 13px; color: var(--toss-gray-600);">
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
    }
})();
