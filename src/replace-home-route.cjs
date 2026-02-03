const fs = require('fs');

let content = fs.readFileSync('index.tsx', 'utf8');

// Find the start of / route (home page)
const startMarker = "// 메인 페이지\napp.get('/', (c) => {";
const startIdx = content.indexOf(startMarker);

if (startIdx === -1) {
  console.log('Home route not found!');
  process.exit(1);
}

// Find the next route after this one (live route)
const nextRouteMarker = "// 라이브 스트림 뷰어 페이지 - React SPA";
const endIdx = content.indexOf(nextRouteMarker, startIdx);

if (endIdx === -1) {
  console.log('Next route marker not found!');
  process.exit(1);
}

// Replace the entire route with SPA fallback
const before = content.substring(0, startIdx);
const after = content.substring(endIdx);
const newRoute = "// 메인 페이지 - React SPA\napp.get('/', serveStatic({ path: '/index.html' }));\n\n";

const newContent = before + newRoute + after;

fs.writeFileSync('index.tsx', newContent, 'utf8');
console.log('✅ Replaced / route with SPA fallback');
