import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/server/supabaseClient"

// 관리자 API 인증 확인
function verifyAdminAuth(req) {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PASSWORD

  if (!adminPassword || token !== adminPassword) {
    return false
  }
  return true
}

// 입력값 검증
function validateToken(token) {
  if (typeof token !== "string") return false
  if (token.length < 100 || token.length > 300) return false
  return /^[a-zA-Z0-9_-]+$/.test(token)
}

export async function POST(req) {
  // 관리자 인증 확인
  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { token: providedToken, label } = await req.json()
    const token = (providedToken ?? "").trim()

    // 토큰 검증
    if (!validateToken(token)) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 400 }
      )
    }

    // Label 검증
    if (label !== null && label !== undefined && typeof label !== "string") {
      return NextResponse.json(
        { error: "Invalid label" },
        { status: 400 }
      )
    }

    if (label && label.length > 100) {
      return NextResponse.json(
        { error: "Label too long" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()

    const { data: existing, error: fetchError } = await client
      .from("admin_tokens")
      .select("id, token, label")
      .eq("token", token)
      .maybeSingle()

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Database error:", fetchError)
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      )
    }

    const payload = {
      label: label ?? existing?.label ?? null,
    }

    if (existing) {
      const { data: updated, error: updateError } = await client
        .from("admin_tokens")
        .update(payload)
        .eq("id", existing.id)
        .select("id, created_at")
        .single()

      if (updateError) {
        console.error("Update error:", updateError)
        return NextResponse.json(
          { error: "Failed to update token" },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, created: false })
    }

    const { data: record, error: createError } = await client
      .from("admin_tokens")
      .insert([{ token, label: payload.label }])
      .select("id, created_at")
      .single()

    if (createError) {
      console.error("Insert error:", createError)
      return NextResponse.json(
        { error: "Failed to create token" },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, created: true })
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}
