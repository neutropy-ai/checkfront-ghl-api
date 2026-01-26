/**
 * HighLevel API Integration
 *
 * IMPORTANT NOTES:
 * - HighLevel publishes API v2 docs at marketplace.gohighlevel.com/docs
 * - Base URL for many v2 endpoints is https://services.leadconnectorhq.com
 * - "Create Sub-Account (Location)" exists as POST /locations/ and is plan-gated (Agency Pro)
 * - "Create User" exists as POST /users/
 *
 * CRITICAL:
 * - This file intentionally marks payloads as TODO placeholders
 * - VERIFY all endpoint paths and payload shapes in official HighLevel API docs before production use
 * - HighLevel has announced changes affecting API key generation; prefer OAuth/private integration approaches
 */

const BASE_URL = "https://services.leadconnectorhq.com"

/**
 * Get required environment variable or throw
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Create a new HighLevel Location (Sub-Account)
 *
 * TODO: VERIFY required payload fields in official HighLevel API docs before enabling
 *
 * @see https://marketplace.gohighlevel.com/docs (API v2 documentation)
 */
export async function createHighLevelLocation_TODO(input: {
  name: string
  companyEmail: string
}): Promise<unknown> {
  const token = requireEnv("GHL_AGENCY_TOKEN")

  // TODO: VERIFY required payload fields in official docs
  // Common fields may include: name, companyId, address, timezone, settings, etc.
  const payload = {
    name: input.name,
    email: input.companyEmail
    // Add other required fields after verifying docs
  }

  const response = await fetch(`${BASE_URL}/locations/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Version: "2021-07-28" // VERIFY: Check current API version
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `HighLevel create location failed: ${response.status} ${errorText}`
    )
  }

  return response.json()
}

/**
 * Create a new HighLevel User for a Location
 *
 * TODO: VERIFY required payload fields in official HighLevel API docs before enabling
 *
 * @see https://marketplace.gohighlevel.com/docs (API v2 documentation)
 */
export async function createHighLevelUser_TODO(input: {
  locationId: string
  firstName: string
  lastName: string
  email: string
}): Promise<unknown> {
  const token = requireEnv("GHL_AGENCY_TOKEN")

  // TODO: VERIFY required payload fields in official docs
  // Common fields may include: role, permissions, phone, etc.
  const payload = {
    locationId: input.locationId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    type: "account" // VERIFY: Check valid user types
    // Add other required fields after verifying docs
  }

  const response = await fetch(`${BASE_URL}/users/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Version: "2021-07-28" // VERIFY: Check current API version
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `HighLevel create user failed: ${response.status} ${errorText}`
    )
  }

  return response.json()
}
