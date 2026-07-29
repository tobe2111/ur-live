package com.urteam.yourdeal;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * 🛡️ 2026-07-18 앱 출시 대비 (docs/design/app-ready-audit-2026-07.md §2-②):
 *   토스 실결제 단계에서 카드사 앱(ISP/페이북/신한 등)이 `intent://`·커스텀 스킴으로 호출되는데
 *   순수 WebView 는 이를 처리 못 해 결제가 중단됨. → shouldOverrideUrlLoading 에서
 *   비-http(s) 스킴을 네이티브 Intent 로 위임:
 *   - intent:// → Intent.parseUri + startActivity, 미설치 시 browser_fallback_url 또는 마켓 이동
 *   - 기타 커스텀 스킴(ispmobile:// kakaotalk:// supertoss:// 등) → ACTION_VIEW
 *   - 처리 실패는 조용히 무시(웹뷰 에러 페이지/크래시 방지 — 결제창은 사용자가 다른 수단 선택 가능)
 *   AndroidManifest 의 <queries> 와 세트(Android 11+ 패키지 가시성).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();
        final Bridge bridge = getBridge();
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            // API 24+ 경로 (현대 기기 대부분)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (handleExternalScheme(request.getUrl().toString())) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            // 레거시 경로 (일부 구형 WebView 가 여전히 호출)
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (handleExternalScheme(url)) return true;
                return super.shouldOverrideUrlLoading(view, url);
            }
        });
    }

    /** 비-http(s) 스킴을 네이티브로 위임. true = 웹뷰가 로드하지 않음. */
    private boolean handleExternalScheme(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")
                || lower.startsWith("file://") || lower.startsWith("about:")
                || lower.startsWith("blob:") || lower.startsWith("data:")
                || lower.startsWith("javascript:")) {
            return false; // 일반 웹 네비게이션은 Capacitor 기본 처리(allowNavigation)에 위임
        }
        try {
            if (lower.startsWith("intent://") || lower.startsWith("intent:")) {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                try {
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    // 앱 미설치: ① 페이지가 지정한 폴백 URL → 웹뷰 로드 ② 마켓으로 이동
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null && (fallback.startsWith("http://") || fallback.startsWith("https://"))) {
                        getBridge().getWebView().loadUrl(fallback);
                    } else {
                        String pkg = intent.getPackage();
                        if (pkg != null) {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg)));
                        }
                    }
                }
                return true;
            }
            // 기타 커스텀 스킴 — 카드사/은행/간편결제/카카오 등
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            return true;
        } catch (Exception ignored) {
            // 파싱 불가/미설치 스킴: 웹뷰에 넘기지 않고 무시 (ERR_UNKNOWN_URL_SCHEME 에러 화면 방지)
            return true;
        }
    }
}
