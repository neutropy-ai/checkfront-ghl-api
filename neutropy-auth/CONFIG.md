# Neutropy Auth Configuration Guide

This application provides a Neutropy-branded login and create-account experience that routes users into GoHighLevel (HighLevel/GHL) safely.

## Overview

### What You're Building

- `neutropy.ai/login` and `neutropy.ai/create-account` are branded "front door" pages
- The actual HighLevel app lives at your whitelabel domain: `https://app.neutropy.ai`
- **No credentials are captured or proxied** - authentication happens on HighLevel or your IdP

---

## 1. HighLevel Whitelabel Domain Setup

Before deploying this application, configure your HighLevel whitelabel domain.

### DNS Configuration

Create the following DNS record:

| Type  | Name | Value                          |
|-------|------|--------------------------------|
| CNAME | app  | (As directed by HighLevel)     |

### HighLevel Configuration

1. Log into your HighLevel Agency account
2. Navigate to **Settings > Company > Whitelabel**
3. Set your **App Domain** to `app.neutropy.ai`
4. Complete SSL certificate setup
5. Verify the domain is accessible at `https://app.neutropy.ai`

> **Note**: Exact UI steps may vary. Consult HighLevel's current whitelabel documentation for the latest instructions.

---

## 2. Choose Your Authentication Mode

### Mode A: Whitelabel Redirect (Recommended for Quick Launch)

**How it works:**
- Your Neutropy login page displays branded UI
- On "Continue", users are redirected to `https://app.neutropy.ai`
- HighLevel's hosted login screen handles authentication

**Configuration:**
```env
NEXT_PUBLIC_AUTH_MODE=A
NEXT_PUBLIC_GHL_APP_URL=https://app.neutropy.ai
```

**Pros:**
- Minimal setup
- No IdP configuration required
- No credential handling on your domain

**Cons:**
- Users see HighLevel-hosted login UI after redirect

---

### Mode B: OIDC SSO (Best User Experience)

**How it works:**
- Users authenticate via your Identity Provider (Auth0/Okta/Entra)
- HighLevel is configured with the same IdP for SSO
- After IdP login, users land directly in HighLevel without a second login

**Configuration:**
```env
NEXT_PUBLIC_AUTH_MODE=B
IDP_PROVIDER=auth0  # or: okta, entra

# Auth0 example
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_ISSUER=https://your-tenant.auth0.com

AUTH_SECRET=generate-a-long-random-secret
AUTH_URL=https://neutropy.ai
```

**Pros:**
- Seamless single sign-on experience
- Centralized identity management (MFA, offboarding, etc.)
- Best user experience

**Cons:**
- Requires IdP setup
- Requires HighLevel SSO configuration

---

## 3. OIDC SSO Setup (Mode B)

### Step 1: Configure Your Identity Provider

#### Auth0

1. Create a new **Regular Web Application** in Auth0
2. Configure **Allowed Callback URLs**:
   ```
   https://neutropy.ai/api/auth/callback/auth0
   ```
3. Configure **Allowed Logout URLs**:
   ```
   https://neutropy.ai/login
   ```
4. Note your **Client ID**, **Client Secret**, and **Domain** (issuer)

#### Okta

1. Create a new **Web Application** in Okta
2. Configure **Sign-in redirect URIs**:
   ```
   https://neutropy.ai/api/auth/callback/okta
   ```
3. Configure **Sign-out redirect URIs**:
   ```
   https://neutropy.ai/login
   ```
4. Note your **Client ID**, **Client Secret**, and **Issuer URI**

#### Microsoft Entra ID

1. Register a new **Web Application** in Azure AD
2. Configure **Redirect URIs**:
   ```
   https://neutropy.ai/api/auth/callback/microsoft-entra-id
   ```
3. Note your **Application (client) ID**, **Client Secret**, and **Directory (tenant) ID**

### Step 2: Configure HighLevel SSO

1. In HighLevel, navigate to **Settings > SSO**
2. Configure OIDC with the **same IdP** you configured above
3. Set the required redirect URIs as directed by HighLevel
4. Ensure email mapping aligns (IdP email = HighLevel user email)

> **Important**: HighLevel publishes SSO setup guides for Auth0 and Okta. Consult their official documentation for exact configuration steps.

### Step 3: Test the Flow

1. Visit `https://neutropy.ai/login`
2. Click **Continue**
3. Authenticate with your IdP
4. Verify you land in HighLevel at `https://app.neutropy.ai`

---

## 4. Account Creation / Onboarding

### Option 1: Manual Processing (Recommended)

**Configuration:**
```env
NEXT_PUBLIC_SIGNUP_STRATEGY=manual
SIGNUP_STRATEGY=manual
SIGNUP_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxx/yyy
```

**Flow:**
1. User submits create-account form
2. Data is sent to your webhook (Zapier/Make/n8n)
3. Admin creates user/sub-account in HighLevel
4. HighLevel sends user an invite email

**Webhook Payload:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "source": "neutropy.ai/create-account",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Option 2: Automated Provisioning (Advanced)

**Configuration:**
```env
NEXT_PUBLIC_SIGNUP_STRATEGY=highlevel
SIGNUP_STRATEGY=highlevel
GHL_AGENCY_TOKEN=your-agency-api-token
```

**Requirements:**
- HighLevel Agency Pro plan (or higher) for location creation
- Valid API token with appropriate permissions
- **VERIFY** API endpoint payloads in official HighLevel docs before enabling

> **Warning**: The HighLevel API integration is marked with TODO placeholders. You must verify the exact request/response shapes in HighLevel's official API documentation before production use.

---

## 5. Client Experience: "Direct Landing"

### Requirement
Each client user should land directly in their sub-account after login (no account switching UI).

### Implementation
This is enforced in HighLevel user permissions, not in this application:

1. When creating a user in HighLevel, assign them to **only one location**
2. Users with single-location access will land directly in that location

### Staff/Admins
For internal staff who need multi-location access:
- Assign them to multiple locations in HighLevel
- They will see the standard account switching UI

---

## 6. Environment Variables Reference

### Required for All Modes

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_AUTH_MODE` | `A` (redirect) or `B` (SSO) |
| `NEXT_PUBLIC_GHL_APP_URL` | HighLevel whitelabel URL |

### Mode B (SSO)

| Variable | Description |
|----------|-------------|
| `IDP_PROVIDER` | `auth0`, `okta`, or `entra` |
| `AUTH_SECRET` | Random secret for Auth.js |
| `AUTH_URL` | Your app URL |
| `AUTH0_*` / `OKTA_*` / `ENTRA_*` | IdP credentials |

### Signup

| Variable | Description |
|----------|-------------|
| `SIGNUP_STRATEGY` | `manual` or `highlevel` |
| `SIGNUP_WEBHOOK_URL` | Webhook URL (manual strategy) |
| `GHL_AGENCY_TOKEN` | API token (highlevel strategy) |

---

## 7. Deployment

### Vercel (Recommended)

```bash
# Install dependencies
npm install

# Build
npm run build

# Deploy
vercel --prod
```

### Environment Variables
Set all environment variables in your Vercel project settings.

### Local Development

```bash
# Copy environment template
cp .env.example .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit: http://localhost:3000/login

---

## Troubleshooting

### "Redirect loop" after IdP login
- Verify callback URLs match exactly in your IdP and Auth.js config
- Check that `AUTH_URL` matches your deployment URL

### Users see HighLevel login after SSO
- Ensure HighLevel SSO is configured with the same IdP
- Verify email addresses match between IdP and HighLevel users

### Signup webhook not receiving data
- Verify `SIGNUP_WEBHOOK_URL` is correct
- Check webhook service (Zapier/Make) for errors
- Review server logs for fetch failures
