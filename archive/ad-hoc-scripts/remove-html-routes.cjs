const fs = require('fs');

let content = fs.readFileSync('src/index.tsx', 'utf8');

// List of routes to remove (React SPA pages)
const routesToRemove = [
  "/mock-payment",
  "/payment/success",
  "/payment/failed", 
  "/payment/cancel",
  "/login",
  "/logout",
  "/mypage",
  "/s/:username",
  "/dashboard/seller/:username",
  "/checkout",
  "/orders",
  "/order/:orderNo",
  "/admin/login",
  "/seller/login",
  "/admin",
  "/seller",
  "/my-orders"
];

// For each route, find and remove its handler
routesToRemove.forEach(route => {
  // Escape special chars for regex
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const routeRegex = new RegExp(`app\\.get\\(['"]${escapedRoute}['"], \\(c\\) => {[\\s\\S]*?^\\}\\);`, 'gm');
  
  const before = content;
  content = content.replace(routeRegex, `// Removed route: ${route} (handled by React SPA)`);
  
  if (content !== before) {
    console.log(`✅ Removed route: ${route}`);
  }
});

fs.writeFileSync('src/index.tsx', content, 'utf8');
console.log('✅ Finished removing HTML routes');
