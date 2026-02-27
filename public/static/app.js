// 메인 앱 JavaScript
(function() {
  'use strict';

  // API 기본 설정
  const API_BASE = '/api';

  // 앱 상태
  const state = {
    currentUser: null,
    liveStreams: [],
    loading: false,
  };

  // 페이지 로드 시 초기화
  document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
  });

  async function initApp() {
    state.loading = true;
    showLoading();

    try {
      // 라이브 스트림 목록 로드
      await loadLiveStreams();
      renderStreams();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showError('앱을 시작할 수 없습니다.');
    } finally {
      state.loading = false;
    }
  }

  async function loadLiveStreams() {
    try {
      const response = await axios.get(`${API_BASE}/streams`);
      if (response.data.success) {
        state.liveStreams = response.data.data;
      }
    } catch (error) {
      console.error('Failed to load streams:', error);
      throw error;
    }
  }

  function renderStreams() {
    const app = document.getElementById('app');
    
    if (state.liveStreams.length === 0) {
      app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center">
            <i class="fas fa-video-slash text-6xl text-gray-400 mb-4"></i>
            <p class="text-xl text-gray-600">현재 진행 중인 라이브가 없습니다</p>
          </div>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-8">
          <i class="fas fa-broadcast-tower mr-2 ur-text-primary"></i>
          리스터코퍼레이션 라이브 커머스
        </h1>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${state.liveStreams.map(stream => `
            <a href="/live/${stream.id}" class="block bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div class="relative">
                <img src="https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg" 
                     alt="${stream.title}" 
                     class="w-full h-48 object-cover">
                <div class="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center">
                  <i class="fas fa-circle mr-1 animate-pulse"></i>
                  LIVE
                </div>
              </div>
              <div class="p-4">
                <h2 class="text-xl font-bold text-gray-800 mb-2">${stream.title}</h2>
                <p class="text-gray-600 text-sm">${stream.description || '실시간 라이브 쇼핑'}</p>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  function showLoading() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl ur-text-primary mb-4"></i>
          <p class="text-gray-600">로드 중...</p>
        </div>
      </div>
    `;
  }

  function showError(message) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <p class="text-gray-600">${message}</p>
          <button onclick="location.reload()" class="mt-4 ur-primary text-white px-6 py-2 rounded-lg">
            다시 시도
          </button>
        </div>
      </div>
    `;
  }
})();
