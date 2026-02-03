const fs = require('fs');

let content = fs.readFileSync('index.tsx', 'utf8');

// Find the start of /live/:streamId route
const startMarker = "app.get('/live/:streamId', (c) => {";
const startIdx = content.indexOf(startMarker);

if (startIdx === -1) {
  console.log('Route not found!');
  process.exit(1);
}

// Find the next route after this one (Mock payment)
const nextRouteMarker = "// Mock 결제 페이지 (테스트용)";
const endIdx = content.indexOf(nextRouteMarker, startIdx);

if (endIdx === -1) {
  console.log('Next route not found!');
  process.exit(1);
}

// Replace the entire route with SPA fallback
const before = content.substring(0, startIdx);
const after = content.substring(endIdx);
const newRoute = "// 라이브 스트림 뷰어 페이지 - React SPA\napp.get('/live/:streamId', serveStatic({ path: '/index.html' }));\n\n";

const newContent = before + newRoute + after;

fs.writeFileSync('index.tsx', newContent, 'utf8');
console.log('✅ Replaced /live/:streamId route with SPA fallback');
