#!/bin/bash

#################################################################################
# Cloudflare Pages Deployment Verification Script
#################################################################################
# 목적: 배포 후 자동으로 사이트 상태를 검증하는 스크립트
# 사용법: ./scripts/verify-deployment.sh [URL]
# 예시: ./scripts/verify-deployment.sh https://live.ur-team.com
#################################################################################

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 설정
DEFAULT_URL="https://live.ur-team.com"
DEPLOYMENT_URL="${1:-$DEFAULT_URL}"
MAX_RETRIES=5
RETRY_DELAY=10

# 결과 카운터
PASSED=0
FAILED=0

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Deployment Verification Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Target URL: ${DEPLOYMENT_URL}"
echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

#################################################################################
# Helper Functions
#################################################################################

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

#################################################################################
# Test Functions
#################################################################################

test_site_reachability() {
    print_info "Test 1: Site Reachability"
    
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" || echo "000")
    
    if [ "$status_code" = "200" ]; then
        print_success "Site is reachable (HTTP $status_code)"
        return 0
    else
        print_error "Site returned HTTP $status_code"
        return 1
    fi
}

test_html_content() {
    print_info "Test 2: HTML Content"
    
    local html_content
    html_content=$(curl -s "$DEPLOYMENT_URL")
    
    # index.html이 비어있지 않은지 확인
    if [ -z "$html_content" ]; then
        print_error "Empty HTML content"
        return 1
    fi
    
    # HTML 구조 확인
    if echo "$html_content" | grep -q "<!doctype html>"; then
        print_success "Valid HTML doctype found"
    else
        print_error "Invalid or missing HTML doctype"
        return 1
    fi
    
    # 중요 메타 태그 확인
    if echo "$html_content" | grep -q "<meta charset="; then
        print_success "Charset meta tag found"
    else
        print_warning "Charset meta tag missing"
    fi
    
    return 0
}

test_javascript_loading() {
    print_info "Test 3: JavaScript Asset Loading"
    
    local html_content
    html_content=$(curl -s "$DEPLOYMENT_URL")
    
    # <script type="module" 태그 추출
    local js_files
    js_files=$(echo "$html_content" | grep -oP 'src="/assets/[^"]+\.js"' | sed 's/src="//;s/"$//')
    
    if [ -z "$js_files" ]; then
        print_error "No JavaScript files found in HTML"
        return 1
    fi
    
    print_info "Found JavaScript files:"
    echo "$js_files" | while read -r js_file; do
        echo "  - $js_file"
    done
    
    # 각 JS 파일 존재 확인
    local all_js_ok=true
    echo "$js_files" | while read -r js_file; do
        local full_url="${DEPLOYMENT_URL}${js_file}"
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$full_url" || echo "000")
        
        if [ "$status_code" = "200" ]; then
            echo -e "  ${GREEN}✓${NC} $js_file (HTTP $status_code)"
        else
            echo -e "  ${RED}✗${NC} $js_file (HTTP $status_code)"
            all_js_ok=false
        fi
    done
    
    if $all_js_ok; then
        print_success "All JavaScript files are accessible"
        return 0
    else
        print_error "Some JavaScript files are missing (404)"
        return 1
    fi
}

test_health_endpoint() {
    print_info "Test 4: Health Check Endpoint"
    
    local health_url="${DEPLOYMENT_URL}/api/health"
    local response
    response=$(curl -s "$health_url" || echo "")
    
    if [ -z "$response" ]; then
        print_warning "Health endpoint not responding"
        return 0  # Not critical
    fi
    
    # JSON 응답 확인
    if echo "$response" | grep -q '"status"'; then
        print_success "Health endpoint responding with JSON"
        echo "  Response: $response"
        return 0
    else
        print_warning "Health endpoint returned unexpected response"
        return 0  # Not critical
    fi
}

test_kakao_sdk() {
    print_info "Test 5: Kakao SDK Loading"
    
    local html_content
    html_content=$(curl -s "$DEPLOYMENT_URL")
    
    # Kakao SDK 스크립트 확인
    if echo "$html_content" | grep -q "kakao.min.js"; then
        print_success "Kakao SDK script tag found"
        return 0
    else
        print_warning "Kakao SDK script tag not found (may be lazy-loaded)"
        return 0  # Not critical
    fi
}

test_toss_payments() {
    print_info "Test 6: TossPayments Widget"
    
    local html_content
    html_content=$(curl -s "$DEPLOYMENT_URL")
    
    # TossPayments 관련 스크립트 확인
    if echo "$html_content" | grep -q "toss"; then
        print_success "TossPayments reference found"
        return 0
    else
        print_warning "TossPayments reference not found (may be lazy-loaded)"
        return 0  # Not critical
    fi
}

test_response_time() {
    print_info "Test 7: Response Time"
    
    local response_time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$DEPLOYMENT_URL")
    
    # 응답 시간을 밀리초로 변환
    local response_ms
    response_ms=$(echo "$response_time * 1000" | bc)
    
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        print_success "Response time: ${response_ms}ms (< 2000ms)"
        return 0
    elif (( $(echo "$response_time < 5.0" | bc -l) )); then
        print_warning "Response time: ${response_ms}ms (2000-5000ms, acceptable)"
        return 0
    else
        print_error "Response time: ${response_ms}ms (> 5000ms, too slow)"
        return 1
    fi
}

test_ssl_certificate() {
    print_info "Test 8: SSL Certificate"
    
    if [[ "$DEPLOYMENT_URL" == https://* ]]; then
        local ssl_info
        ssl_info=$(echo | openssl s_client -servername "${DEPLOYMENT_URL#https://}" -connect "${DEPLOYMENT_URL#https://}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        
        if [ -n "$ssl_info" ]; then
            print_success "Valid SSL certificate"
            echo "$ssl_info" | sed 's/^/  /'
            return 0
        else
            print_warning "Could not verify SSL certificate"
            return 0
        fi
    else
        print_warning "Site is not using HTTPS"
        return 0
    fi
}

test_cors_headers() {
    print_info "Test 9: CORS Headers"
    
    local cors_header
    cors_header=$(curl -s -I -X OPTIONS "$DEPLOYMENT_URL" | grep -i "access-control-allow-origin" || echo "")
    
    if [ -n "$cors_header" ]; then
        print_success "CORS headers present"
        echo "  $cors_header"
        return 0
    else
        print_info "No CORS headers (may be intentional)"
        return 0
    fi
}

test_cache_headers() {
    print_info "Test 10: Cache Headers"
    
    local cache_header
    cache_header=$(curl -s -I "$DEPLOYMENT_URL" | grep -i "cache-control" || echo "")
    
    if [ -n "$cache_header" ]; then
        print_success "Cache headers present"
        echo "  $cache_header"
        return 0
    else
        print_warning "No cache headers found"
        return 0
    fi
}

#################################################################################
# Main Execution
#################################################################################

main() {
    echo -e "${BLUE}Starting deployment verification...${NC}"
    echo ""
    
    # 사이트가 준비될 때까지 대기
    print_info "Waiting for deployment to be ready..."
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" || echo "000")
        
        if [ "$status_code" = "200" ]; then
            print_success "Deployment is ready"
            break
        else
            ((retry_count++))
            print_warning "Deployment not ready yet (attempt $retry_count/$MAX_RETRIES, HTTP $status_code)"
            if [ $retry_count -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    if [ $retry_count -eq $MAX_RETRIES ]; then
        print_error "Deployment did not become ready after $MAX_RETRIES attempts"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Running verification tests...${NC}"
    echo ""
    
    # 모든 테스트 실행
    test_site_reachability
    test_html_content
    test_javascript_loading
    test_health_endpoint
    test_kakao_sdk
    test_toss_payments
    test_response_time
    test_ssl_certificate
    test_cors_headers
    test_cache_headers
    
    # 결과 요약
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Verification Results${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    echo -e "Failed: ${RED}$FAILED${NC}"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ All critical tests passed!${NC}"
        echo -e "${GREEN}Deployment is verified and ready.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed!${NC}"
        echo -e "${RED}Please review the errors above.${NC}"
        exit 1
    fi
}

# 스크립트 실행
main
