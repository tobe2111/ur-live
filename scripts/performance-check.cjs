#!/usr/bin/env node

/**
 * Performance Check Script
 * 
 * 모든 페이지의 번들 크기, 로딩 시간, 의존성을 분석합니다.
 */

const fs = require('fs');
const path = require('path');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getPerformanceRating(sizeKB) {
  if (sizeKB < 50) return { rating: 'Excellent', color: 'green', emoji: '🟢' };
  if (sizeKB < 100) return { rating: 'Good', color: 'cyan', emoji: '🔵' };
  if (sizeKB < 200) return { rating: 'Fair', color: 'yellow', emoji: '🟡' };
  if (sizeKB < 300) return { rating: 'Poor', color: 'yellow', emoji: '🟠' };
  return { rating: 'Critical', color: 'red', emoji: '🔴' };
}

function analyzeBundleSize() {
  console.log(colorize('\n📊 번들 크기 분석\n', 'bright'));
  console.log('='.repeat(80));

  const distPath = path.join(__dirname, '../dist/assets');
  
  if (!fs.existsSync(distPath)) {
    console.log(colorize('❌ dist/assets 폴더를 찾을 수 없습니다. 먼저 빌드를 실행하세요: npm run build', 'red'));
    return;
  }

  const files = fs.readdirSync(distPath);
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.endsWith('.map'));
  
  // 페이지별 분류
  const pageFiles = [];
  const componentFiles = [];
  const vendorFiles = [];
  
  jsFiles.forEach(file => {
    const stats = fs.statSync(path.join(distPath, file));
    const sizeKB = stats.size / 1024;
    const rating = getPerformanceRating(sizeKB);
    
    const fileInfo = {
      name: file,
      size: stats.size,
      sizeKB: sizeKB.toFixed(2),
      rating: rating.rating,
      color: rating.color,
      emoji: rating.emoji
    };
    
    if (file.includes('Page-')) {
      pageFiles.push(fileInfo);
    } else if (file.includes('vendor-') || file.includes('firebase-')) {
      vendorFiles.push(fileInfo);
    } else {
      componentFiles.push(fileInfo);
    }
  });

  // 페이지 파일 출력
  console.log(colorize('\n📄 페이지 번들:', 'cyan'));
  console.log('-'.repeat(80));
  
  const sortedPages = pageFiles.sort((a, b) => b.size - a.size);
  
  sortedPages.forEach(file => {
    const padded = file.name.padEnd(50);
    const sizePadded = file.sizeKB.padStart(10);
    console.log(`${file.emoji} ${padded} ${sizePadded} KB  ${colorize(file.rating, file.color)}`);
  });

  // 상위 10개 페이지 요약
  console.log(colorize('\n🔝 상위 10개 큰 페이지:', 'yellow'));
  console.log('-'.repeat(80));
  
  sortedPages.slice(0, 10).forEach((file, index) => {
    const pageName = file.name.replace(/Page-.*\.js$/, 'Page');
    console.log(`${index + 1}. ${colorize(pageName.padEnd(40), 'bright')} ${file.sizeKB} KB ${file.emoji}`);
  });

  // 벤더 파일 출력
  console.log(colorize('\n📦 벤더 번들:', 'magenta'));
  console.log('-'.repeat(80));
  
  vendorFiles.sort((a, b) => b.size - a.size).forEach(file => {
    const padded = file.name.padEnd(50);
    const sizePadded = file.sizeKB.padStart(10);
    console.log(`${file.emoji} ${padded} ${sizePadded} KB  ${colorize(file.rating, file.color)}`);
  });

  // 총합 계산
  const totalSize = jsFiles.reduce((sum, file) => {
    return sum + fs.statSync(path.join(distPath, file)).size;
  }, 0);

  const pageSize = pageFiles.reduce((sum, f) => sum + f.size, 0);
  const vendorSize = vendorFiles.reduce((sum, f) => sum + f.size, 0);
  const componentSize = componentFiles.reduce((sum, f) => sum + f.size, 0);

  console.log(colorize('\n📈 요약 통계:', 'bright'));
  console.log('='.repeat(80));
  console.log(`총 JS 파일:      ${jsFiles.length}개`);
  console.log(`페이지 번들:      ${pageFiles.length}개 (${formatBytes(pageSize)})`);
  console.log(`컴포넌트 번들:    ${componentFiles.length}개 (${formatBytes(componentSize)})`);
  console.log(`벤더 번들:        ${vendorFiles.length}개 (${formatBytes(vendorSize)})`);
  console.log(`총 번들 크기:     ${colorize(formatBytes(totalSize), 'bright')}`);
  console.log('='.repeat(80));
}

function analyzeProductDetailPage() {
  console.log(colorize('\n🔍 ProductDetailPage 상세 분석\n', 'bright'));
  console.log('='.repeat(80));

  const distPath = path.join(__dirname, '../dist/assets');
  const files = fs.readdirSync(distPath);
  
  const productDetailFile = files.find(f => f.startsWith('ProductDetailPage-') && f.endsWith('.js'));
  
  if (!productDetailFile) {
    console.log(colorize('❌ ProductDetailPage 번들을 찾을 수 없습니다.', 'red'));
    return;
  }

  const filePath = path.join(distPath, productDetailFile);
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const sizeKB = stats.size / 1024;
  const rating = getPerformanceRating(sizeKB);

  console.log(`파일명:           ${colorize(productDetailFile, 'cyan')}`);
  console.log(`크기:             ${colorize(formatBytes(stats.size), 'bright')} (${sizeKB.toFixed(2)} KB)`);
  console.log(`성능 등급:        ${rating.emoji} ${colorize(rating.rating, rating.color)}`);
  console.log(`라인 수:          ${content.split('\n').length.toLocaleString()}`);
  
  // 의존성 분석
  console.log(colorize('\n📦 주요 의존성:', 'cyan'));
  console.log('-'.repeat(80));
  
  const dependencies = {
    react: content.includes('react') || content.includes('React'),
    'react-router': content.includes('react-router'),
    axios: content.includes('axios'),
    firebase: content.includes('firebase'),
    zustand: content.includes('zustand'),
    lucide: content.includes('lucide'),
  };

  Object.entries(dependencies).forEach(([dep, found]) => {
    const icon = found ? '✅' : '❌';
    console.log(`${icon} ${dep}`);
  });

  // 최적화 제안
  console.log(colorize('\n💡 최적화 제안:', 'yellow'));
  console.log('-'.repeat(80));
  
  const suggestions = [];
  
  if (sizeKB > 100) {
    suggestions.push('🔴 번들 크기가 100KB를 초과합니다. 코드 스플리팅을 고려하세요.');
  }
  
  if (content.includes('useEffect') && content.includes('useState')) {
    suggestions.push('🟡 컴포넌트에 여러 state와 effect가 있습니다. 커스텀 훅으로 분리를 고려하세요.');
  }
  
  if (content.includes('axios') || content.includes('fetch')) {
    suggestions.push('🔵 API 호출이 있습니다. React Query나 SWR로 캐싱을 추가하세요.');
  }
  
  if (content.match(/import.*from.*@\//g)?.length > 10) {
    suggestions.push('🟢 많은 import가 있습니다. Dynamic import()를 사용해 필요시 로드하세요.');
  }

  if (suggestions.length === 0) {
    suggestions.push('✅ 현재 최적화 상태가 양호합니다!');
  }

  suggestions.forEach(s => console.log(s));
  
  console.log('='.repeat(80));
}

function analyzePageLoadDependencies() {
  console.log(colorize('\n🔗 페이지 로드 의존성 분석\n', 'bright'));
  console.log('='.repeat(80));

  const pagesPath = path.join(__dirname, '../src/pages');
  
  if (!fs.existsSync(pagesPath)) {
    console.log(colorize('❌ src/pages 폴더를 찾을 수 없습니다.', 'red'));
    return;
  }

  const pageFiles = fs.readdirSync(pagesPath).filter(f => f.endsWith('.tsx'));
  
  console.log(`총 ${pageFiles.length}개 페이지 발견\n`);

  const heavyPages = [];

  pageFiles.forEach(file => {
    const filePath = path.join(pagesPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // import 개수 세기
    const imports = content.match(/^import .* from/gm) || [];
    const dynamicImports = content.match(/import\(/g) || [];
    const useEffects = content.match(/useEffect/g) || [];
    const apiCalls = content.match(/api\./g) || [];
    
    const score = imports.length + (useEffects.length * 2) + (apiCalls.length * 3);
    
    if (score > 20 || imports.length > 15) {
      heavyPages.push({
        name: file,
        imports: imports.length,
        dynamicImports: dynamicImports.length,
        useEffects: useEffects.length,
        apiCalls: apiCalls.length,
        score
      });
    }
  });

  // 점수 높은 순 정렬
  heavyPages.sort((a, b) => b.score - a.score);

  console.log(colorize('⚠️  무거운 페이지 (최적화 필요):\n', 'yellow'));
  
  heavyPages.forEach((page, index) => {
    const emoji = page.score > 40 ? '🔴' : page.score > 30 ? '🟠' : '🟡';
    console.log(`${index + 1}. ${emoji} ${colorize(page.name.padEnd(40), 'bright')} (점수: ${page.score})`);
    console.log(`   Import: ${page.imports}, Dynamic: ${page.dynamicImports}, Effects: ${page.useEffects}, API: ${page.apiCalls}`);
    console.log('');
  });

  if (heavyPages.length === 0) {
    console.log(colorize('✅ 모든 페이지가 적절한 의존성을 가지고 있습니다!', 'green'));
  }
  
  console.log('='.repeat(80));
}

function generateOptimizationReport() {
  console.log(colorize('\n📋 최적화 우선순위 리포트\n', 'bright'));
  console.log('='.repeat(80));

  const distPath = path.join(__dirname, '../dist/assets');
  
  if (!fs.existsSync(distPath)) {
    console.log(colorize('❌ dist 폴더가 없습니다. npm run build를 먼저 실행하세요.', 'red'));
    return;
  }

  const files = fs.readdirSync(distPath);
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.endsWith('.map'));
  
  const largePages = jsFiles
    .filter(f => f.includes('Page-'))
    .map(file => {
      const stats = fs.statSync(path.join(distPath, file));
      const sizeKB = stats.size / 1024;
      return {
        name: file.replace(/Page-.*\.js$/, 'Page'),
        file: file,
        sizeKB: sizeKB.toFixed(2),
        size: stats.size
      };
    })
    .filter(p => p.size > 50 * 1024) // 50KB 이상
    .sort((a, b) => b.size - a.size);

  console.log(colorize('🎯 우선순위 1: 큰 페이지 번들 최적화\n', 'red'));
  
  largePages.slice(0, 5).forEach((page, index) => {
    console.log(`${index + 1}. ${page.name.padEnd(40)} ${page.sizeKB} KB`);
    console.log(`   → 권장: Dynamic import 또는 컴포넌트 lazy loading`);
    console.log('');
  });

  console.log(colorize('\n🎯 우선순위 2: 벤더 번들 최적화\n', 'yellow'));
  
  const vendorFile = jsFiles.find(f => f.includes('vendor-'));
  if (vendorFile) {
    const stats = fs.statSync(path.join(distPath, vendorFile));
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`Vendor 번들: ${sizeKB} KB`);
    console.log(`   → 권장: Tree shaking, 불필요한 라이브러리 제거`);
    console.log('');
  }

  console.log(colorize('\n🎯 우선순위 3: API 호출 최적화\n', 'cyan'));
  console.log('   → 권장: React Query 또는 SWR로 데이터 캐싱');
  console.log('   → 권장: API 응답 시간 모니터링 (Sentry)');
  console.log('');

  console.log('='.repeat(80));
}

// 메인 실행
console.log(colorize('\n🚀 UR Live 성능 분석 시작\n', 'bright'));

analyzeBundleSize();
analyzeProductDetailPage();
analyzePageLoadDependencies();
generateOptimizationReport();

console.log(colorize('\n✅ 성능 분석 완료!\n', 'green'));
