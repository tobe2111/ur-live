// Admin Dashboard JavaScript
const API_BASE = '/api';
let sessionToken = localStorage.getItem('sessionToken');
let currentStreams = [];
let currentSellers = [];

// Check authentication
async function checkAuth() {
    if (!sessionToken) {
        window.location.href = '/admin/login';
        return false;
    }

    try {
        const response = await axios.get(`${API_BASE}/auth/verify`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success && response.data.data.user.type === 'admin') {
            document.getElementById('adminName').textContent = response.data.data.user.name;
            return true;
        } else {
            localStorage.removeItem('sessionToken');
            window.location.href = '/admin/login';
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('sessionToken');
        window.location.href = '/admin/login';
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
        window.location.href = '/admin/login';
    });
}

// Load dashboard stats
async function loadStats() {
    try {
        const response = await axios.get(`${API_BASE}/admin/stats`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success) {
            const stats = response.data.data;
            document.getElementById('statLiveStreams').textContent = stats.liveStreams;
            document.getElementById('statProducts').textContent = stats.products;
            document.getElementById('statSellers').textContent = stats.sellers;
            document.getElementById('statRevenue').textContent = formatPrice(stats.totalRevenue) + '원';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load streams
async function loadStreams() {
    try {
        const response = await axios.get(`${API_BASE}/admin/streams`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success) {
            currentStreams = response.data.data;
            renderStreams(currentStreams);
        }
    } catch (error) {
        console.error('Failed to load streams:', error);
        document.getElementById('streamsList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
                <p style="margin-top: 16px;">라이브 스트림을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

// Render streams
function renderStreams(streams) {
    const container = document.getElementById('streamsList');

    if (streams.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
                <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px;">등록된 라이브 스트림이 없습니다.</p>
                <p style="font-size: 14px; margin-top: 8px;">새 라이브 생성 버튼을 클릭하여 시작하세요.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = streams.map(stream => `
        <div class="stream-card">
            <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <h3 style="font-size: 16px; font-weight: 600; color: var(--toss-gray-900); margin: 0;">
                            ${stream.title}
                        </h3>
                        <span class="status-badge status-${stream.status}">
                            ${getStatusText(stream.status)}
                        </span>
                    </div>
                    
                    <p style="font-size: 14px; color: var(--toss-gray-600); margin-bottom: 12px;">
                        ${stream.description || '설명 없음'}
                    </p>
                    
                    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--toss-gray-600); margin-bottom: 12px;">
                        <span>
                            <i class="fab fa-youtube"></i> ${stream.youtube_video_id}
                        </span>
                        <span>
                            <i class="fas fa-calendar"></i> ${formatDate(stream.created_at)}
                        </span>
                    </div>
                    
                    ${stream.current_product_id ? `
                        <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; font-size: 13px;">
                            <div style="color: #0369a1; font-weight: 600; margin-bottom: 4px;">
                                <i class="fas fa-shopping-bag"></i> 현재 노출 상품
                            </div>
                            <div style="color: var(--toss-gray-700);">
                                ID: ${stream.current_product_id}
                            </div>
                        </div>
                    ` : `
                        <div style="background: #fef3c7; border-radius: 8px; padding: 12px; font-size: 13px; color: #92400e;">
                            <i class="fas fa-exclamation-triangle"></i> 노출 상품이 설정되지 않았습니다
                        </div>
                    `}
                </div>
                
                <div style="display: flex; gap: 8px;">
                    ${stream.status === 'live' ? `
                        <button onclick="changeCurrentProduct(${stream.id})" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; font-size: 13px; background: #10b981;">
                            <i class="fas fa-shopping-bag"></i> 상품 변경
                        </button>
                    ` : ''}
                    <button onclick="changeStatus(${stream.id}, '${stream.status}')" 
                            class="btn btn-secondary" 
                            style="padding: 8px 16px; font-size: 13px;">
                        <i class="fas fa-sync-alt"></i> 상태 변경
                    </button>
                    <button onclick="editStream(${stream.id})" 
                            class="btn btn-primary" 
                            style="padding: 8px 16px; font-size: 13px;">
                        <i class="fas fa-edit"></i> 수정
                    </button>
                    <button onclick="deleteStream(${stream.id})" 
                            class="btn btn-danger" 
                            style="padding: 8px 16px; font-size: 13px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        'scheduled': '예정',
        'live': '진행중',
        'ended': '종료'
    };
    return statusMap[status] || status;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('ko-KR').format(price);
}

// Open create modal
function openCreateModal() {
    document.getElementById('modalTitle').textContent = '새 라이브 생성';
    document.getElementById('streamForm').reset();
    document.getElementById('streamId').value = '';
    document.getElementById('streamModal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('streamModal').classList.remove('show');
}

// Edit stream
function editStream(id) {
    const stream = currentStreams.find(s => s.id === id);
    if (!stream) return;

    document.getElementById('modalTitle').textContent = '라이브 수정';
    document.getElementById('streamId').value = stream.id;
    document.getElementById('streamTitle').value = stream.title;
    document.getElementById('streamDescription').value = stream.description || '';
    document.getElementById('youtubeVideoId').value = stream.youtube_video_id;
    document.getElementById('streamModal').classList.add('show');
}

// Change status
async function changeStatus(id, currentStatus) {
    const statusOptions = ['scheduled', 'live', 'ended'];
    const statusLabels = ['예정', '진행중', '종료'];
    
    const currentIndex = statusOptions.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusOptions.length;
    const nextStatus = statusOptions[nextIndex];
    const nextLabel = statusLabels[nextIndex];
    
    if (!confirm(`상태를 "${nextLabel}"(으)로 변경하시겠습니까?`)) return;

    try {
        await axios.put(`${API_BASE}/admin/streams/${id}`, 
            { status: nextStatus },
            { headers: { 'X-Session-Token': sessionToken } }
        );

        alert('상태가 변경되었습니다.');
        loadStreams();
    } catch (error) {
        console.error('Failed to change status:', error);
        alert('상태 변경에 실패했습니다.');
    }
}

// Delete stream
async function deleteStream(id) {
    if (!confirm('정말 이 라이브 스트림을 삭제하시겠습니까?')) return;

    try {
        await axios.delete(`${API_BASE}/admin/streams/${id}`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        alert('라이브 스트림이 삭제되었습니다.');
        loadStreams();
        loadStats();
    } catch (error) {
        console.error('Failed to delete stream:', error);
        alert('삭제에 실패했습니다.');
    }
}

// Handle stream form submit
document.getElementById('streamForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('streamId').value;
    const title = document.getElementById('streamTitle').value;
    const description = document.getElementById('streamDescription').value;
    const youtube_video_id = document.getElementById('youtubeVideoId').value;

    try {
        if (id) {
            // Update
            await axios.put(`${API_BASE}/admin/streams/${id}`, 
                { title, description, youtube_video_id },
                { headers: { 'X-Session-Token': sessionToken } }
            );
            alert('라이브 스트림이 수정되었습니다.');
        } else {
            // Create
            await axios.post(`${API_BASE}/admin/streams`, 
                { title, description, youtube_video_id },
                { headers: { 'X-Session-Token': sessionToken } }
            );
            alert('라이브 스트림이 생성되었습니다.');
        }

        closeModal();
        loadStreams();
        loadStats();
    } catch (error) {
        console.error('Failed to save stream:', error);
        alert(error.response?.data?.error || '저장에 실패했습니다.');
    }
});

// Change current product in live stream
async function changeCurrentProduct(streamId) {
    try {
        // Get all active products
        const response = await axios.get(`${API_BASE}/streams/${streamId}/products`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (!response.data.success) {
            alert('상품 목록을 불러올 수 없습니다.');
            return;
        }

        const products = response.data.data;
        if (products.length === 0) {
            alert('등록된 상품이 없습니다.');
            return;
        }

        // Create product selection dialog
        const productOptions = products.map(p => 
            `<option value="${p.id}">${p.name} - ${formatPrice(p.price)}원 (재고: ${p.stock})</option>`
        ).join('');

        const productId = prompt(
            '노출할 상품을 선택하세요:\n\n' + 
            products.map((p, i) => `${i + 1}. ${p.name} - ${formatPrice(p.price)}원`).join('\n') +
            '\n\n상품 ID를 입력하세요 (취소하려면 빈 값):'
        );

        if (productId === null) return; // 취소

        const selectedProduct = products.find(p => p.id === parseInt(productId));
        if (!productId) {
            // Clear current product
            if (confirm('현재 노출 상품을 제거하시겠습니까?')) {
                await updateCurrentProduct(streamId, null);
            }
        } else if (!selectedProduct) {
            alert('올바른 상품 ID를 입력해주세요.');
        } else {
            await updateCurrentProduct(streamId, productId);
        }
    } catch (error) {
        console.error('Failed to change product:', error);
        alert('상품 변경에 실패했습니다.');
    }
}

// Update current product API call
async function updateCurrentProduct(streamId, productId) {
    try {
        await axios.patch(`${API_BASE}/admin/streams/${streamId}/current-product`, 
            { product_id: productId ? parseInt(productId) : null },
            { headers: { 'X-Session-Token': sessionToken } }
        );

        alert(productId ? '노출 상품이 변경되었습니다!' : '노출 상품이 제거되었습니다.');
        loadStreams();
    } catch (error) {
        console.error('Failed to update current product:', error);
        alert(error.response?.data?.error || '상품 변경에 실패했습니다.');
    }
}

// ==========================================
// Seller Management Functions
// ==========================================

// Load sellers
async function loadSellers() {
    try {
        const response = await axios.get(`${API_BASE}/admin/sellers`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.data.success) {
            currentSellers = response.data.data;
            renderSellers(currentSellers);
        }
    } catch (error) {
        console.error('Failed to load sellers:', error);
        document.getElementById('sellersList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
                <p style="margin-top: 16px;">판매자를 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

// Render sellers
function renderSellers(sellers) {
    const container = document.getElementById('sellersList');

    if (sellers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
                <i class="fas fa-store-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px;">등록된 판매자가 없습니다.</p>
                <p style="font-size: 14px; margin-top: 8px;">새 판매자 등록 버튼을 클릭하여 시작하세요.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sellers.map(seller => `
        <div class="stream-card">
            <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <h3 style="font-size: 16px; font-weight: 600; color: var(--toss-gray-900); margin: 0;">
                            ${seller.business_name}
                        </h3>
                        <span class="status-badge status-${seller.status}">
                            ${getSellerStatusText(seller.status)}
                        </span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--toss-gray-600); margin-bottom: 8px;">
                        <span><i class="fas fa-user"></i> ${seller.name} (${seller.username})</span>
                        ${seller.email ? `<span><i class="fas fa-envelope"></i> ${seller.email}</span>` : ''}
                        ${seller.phone ? `<span><i class="fas fa-phone"></i> ${seller.phone}</span>` : ''}
                    </div>
                    
                    <div style="font-size: 13px; color: var(--toss-gray-600);">
                        ${seller.business_number ? `<span><i class="fas fa-building"></i> 사업자번호: ${seller.business_number}</span>` : ''}
                        <span style="margin-left: 16px;"><i class="fas fa-calendar"></i> 가입: ${formatDate(seller.created_at)}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    ${seller.status !== 'suspended' ? `
                        <button onclick="changeSellerStatus(${seller.id}, 'suspended')" 
                                class="btn btn-secondary" 
                                style="padding: 8px 16px; font-size: 13px;">
                            <i class="fas fa-ban"></i> 정지
                        </button>
                    ` : `
                        <button onclick="changeSellerStatus(${seller.id}, 'approved')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; font-size: 13px;">
                            <i class="fas fa-check"></i> 승인
                        </button>
                    `}
                    <button onclick="deleteSeller(${seller.id})" 
                            class="btn btn-danger" 
                            style="padding: 8px 16px; font-size: 13px;">
                        <i class="fas fa-trash"></i> 삭제
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Get seller status text
function getSellerStatusText(status) {
    const statusMap = {
        'pending': '대기중',
        'approved': '승인',
        'rejected': '거절',
        'suspended': '정지'
    };
    return statusMap[status] || status;
}

// Open seller create modal
function openSellerCreateModal() {
    document.getElementById('sellerForm').reset();
    document.getElementById('sellerModal').classList.add('show');
}

// Close seller modal
function closeSellerModal() {
    document.getElementById('sellerModal').classList.remove('show');
}

// Change seller status
async function changeSellerStatus(id, newStatus) {
    const statusText = getSellerStatusText(newStatus);
    
    if (!confirm(`판매자 상태를 "${statusText}"(으)로 변경하시겠습니까?`)) return;

    try {
        await axios.patch(`${API_BASE}/admin/sellers/${id}/status`, 
            { status: newStatus },
            { headers: { 'X-Session-Token': sessionToken } }
        );

        alert('판매자 상태가 변경되었습니다.');
        loadSellers();
        loadStats();
    } catch (error) {
        console.error('Failed to change seller status:', error);
        alert(error.response?.data?.error || '상태 변경에 실패했습니다.');
    }
}

// Delete seller
async function deleteSeller(id) {
    if (!confirm('정말 이 판매자를 삭제하시겠습니까?\n판매자의 상품이 있으면 삭제할 수 없습니다.')) return;

    try {
        await axios.delete(`${API_BASE}/admin/sellers/${id}`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        alert('판매자가 삭제되었습니다.');
        loadSellers();
        loadStats();
    } catch (error) {
        console.error('Failed to delete seller:', error);
        alert(error.response?.data?.error || '삭제에 실패했습니다.');
    }
}

// Handle seller form submit
document.getElementById('sellerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('sellerUsername').value;
    const password = document.getElementById('sellerPassword').value;
    const name = document.getElementById('sellerName').value;
    const business_name = document.getElementById('sellerBusinessName').value;
    const email = document.getElementById('sellerEmail').value;
    const phone = document.getElementById('sellerPhone').value;
    const business_number = document.getElementById('sellerBusinessNumber').value;

    try {
        await axios.post(`${API_BASE}/admin/sellers`, 
            { username, password, name, business_name, email, phone, business_number },
            { headers: { 'X-Session-Token': sessionToken } }
        );
        
        alert(`판매자가 등록되었습니다.\n\n로그인 정보:\n- 사용자명: ${username}\n- 비밀번호: ${password}\n\n판매자에게 로그인 정보를 전달해주세요.`);
        closeSellerModal();
        loadSellers();
        loadStats();
    } catch (error) {
        console.error('Failed to create seller:', error);
        alert(error.response?.data?.error || '판매자 등록에 실패했습니다.');
    }
});

// Initialize
(async () => {
    const authenticated = await checkAuth();
    if (authenticated) {
        loadStats();
        loadStreams();
        loadSellers();
    }
})();
