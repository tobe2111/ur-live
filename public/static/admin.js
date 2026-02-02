// Admin Dashboard JavaScript
const API_BASE = '/api';
let sessionToken = localStorage.getItem('sessionToken');
let currentStreams = [];

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
                    
                    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--toss-gray-600);">
                        <span>
                            <i class="fab fa-youtube"></i> ${stream.youtube_video_id}
                        </span>
                        <span>
                            <i class="fas fa-calendar"></i> ${formatDate(stream.created_at)}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px;">
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

// Initialize
(async () => {
    const authenticated = await checkAuth();
    if (authenticated) {
        loadStats();
        loadStreams();
    }
})();
