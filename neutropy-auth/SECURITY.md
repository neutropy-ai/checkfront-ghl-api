# Security Documentation

This document outlines the security architecture, practices, and recommendations for the Neutropy Auth application.

---

## What We Do NOT Do

This application follows strict security principles. The following actions are explicitly **prohibited**:

| Action | Status |
|--------|--------|
| Auto-fill or submit HighLevel username/password | **Never** |
| Scrape, store, proxy, or capture HighLevel credentials | **Never** |
| Bypass authentication or "login-as" users | **Never** |
| Store user passwords in our database | **Never** |
| Send passwords to HighLevel from our pages | **Never** |

---

## Authentication Model

### Mode A: Whitelabel Redirect

```
User -> neutropy.ai/login -> Redirect -> app.neutropy.ai (HighLevel)
                                              |
                                              v
                                    HighLevel handles auth
```

**Security properties:**
- No credentials pass through our application
- Authentication is entirely handled by HighLevel
- Our pages are purely informational/navigational

### Mode B: OIDC SSO

```
User -> neutropy.ai/login -> IdP (Auth0/Okta/Entra) -> neutropy.ai/api/auth/callback
                                                              |
                                                              v
                                                    app.neutropy.ai (HighLevel SSO)
```

**Security properties:**
- Credentials are handled by the Identity Provider
- Standards-based OIDC authentication
- HighLevel configured with the same IdP for SSO
- No credential capture at any point in our application

---

## OWASP Alignment

### Protections Implemented

| OWASP Category | Implementation |
|----------------|----------------|
| **Injection** | Server-side input validation with Zod schemas |
| **Broken Authentication** | Authentication delegated to HighLevel/IdP |
| **Sensitive Data Exposure** | No sensitive data stored; HTTPS enforced |
| **Security Misconfiguration** | Strict security headers; secure defaults |
| **XSS** | React's built-in escaping; CSP headers |
| **Insecure Deserialization** | JSON parsing with validation |
| **Insufficient Logging** | Errors logged server-side |

### Input Validation

All user input is validated server-side using Zod schemas:

```typescript
// lib/validation.ts
export const signupSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().max(254).toLowerCase().trim(),
  // ...
})
```

---

## Security Headers

The following security headers are configured in `next.config.mjs`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `no-referrer` | No referrer information leaked |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `Content-Security-Policy` | (see below) | Prevent XSS and injection |

### Content Security Policy

```
default-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
img-src 'self' data:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline';
connect-src 'self';
```

**Tightening recommendations:**
- If you add analytics, add their domains to `script-src` and `connect-src`
- If you add external fonts (e.g., Google Fonts), add to `font-src`
- If you add error reporting (e.g., Sentry), add to `connect-src`

---

## Redirect Security

Open redirect vulnerabilities are prevented by validating all redirect URLs:

```typescript
// auth.ts
function validateRedirectUrl(url: string, baseUrl: string): string {
  const targetUrl = new URL(url, baseUrl)
  const allowedOrigins = new Set([
    new URL(baseUrl).origin,
    new URL(appConfig.ghlAppUrl).origin
  ])

  if (allowedOrigins.has(targetUrl.origin)) {
    return targetUrl.toString()
  }
  return baseUrl // Fallback to safe default
}
```

Only redirects to:
- Same origin (`neutropy.ai`)
- HighLevel whitelabel domain (`app.neutropy.ai`)

---

## Secrets Management

### Server-Side Only

These secrets must **never** be exposed to the client:

| Secret | Purpose |
|--------|---------|
| `AUTH_SECRET` | Auth.js session encryption |
| `AUTH0_CLIENT_SECRET` | Auth0 OIDC |
| `OKTA_CLIENT_SECRET` | Okta OIDC |
| `ENTRA_CLIENT_SECRET` | Entra OIDC |
| `GHL_AGENCY_TOKEN` | HighLevel API (if using automated provisioning) |
| `SIGNUP_WEBHOOK_URL` | Webhook endpoint |

### Client-Safe Variables

Only these `NEXT_PUBLIC_*` variables are exposed to the browser:

| Variable | Contains |
|----------|----------|
| `NEXT_PUBLIC_AUTH_MODE` | `A` or `B` |
| `NEXT_PUBLIC_GHL_APP_URL` | Public URL |
| `NEXT_PUBLIC_FORGOT_PASSWORD_URL` | Public URL |
| `NEXT_PUBLIC_SIGNUP_STRATEGY` | `manual` or `highlevel` |
| `NEXT_PUBLIC_ENABLE_PASSWORD_FIELDS` | `true` or `false` |

---

## Rate Limiting & Bot Protection

### Recommended: Edge-Level Protection

**Cloudflare (Recommended)**
1. Enable **Bot Fight Mode**
2. Configure **Rate Limiting Rules**:
   - `/api/signup`: 5 requests per minute per IP
   - `/api/auth/*`: 10 requests per minute per IP
3. Consider **Turnstile** captcha for the create-account form

**Vercel**
1. Use Vercel's built-in DDoS protection
2. Consider Vercel Edge Middleware for custom rate limiting

### Application-Level (Fallback)

If edge protection is not available, implement rate limiting in your API routes:

```typescript
// Example using a rate limit library
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: { message: 'Too many requests, please try again later.' }
})
```

---

## Session Security

Auth.js sessions are configured with:

```typescript
session: {
  strategy: "jwt",
  maxAge: 24 * 60 * 60 // 24 hours
}
```

**Properties:**
- JWT-based (stateless)
- Encrypted with `AUTH_SECRET`
- 24-hour expiration
- HttpOnly cookies (handled by Auth.js)

---

## Logging & Monitoring

### What We Log

- Signup attempts (success/failure, no PII in logs)
- Authentication errors
- API errors

### What We Don't Log

- Passwords (never collected)
- Full email addresses in error logs
- Session tokens

### Recommended Monitoring

1. **Error Tracking**: Sentry or similar
2. **Access Logs**: Vercel/Cloudflare analytics
3. **Alerting**: Set up alerts for:
   - Spike in signup failures
   - Unusual traffic patterns
   - Authentication errors

---

## Security Checklist

Before going to production, verify:

- [ ] All `NEXT_PUBLIC_*` variables contain only public information
- [ ] `AUTH_SECRET` is a cryptographically random string (32+ bytes)
- [ ] IdP client secrets are not exposed in frontend code
- [ ] CSP is configured and tested
- [ ] Rate limiting is enabled (edge or application level)
- [ ] HTTPS is enforced on all domains
- [ ] HighLevel whitelabel SSL is active
- [ ] Webhook URLs are HTTPS
- [ ] Error messages don't leak sensitive information

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Contact the security team directly
3. Provide detailed reproduction steps
4. Allow reasonable time for a fix before disclosure

---

## Compliance Notes

This application is designed to support:

- **GDPR**: No unnecessary data collection; user consent for data processing
- **SOC 2**: Delegated authentication; audit logging capabilities
- **HIPAA**: No PHI stored; authentication via compliant IdPs

Specific compliance requirements should be verified with your compliance team based on your use case.
