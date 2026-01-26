import { NextResponse } from "next/server"
import { signupSchema } from "@/lib/validation"
import {
  createHighLevelLocation_TODO,
  createHighLevelUser_TODO
} from "@/lib/highlevel"

/**
 * POST /api/signup
 *
 * Handles new account registration requests.
 *
 * Supports two strategies:
 * - "manual": Sends data to webhook for manual processing (safer, recommended)
 * - "highlevel": Automated provisioning via HighLevel API (requires verification)
 */
export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = signupSchema.safeParse(json)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input"
      return NextResponse.json({ message: firstError }, { status: 400 })
    }

    const { firstName, lastName, email } = parsed.data
    const strategy = process.env.SIGNUP_STRATEGY ?? "manual"

    // =========================================
    // OPTION 1: Manual Processing (Recommended)
    // =========================================
    if (strategy === "manual") {
      const webhookUrl = process.env.SIGNUP_WEBHOOK_URL

      if (!webhookUrl) {
        console.error("SIGNUP_WEBHOOK_URL is not configured")
        return NextResponse.json(
          { message: "Signup is not configured. Please contact support." },
          { status: 500 }
        )
      }

      // Send signup data to webhook (Zapier/Make/n8n)
      // No passwords are sent - authentication is handled by HighLevel/IdP
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          source: "neutropy.ai/create-account",
          timestamp: new Date().toISOString()
        })
      })

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text()
        console.error("Signup webhook failed:", errorText)
        return NextResponse.json(
          { message: "Unable to process signup. Please try again later." },
          { status: 502 }
        )
      }

      return NextResponse.json({
        message:
          "Request received! We'll set up your workspace and send your invite shortly."
      })
    }

    // ==========================================
    // OPTION 2: Automated HighLevel Provisioning
    // ==========================================
    if (strategy === "highlevel") {
      // WARNING: This path requires:
      // 1. Valid GHL_AGENCY_TOKEN environment variable
      // 2. Verified API endpoint payloads (marked as TODO in lib/highlevel.ts)
      // 3. Agency Pro plan or higher for location creation

      // Step 1: Create Location (Sub-Account)
      const locationResult = await createHighLevelLocation_TODO({
        name: `${firstName} ${lastName}`.trim() || email,
        companyEmail: email
      })

      // Extract location ID from response
      // TODO: VERIFY the actual response shape from HighLevel API
      const locationId =
        (locationResult as Record<string, unknown>)?.id ??
        (locationResult as Record<string, unknown>)?.locationId

      if (!locationId || typeof locationId !== "string") {
        console.error(
          "HighLevel location created but no locationId found:",
          locationResult
        )
        return NextResponse.json(
          {
            message:
              "Account setup in progress. Please check your email for next steps."
          },
          { status: 500 }
        )
      }

      // Step 2: Create User for the Location
      await createHighLevelUser_TODO({
        locationId,
        firstName,
        lastName,
        email
      })

      return NextResponse.json({
        message:
          "Your workspace is ready! Check your email for your invite to access Neutropy."
      })
    }

    // Unknown strategy
    console.error("Unknown SIGNUP_STRATEGY:", strategy)
    return NextResponse.json(
      { message: "Signup configuration error. Please contact support." },
      { status: 500 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred"
    return NextResponse.json({ message }, { status: 500 })
  }
}
