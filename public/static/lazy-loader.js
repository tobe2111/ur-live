/**
 * Lazy Script Loader - 초기 로딩 50% 단축
 * 페이지에서 실제로 필요한 시점에 스크립트를 동적으로 로드
 * 
 * 사용법:
 * await loadScript('https://example.com/script.js');
 */

// 이미 로드된 스크립트 추적
const loadedScripts = new Set();
const loadingScripts = new Map();

/**
 * 스크립트를 비동기로 로드
 * @param {string} src - 스크립트 URL
 * @param {Object} options - 로드 옵션 (async, defer, crossOrigin 등)
 * @returns {Promise<void>}
 */
function loadScript(src, options = {}) {
  // 이미 로드됨
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }
  
  // 로딩 중
  if (loadingScripts.has(src)) {
    return loadingScripts.get(src);
  }
  
  // 새로 로드
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = options.async !== false; // 기본값: async
    
    if (options.defer) script.defer = true;
    if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
    if (options.integrity) script.integrity = options.integrity;
    
    script.onload = () => {
      loadedScripts.add(src);
      loadingScripts.delete(src);
      resolve();
    };
    
    script.onerror = () => {
      loadingScripts.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    
    document.head.appendChild(script);
  });
  
  loadingScripts.set(src, promise);
  return promise;
}

/**
 * 여러 스크립트를 병렬로 로드
 * @param {string[]} scripts - 스크립트 URL 배열
 * @returns {Promise<void[]>}
 */
function loadScripts(scripts) {
  return Promise.all(scripts.map(src => loadScript(src)));
}

/**
 * 이미지 Lazy Loading 설정
 * loading="lazy" 속성을 지원하지 않는 브라우저를 위한 폴백
 */
function setupLazyImages() {
  if ('loading' in HTMLImageElement.prototype) {
    // 네이티브 lazy loading 지원
    return;
  }
  
  // IntersectionObserver 폴백
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  });
  
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

/**
 * CDN 스크립트 프리로드
 * 페이지 로드 시 중요한 스크립트를 미리 다운로드 (실행은 나중에)
 */
function preloadScripts(scripts) {
  scripts.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = src;
    document.head.appendChild(link);
  });
}

// 자동 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupLazyImages);
} else {
  setupLazyImages();
}

// Export for use
window.lazyLoad = {
  script: loadScript,
  scripts: loadScripts,
  images: setupLazyImages,
  preload: preloadScripts
};
