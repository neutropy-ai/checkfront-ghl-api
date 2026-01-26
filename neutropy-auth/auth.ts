import NextAuth from "next-auth"
import Auth0 from "next-auth/providers/auth0"
import Okta from "next-auth/providers/okta"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { config as appConfig } from "@/lib/config"

/**
 * Validate redirect URLs to prevent open redirect vulnerabilities
 * Only allows redirects to:
 * - Same origin (neutropy.ai)
 * - HighLevel whitelabel app domain (app.neutropy.ai)
 */
function validateRedirectUrl(url: string, baseUrl: string): string {
  try {
    const targetUrl = new URL(url, baseUrl)
    const baseOrigin = new URL(baseUrl).origin
    const ghlOrigin = new URL(appConfig.ghlAppUrl).origin

    const allowedOrigins = new Set([baseOrigin, ghlOrigin])

    if (allowedOrigins.has(targetUrl.origin)) {
      return targetUrl.toString()
    }

    // Fallback to base URL if redirect is not allowed
    return baseUrl
  } catch {
    return baseUrl
  }
}

/**
 * Identity Provider configuration
 *
 * Supported providers:
 * - auth0: Auth0 (recommended, well-documented HighLevel integration)
 * - okta: Okta (enterprise-grade)
 * - entra: Microsoft Entra ID (for Microsoft-centric organizations)
 */
const providerKey = (process.env.IDP_PROVIDER ?? "auth0") as keyof typeof providers

const providers = {
  auth0: Auth0({
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    issuer: process.env.AUTH0_ISSUER
  }),
  okta: Okta({
    clientId: process.env.OKTA_CLIENT_ID!,
    clientSecret: process.env.OKTA_CLIENT_SECRET!,
    issuer: process.env.OKTA_ISSUER
  }),
  entra: MicrosoftEntraID({
    clientId: process.env.ENTRA_CLIENT_ID!,
    clientSecret: process.env.ENTRA_CLIENT_SECRET!,
    issuer: process.env.ENTRA_ISSUER
  })
} as const

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [providers[providerKey] ?? providers.auth0],

  pages: {
    signIn: "/login",
    error: "/login" // Redirect to login on error
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60 // 24 hours
  },

  callbacks: {
    /**
     * Redirect callback - validates and sanitizes redirect URLs
     */
    async redirect({ url, baseUrl }) {
      return validateRedirectUrl(url, baseUrl)
    },

    /**
     * JWT callback - can be extended to include additional claims
     */
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.provider = account.provider
      }
      return token
    },

    /**
     * Session callback - expose necessary data to client
     */
    async session({ session, token }) {
      return {
        ...session,
        provider: token.provider
      }
    }
  }
})

export { handlers as GET, handlers as POST }
