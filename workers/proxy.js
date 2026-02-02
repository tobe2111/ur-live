/**
 * Cloudflare Worker - Custom Domain Proxy
 * 
 * 역할: live.ur-team.com → toss-live-commerce.pages.dev 프록시
 * DNS: 가비아에서 live.ur-team.com → proxy-worker.your-subdomain.workers.dev
 */

export default {
  async fetch(request, env) {
    // 원본 URL
    const url = new URL(request.url);
    
    // Pages 도메인으로 변경
    url.hostname = 'toss-live-commerce.pages.dev';
    
    // 요청 헤더 복사
    const modifiedRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });
    
    // Host 헤더 업데이트
    modifiedRequest.headers.set('Host', 'toss-live-commerce.pages.dev');
    
    // Pages로 요청 프록시
    const response = await fetch(modifiedRequest);
    
    // 응답 헤더 복사
    const modifiedResponse = new Response(response.body, response);
    
    // CORS 헤더 추가 (필요시)
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    
    return modifiedResponse;
  }
};
