/**
 * NextAuth.js API Route Handler
 *
 * This handles all authentication-related API routes:
 * - GET /api/auth/signin
 * - POST /api/auth/signin/:provider
 * - GET /api/auth/callback/:provider
 * - GET /api/auth/signout
 * - POST /api/auth/signout
 * - GET /api/auth/session
 * - GET /api/auth/csrf
 * - GET /api/auth/providers
 */
export { GET, POST } from "@/auth"
