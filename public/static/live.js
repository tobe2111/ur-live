// 라이브 스트림 뷰어 JavaScript (ClickMate 스타일)
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // 앱 상태
  const state = {
    streamId: STREAM_ID,
    currentProductId: null,
    currentProduct: null,
    userId: 'toss_user_001', // 실제로는 토스 로그인에서 받아옴
    player: null,
    pollingInterval: null,
    initAttempts: 0,
  };

  let appInitialized = false;
  let currentUsername = '게스트'; // 초기값 설정
  let chatUnsubscribe = null; // 초기값 설정

  // YouTube Player API 로드 완료 시 호출
  window.onYouTubeIframeAPIReady = function() {
    console.log('✅ YouTube IFrame API Ready');
    if (!appInitialized) {
      initApp();
    }
  };

  // DOM 로드 완료 후 초기화 시도
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    tryInitialize();
  });

  // 페이지 로드 완료 후에도 시도
  window.addEventListener('load', function() {
    console.log('Window Load Complete');
    tryInitialize();
  });

  // YouTube API 로딩 대기 및 재시도
  function tryInitialize() {
    if (appInitialized) {
      console.log('App already initialized');
      return;
    }

    if (window.YT && window.YT.Player) {
      console.log('✅ YouTube API available, initializing...');
      initApp();
    } else {
      state.initAttempts++;
      console.log(`⏳ YouTube API not ready yet (attempt ${state.initAttempts}), retrying...`);
      
      if (state.initAttempts < 20) {
        setTimeout(tryInitialize, 500);
      } else {
        console.error('❌ YouTube API failed to load after 10 seconds');
        showError('YouTube API를 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      }
    }
  }

  async function initApp() {
    if (appInitialized) {
      console.log('⚠️ App already initialized, skipping...');
      return;
    }
    
    appInitialized = true;
    console.log('🚀 Initializing app...');
    
    try {
      // 라이브 스트림 정보 로드
      await loadStreamInfo();
      
      // 폴링 시작 (3초마다 상품 확인)
      startPolling();
      
      // UI 이벤트 바인딩
      setupUIEvents();
      
      // Firebase 채팅 초기화
      initializeChat();
      
      // 페이지 가시성 변경 감지
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.player && typeof state.player.playVideo === 'function') {
          console.log('Page visible again, resuming video...');
          try {
            state.player.playVideo();
          } catch (e) {
            console.warn('Failed to resume video:', e);
          }
        }
      });
      
      console.log('✅ App initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      appInitialized = false;
      showError('앱을 시작할 수 없습니다.');
    }
  }

  async function loadStreamInfo() {
    try {
      console.log('Loading stream info...');
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}`);
      if (response.data.success) {
        const stream = response.data.data;
        console.log('Stream data:', stream);
        
        // 라이브 타이틀 업데이트
        const titleEl = document.getElementById('stream-title');
        if (titleEl) {
          titleEl.textContent = stream.title;
        }
        
        // YouTube Player 초기화
        console.log('Creating YouTube Player with video ID:', stream.youtube_video_id);
        
        const playerContainer = document.getElementById('youtube-player');
        if (!playerContainer) {
          console.error('YouTube player container not found!');
          throw new Error('Player container not found');
        }
        
        // 기존 플레이어 파괴
        if (state.player && typeof state.player.destroy === 'function') {
          console.log('Destroying existing player...');
          try {
            state.player.destroy();
          } catch (e) {
            console.warn('Failed to destroy player:', e);
          }
          state.player = null;
        }
        
        // 컨테이너 초기화
        playerContainer.innerHTML = '<div id="youtube-player-inner"></div>';
        
        // 새 플레이어 생성
        state.player = new YT.Player('youtube-player-inner', {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
          }
        });

        console.log('YouTube Player created');

        // 현재 상품 로드
        if (stream.current_product_id) {
          state.currentProductId = stream.current_product_id;
          await loadCurrentProduct();
        } else {
          console.warn('No current product');
        }
      }
    } catch (error) {
      console.error('Failed to load stream info:', error);
      throw error;
    }
  }

  function onPlayerReady(event) {
    console.log('✅ YouTube Player Ready');
    
    // 자동 재생 시도 (음소거 상태로 시작)
    event.target.playVideo();
    
    // 음소거 해제 버튼 표시
    const unmuteButton = document.getElementById('unmute-button');
    if (unmuteButton) {
      unmuteButton.classList.remove('hidden');
    }
    
    // 1초 후 자동 음소거 해제 시도
    setTimeout(() => {
      try {
        if (state.player && typeof state.player.isMuted === 'function') {
          const isMuted = state.player.isMuted();
          if (isMuted) {
            // 음소거 해제 시도
            state.player.unMute();
            
            // 음소거 해제 후 일시정지되었다면 다시 재생
            setTimeout(() => {
              const newState = state.player.getPlayerState();
              if (newState === 2) {
                console.log('⚠️ Unmute caused pause, keeping video muted and playing');
                state.player.mute();
                state.player.playVideo();
                updateMuteButton(true);
              } else {
                console.log('✅ Unmuted successfully');
                updateMuteButton(false);
              }
            }, 100);
          }
        }
      } catch (e) {
        console.log('⚠️ Could not unmute automatically');
        if (state.player) {
          state.player.playVideo();
        }
      }
    }, 1000);
  }

  function onPlayerStateChange(event) {
    const states = {
      '-1': 'unstarted',
      '0': 'ended',
      '1': 'playing',
      '2': 'paused',
      '3': 'buffering',
      '5': 'video cued'
    };
    console.log('Player State:', event.data, '(' + (states[event.data] || 'unknown') + ')');
    
    if (event.data === 1) {
      console.log('✅ Video is playing');
    }
  }

  function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    const errorMessages = {
      2: '잘못된 비디오 ID입니다',
      5: 'HTML5 플레이어 오류입니다',
      100: '비디오를 찾을 수 없습니다',
      101: '비디오 소유자가 임베드를 허용하지 않습니다',
      150: '비디오 소유자가 임베드를 허용하지 않습니다'
    };
    console.log('YouTube Player Error:', event.data, errorMessages[event.data] || '재생 오류');
  }

  function startPolling() {
    state.pollingInterval = setInterval(async () => {
      await checkCurrentProduct();
    }, 3000);
  }

  async function checkCurrentProduct() {
    try {
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}/current-product`);
      if (response.data.success && response.data.data) {
        const newProduct = response.data.data.product;
        
        if (newProduct && newProduct.id !== state.currentProductId) {
          state.currentProductId = newProduct.id;
          state.currentProduct = response.data.data;
          console.log('✨ New product:', newProduct.name);
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
      }
    } catch (error) {
      console.error('Failed to load current product:', error);
    }
  }

  function setupUIEvents() {
    // 구매하기 버튼 → 상품 리스트 모달 열기
    document.getElementById('buy-button').addEventListener('click', () => {
      openProductListModal();
    });
    
    // 내 주문 버튼
    document.getElementById('my-orders-button').addEventListener('click', () => {
      window.location.href = '/cart';
    });

    // 상품 리스트 모달 닫기
    document.getElementById('close-product-list').addEventListener('click', () => {
      closeProductListModal();
    });

    document.getElementById('product-list-modal').addEventListener('click', (e) => {
      if (e.target.id === 'product-list-modal') {
        closeProductListModal();
      }
    });

    // 상품 상세 모달 닫기
    document.getElementById('close-product-detail').addEventListener('click', () => {
      closeProductDetailModal();
    });

    document.getElementById('back-to-list').addEventListener('click', () => {
      closeProductDetailModal();
      openProductListModal();
    });

    document.getElementById('product-detail-modal').addEventListener('click', (e) => {
      if (e.target.id === 'product-detail-modal') {
        closeProductDetailModal();
      }
    });
  }

  // 상품 리스트 모달 열기
  async function openProductListModal() {
    try {
      console.log('📦 상품 리스트 로딩...');
      
      // 현재 스트림의 상품 목록 가져오기
      const response = await axios.get(`${API_BASE}/streams/${state.streamId}/products`);
      
      if (response.data.success) {
        const products = response.data.data;
        console.log('📦 상품 목록:', products);
        
        // 상품 개수 업데이트
        document.getElementById('product-count').textContent = products.length;
        
        // 상품 리스트 렌더링
        const productListEl = document.getElementById('product-list');
        productListEl.innerHTML = '';
        
        if (products.length === 0) {
          productListEl.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon"><i class="fas fa-box-open"></i></div>
              <div class="empty-text">판매 중인 상품이 없습니다</div>
            </div>
          `;
        } else {
          products.forEach(product => {
            const discountPercent = Math.round(((product.original_price - product.price) / product.original_price) * 100);
            
            const productItem = document.createElement('div');
            productItem.className = 'product-item';
            productItem.innerHTML = `
              <img src="${product.image_url || 'https://picsum.photos/80/80?random=' + product.id}" 
                   alt="${product.name}" 
                   class="product-image"
                   onerror="this.src='https://picsum.photos/80/80?random=${product.id}'">
              <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price-row">
                  ${discountPercent > 0 ? `<span class="product-discount">${discountPercent}%</span>` : ''}
                  <span class="product-price">${formatPrice(product.price)}원</span>
                  ${product.original_price > product.price ? `<span class="product-original-price">${formatPrice(product.original_price)}원</span>` : ''}
                </div>
              </div>
              <div class="product-action">
                <button class="product-buy-btn" onclick="openProductDetailModal(${product.id})">구매</button>
              </div>
            `;
            
            productListEl.appendChild(productItem);
          });
        }
        
        // 모달 표시
        document.getElementById('product-list-modal').style.display = 'flex';
      }
    } catch (error) {
      console.error('❌ 상품 목록 로딩 실패:', error);
      alert('상품 목록을 불러올 수 없습니다');
    }
  }

  // 상품 리스트 모달 닫기
  function closeProductListModal() {
    document.getElementById('product-list-modal').style.display = 'none';
  }

  // 상품 상세 모달 열기
  window.openProductDetailModal = async function(productId) {
    try {
      console.log('📦 상품 상세 로딩...', productId);
      
      closeProductListModal();
      
      // 상품 상세 정보 가져오기
      const response = await axios.get(`${API_BASE}/products/${productId}`);
      
      if (response.data.success) {
        const product = response.data.data;
        const options = product.options || [];
        
        console.log('📦 상품 상세:', product);
        console.log('📦 상품 옵션:', options);
        
        const discountPercent = Math.round(((product.original_price - product.price) / product.original_price) * 100);
        
        // 상품 상세 렌더링
        const detailContent = document.getElementById('product-detail-content');
        detailContent.innerHTML = `
          <div class="product-detail">
            <img src="${product.image_url || 'https://picsum.photos/400/400?random=' + product.id}" 
                 alt="${product.name}" 
                 class="product-detail-image"
                 onerror="this.src='https://picsum.photos/400/400?random=${product.id}'">
            
            <div class="product-detail-name">${product.name}</div>
            
            <div class="product-detail-price-row">
              ${discountPercent > 0 ? `<span class="product-detail-discount">${discountPercent}%</span>` : ''}
              <span class="product-detail-price">${formatPrice(product.price)}원</span>
              ${product.original_price > product.price ? `<span class="product-detail-original-price">${formatPrice(product.original_price)}원</span>` : ''}
            </div>
            
            ${product.description ? `<p style="color: #8B95A1; font-size: 14px; line-height: 1.6; margin-top: 12px;">${product.description}</p>` : ''}
            
            <div class="product-detail-divider"></div>
            
            <div class="product-quantity-section">
              <label class="product-quantity-label">수량</label>
              <div class="product-quantity-controls">
                <button class="quantity-btn" id="decrease-quantity">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="quantity-value" id="quantity-value">1</span>
                <button class="quantity-btn" id="increase-quantity">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
            
            ${options.length > 0 ? `
              <div class="product-options-section">
                <label class="product-option-label">옵션 선택</label>
                <div class="product-option-list" id="option-list">
                  ${options.map(opt => `
                    <button class="product-option-item" data-option-id="${opt.id}" data-option-name="${opt.option_name}: ${opt.option_value}">
                      ${opt.option_name}: ${opt.option_value}
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="product-detail-footer">
            <div class="product-detail-total">
              <div class="product-detail-total-label">총 금액</div>
              <div class="product-detail-total-price" id="total-price">${formatPrice(product.price)}원</div>
            </div>
            <button class="product-cart-btn" id="add-to-cart-btn">장바구니</button>
            <button class="product-checkout-btn" id="buy-now-btn">바로구매</button>
          </div>
        `;
        
        // 모달 표시
        document.getElementById('product-detail-modal').style.display = 'flex';
        
        // 이벤트 핸들러 설정
        setupProductDetailEvents(product, options);
      }
    } catch (error) {
      console.error('❌ 상품 상세 로딩 실패:', error);
      alert('상품 정보를 불러올 수 없습니다');
    }
  };

  // 상품 상세 모달 닫기
  function closeProductDetailModal() {
    document.getElementById('product-detail-modal').style.display = 'none';
  }

  // 상품 상세 이벤트 설정
  function setupProductDetailEvents(product, options) {
    let quantity = 1;
    let selectedOptionId = null;
    
    // 수량 조절
    document.getElementById('decrease-quantity').addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        document.getElementById('quantity-value').textContent = quantity;
        updateTotalPrice();
      }
    });
    
    document.getElementById('increase-quantity').addEventListener('click', () => {
      quantity++;
      document.getElementById('quantity-value').textContent = quantity;
      updateTotalPrice();
    });
    
    // 옵션 선택
    if (options.length > 0) {
      document.querySelectorAll('.product-option-item').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.product-option-item').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedOptionId = btn.dataset.optionId;
        });
      });
    }
    
    function updateTotalPrice() {
      const totalPrice = product.price * quantity;
      document.getElementById('total-price').textContent = formatPrice(totalPrice) + '원';
    }
    
    // 장바구니 담기
    document.getElementById('add-to-cart-btn').addEventListener('click', async () => {
      if (options.length > 0 && !selectedOptionId) {
        alert('옵션을 선택해주세요');
        return;
      }
      
      await addToCart(product, selectedOptionId, quantity, false);
    });
    
    // 바로구매
    document.getElementById('buy-now-btn').addEventListener('click', async () => {
      if (options.length > 0 && !selectedOptionId) {
        alert('옵션을 선택해주세요');
        return;
      }
      
      await addToCart(product, selectedOptionId, quantity, true);
    });
  }

  // 장바구니 추가
  async function addToCart(product, optionId, quantity, isBuyNow) {
    const requestData = {
      userId: state.userId,
      productId: product.id,
      optionId: optionId ? parseInt(optionId) : null,
      quantity: quantity,
      priceSnapshot: product.price,
      liveStreamId: state.streamId,
    };
    
    console.log('🛒 장바구니 추가:', requestData);
    
    try {
      const response = await axios.post(`${API_BASE}/cart`, requestData);
      
      if (response.data.success) {
        // 구매 메시지 전송
        sendPurchaseMessage(product.name);
        
        closeProductDetailModal();
        
        if (isBuyNow) {
          alert(`${product.name}\n장바구니에 담았습니다! 🛒\n주문 페이지로 이동합니다.`);
          window.location.href = '/cart';
        } else {
          alert(`${product.name}\n장바구니에 담았습니다! 🛒`);
        }
        
        console.log('✅ 장바구니 추가 성공');
      } else {
        throw new Error(response.data.error || '장바구니 추가 실패');
      }
    } catch (error) {
      console.error('❌ 장바구니 추가 실패:', error);
      
      // "User not found" 에러 시 게스트 유저 자동 생성
      if (error.response?.data?.error === 'User not found') {
        console.log('👤 게스트 유저 생성 중...');
        const created = await createGuestUser();
        if (created) {
          // 재시도
          await addToCart(product, optionId, quantity, isBuyNow);
        }
      } else {
        alert('장바구니에 담을 수 없습니다\n' + (error.response?.data?.error || error.message));
      }
    }
  }

  // 게스트 유저 자동 생성
  async function createGuestUser() {
    try {
      const guestData = {
        tossUserId: state.userId,
        name: currentUsername,
        email: `${state.userId}@guest.com`,
        phone: ''
      };
      
      console.log('👤 게스트 유저 생성 데이터:', guestData);
      
      const response = await axios.post(`${API_BASE}/users`, guestData);
      
      if (response.data.success) {
        console.log('✅ 게스트 유저 생성 완료:', response.data.data);
        return true;
      }
    } catch (error) {
      console.error('❌ 게스트 유저 생성 실패:', error);
      alert('사용자 등록에 실패했습니다');
      return false;
    }
  }

  // 가격 포맷 (천 단위 콤마)
  function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 음소거 토글
  window.quickBuy = quickBuy;

  function showError(message) {
    alert(message);
  }

  // 음소거 토글 함수
  window.toggleMute = function() {
    if (!state.player || typeof state.player.isMuted !== 'function') {
      console.warn('Player not ready');
      return;
    }

    try {
      const isMuted = state.player.isMuted();
      if (isMuted) {
        state.player.unMute();
        updateMuteButton(false);
        console.log('✅ Unmuted');
      } else {
        state.player.mute();
        updateMuteButton(true);
        console.log('🔇 Muted');
      }
    } catch (e) {
      console.error('Failed to toggle mute:', e);
    }
  };

  function updateMuteButton(isMuted) {
    const icon = document.getElementById('mute-icon');
    const button = document.getElementById('unmute-button');
    
    if (!icon || !button) return;
    
    if (isMuted) {
      icon.className = 'fas fa-volume-mute text-lg';
      button.classList.remove('hidden');
      button.title = '음소거 해제';
    } else {
      icon.className = 'fas fa-volume-up text-lg';
      button.title = '음소거';
      setTimeout(() => {
        button.classList.add('hidden');
      }, 3000);
    }
  }

  // ===================================
  // 실시간 채팅 기능 (Firebase RTDB)
  // ===================================

  // Firebase 초기화 및 채팅 시작
  function initializeChat() {
    console.log('🔥 Firebase 채팅 초기화 시작...');
    
    // Firebase 초기화
    if (window.FirebaseChat && window.FirebaseChat.initialize()) {
      console.log('✅ Firebase 초기화 완료');
      
      // 토스 브릿지에서 유저 정보 가져오기 (향후 구현)
      getTossUserInfo().then(userInfo => {
        currentUsername = userInfo.name || '토스 사용자';
        console.log(`👤 유저 이름: ${currentUsername}`);
      });
      
      // 메시지 수신 시작
      chatUnsubscribe = window.FirebaseChat.listenToMessages(
        state.streamId,
        (message) => {
          addChatMessage(message.username, message.text, false);
        }
      );
      
      // 채팅 입력 이벤트 바인딩
      bindChatEvents();
      
      // 오래된 메시지 정리 (1분마다 5개만 유지)
      setInterval(() => {
        window.FirebaseChat.cleanupOldMessages(state.streamId, 5);
      }, 1 * 60 * 1000); // 1분마다 실행
      
      console.log('✅ 채팅 기능 활성화');
    } else {
      console.warn('⚠️ Firebase 초기화 실패 - 채팅 비활성화');
    }
  }

  // 토스 브릿지에서 유저 정보 가져오기
  // 토스 브릿지에서 유저 정보 가져오기
  async function getTossUserInfo() {
    try {
      // 실제 토스 브릿지 API 호출
      const response = await axios.get(`${API_BASE}/toss/user-info`);
      
      if (response.data.success) {
        const userInfo = response.data.data;
        console.log('✅ 토스 유저 정보:', userInfo);
        
        // 유저 ID도 상태에 저장
        state.userId = userInfo.userId;
        
        return {
          name: userInfo.name,
          userId: userInfo.userId,
          isGuest: userInfo.isGuest || false
        };
      } else {
        throw new Error('유저 정보 가져오기 실패');
      }
    } catch (error) {
      console.error('⚠️ 토스 유저 정보 가져오기 실패:', error);
      
      // 실패 시 게스트로 처리
      return {
        name: '게스트',
        userId: 'guest_' + Date.now(),
        isGuest: true
      };
    }
  }

  // 채팅 이벤트 바인딩
  function bindChatEvents() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button');
    
    if (!chatInput || !sendButton) return;
    
    // 전송 버튼 클릭
    sendButton.addEventListener('click', () => {
      sendChatMessage();
    });
    
    // 엔터 키 입력
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }

  // 채팅 메시지 전송
  function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Firebase로 메시지 전송
    if (window.FirebaseChat) {
      window.FirebaseChat.sendMessage(
        state.streamId,
        currentUsername,
        message
      );
      
      // 입력창 초기화
      chatInput.value = '';
      
      console.log(`💬 메시지 전송: ${message}`);
    }
  }

  // 채팅 메시지 UI 추가
  function addChatMessage(username, text, isPurchase = false) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    // 메시지 버블 생성
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble${isPurchase ? ' purchase' : ''}`;
    
    // 유저명과 메시지
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = username;
    
    const textNode = document.createTextNode(': ' + text);
    
    bubble.appendChild(usernameSpan);
    bubble.appendChild(textNode);
    
    // 채팅창에 추가
    chatMessages.appendChild(bubble);
    
    // 자동 스크롤 (하단으로)
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // UI에서 메시지가 5개를 초과하면 오래된 메시지 제거
    const messages = chatMessages.querySelectorAll('.chat-bubble');
    if (messages.length > 5) {
      // 가장 오래된 메시지부터 제거
      for (let i = 0; i < messages.length - 5; i++) {
        messages[i].remove();
      }
    }
    
    // Firebase에서도 5개 초과 시 자동 정리
    if (messages.length >= 5 && window.FirebaseChat) {
      window.FirebaseChat.cleanupOldMessages(state.streamId, 5);
    }
  }

  // 구매 메시지 자동 전송
  function sendPurchaseMessage(productName) {
    if (window.FirebaseChat && currentUsername) {
      const message = `${productName} 구매 감사합니다♡`;
      window.FirebaseChat.sendMessage(
        state.streamId,
        currentUsername,
        message
      );
      console.log(`💬 구매 메시지 전송: ${message}`);
    }
  }

})();
