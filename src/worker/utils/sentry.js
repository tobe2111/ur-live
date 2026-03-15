/**
 * 📊 Sentry Integration for Cloudflare Workers
 *
 * Purpose:
 * - Capture and report errors to Sentry for monitoring
 * - Track performance metrics and slow queries
 * - Provide context for debugging production issues
 *
 * Features:
 * - Error tracking with stack traces
 * - User context (IP, user agent, user ID)
 * - Request context (URL, method, headers)
 * - Custom tags (region, environment)
 * - Performance monitoring
 */
class SentryClient {
    config;
    endpoint;
    constructor(config) {
        this.config = config;
        // Parse DSN to get endpoint
        // DSN format: https://[key]@[host]/[project_id]
        const match = config.dsn.match(/https:\/\/(.+)@(.+)\/(\d+)/);
        if (match) {
            const [, key, host, projectId] = match;
            this.endpoint = `https://${host}/api/${projectId}/store/`;
        }
        else {
            this.endpoint = '';
        }
    }
    /**
     * Capture an error and send to Sentry
     */
    async captureException(error, context) {
        if (!this.config.enabled || !this.endpoint) {
            console.log('[Sentry] Disabled or invalid DSN, skipping error report');
            return;
        }
        try {
            const event = this.buildEvent(error, context);
            await this.sendEvent(event);
            console.log('[Sentry] ✅ Error sent to Sentry:', error.message);
        }
        catch (sentryError) {
            console.error('[Sentry] ❌ Failed to send error:', sentryError);
        }
    }
    /**
     * Capture a message and send to Sentry
     */
    async captureMessage(message, level = 'info', context) {
        if (!this.config.enabled || !this.endpoint) {
            return;
        }
        try {
            const event = {
                message,
                level,
                timestamp: Date.now() / 1000,
                platform: 'javascript',
                environment: this.config.environment,
                server_name: 'cloudflare-worker',
                tags: {
                    region: this.config.region,
                    ...context?.tags,
                },
                extra: context?.extra,
            };
            await this.sendEvent(event);
            console.log('[Sentry] ✅ Message sent to Sentry:', message);
        }
        catch (sentryError) {
            console.error('[Sentry] ❌ Failed to send message:', sentryError);
        }
    }
    /**
     * Build Sentry event from error
     */
    buildEvent(error, context) {
        const event = {
            exception: {
                values: [
                    {
                        type: error.name || 'Error',
                        value: error.message,
                        stacktrace: this.parseStackTrace(error.stack),
                    },
                ],
            },
            level: 'error',
            timestamp: Date.now() / 1000,
            platform: 'javascript',
            environment: this.config.environment,
            server_name: 'cloudflare-worker',
            tags: {
                region: this.config.region,
                ...context?.tags,
            },
            extra: {
                ...context?.extra,
            },
        };
        // Add request context
        if (context?.request) {
            const url = new URL(context.request.url);
            event.request = {
                url: context.request.url,
                method: context.request.method,
                headers: Object.fromEntries(context.request.headers.entries()),
                query_string: url.search,
            };
            // Add user IP
            const ip = context.request.headers.get('cf-connecting-ip') ||
                context.request.headers.get('x-forwarded-for');
            if (ip) {
                event.user = event.user || {};
                event.user.ip_address = ip;
            }
        }
        // Add user context
        if (context?.user) {
            event.user = {
                ...event.user,
                id: context.user.id,
                username: context.user.email,
            };
        }
        return event;
    }
    /**
     * Parse stack trace into Sentry format
     */
    parseStackTrace(stack) {
        if (!stack)
            return undefined;
        const frames = stack
            .split('\n')
            .slice(1) // Remove error message line
            .map((line) => {
            // Parse stack trace line
            // Example: "    at functionName (file.ts:10:5)"
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
            if (match) {
                const [, func, filename, lineno, colno] = match;
                if (!func || !filename || !lineno || !colno)
                    return null;
                return {
                    function: func.trim(),
                    filename: filename.trim(),
                    lineno: parseInt(lineno, 10),
                    colno: parseInt(colno, 10),
                };
            }
            return null;
        })
            .filter(Boolean);
        return { frames };
    }
    /**
     * Send event to Sentry
     */
    async sendEvent(event) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': this.buildAuthHeader(),
            },
            body: JSON.stringify(event),
        });
        if (!response.ok) {
            throw new Error(`Sentry API error: ${response.status}`);
        }
    }
    /**
     * Build Sentry auth header
     */
    buildAuthHeader() {
        const match = this.config.dsn.match(/https:\/\/(.+)@/);
        const publicKey = match ? match[1] : '';
        return [
            `Sentry sentry_version=7`,
            `sentry_client=cloudflare-worker/1.0.0`,
            `sentry_key=${publicKey}`,
            `sentry_timestamp=${Date.now() / 1000}`,
        ].join(', ');
    }
}
// Singleton instance
let sentryInstance = null;
/**
 * Initialize Sentry with configuration
 */
export function initSentry(config) {
    sentryInstance = new SentryClient(config);
    return sentryInstance;
}
/**
 * Get Sentry instance
 */
export function getSentry() {
    return sentryInstance;
}
/**
 * Capture exception helper
 */
export async function captureException(error, context) {
    if (sentryInstance) {
        await sentryInstance.captureException(error, context);
    }
}
/**
 * Capture message helper
 */
export async function captureMessage(message, level, context) {
    if (sentryInstance) {
        await sentryInstance.captureMessage(message, level, context);
    }
}
export default {
    initSentry,
    getSentry,
    captureException,
    captureMessage,
};
