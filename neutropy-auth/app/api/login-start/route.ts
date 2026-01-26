import { NextResponse } from "next/server"

/**
 * POST /api/login-start
 *
 * Optional endpoint for Mode B IdP flow initialization.
 *
 * In most cases, login starts on the client via Auth.js redirect.
 * This endpoint is provided for parity with the spec and can be extended
 * for custom login flow requirements (e.g., email-based IdP routing).
 */
export async function POST(request: Request) {
  try {
    const json = await request.json()
    const email = json?.email

    // Future enhancement: Route to different IdPs based on email domain
    // Example: @company.com -> Okta, @partner.com -> Entra

    return NextResponse.json({
      ok: true,
      message: "Login flow can be started via /api/auth/signin",
      hint: email
        ? `For ${email}, use the configured IdP`
        : "Provide email for IdP routing"
    })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
