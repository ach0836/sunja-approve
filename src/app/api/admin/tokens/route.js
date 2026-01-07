import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/server/supabaseClient"

export async function POST(req) {
  try {
    const { token: providedToken, label } = await req.json()
    const token = (providedToken ?? "").trim()

    if (!token) {
      return NextResponse.json({ error: "토큰이 제공되지 않았습니다." }, { status: 400 })
    }

    const client = getSupabaseClient()

    const { data: existing, error: fetchError } = await client
      .from("admin_tokens")
      .select("*")
      .eq("token", token)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "no rows found" which is expected
      throw fetchError
    }

    const payload = {
      label: label ?? existing?.label ?? null,
      lastValidatedAt: new Date().toISOString(),
    }

    if (existing) {
      const { data: updated, error: updateError } = await client
        .from("admin_tokens")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      return NextResponse.json({ success: true, record: updated, created: false })
    }

    const { data: record, error: createError } = await client
      .from("admin_tokens")
      .insert([
        {
          token,
          label: payload.label,
          lastValidatedAt: payload.lastValidatedAt,
        },
      ])
      .select()
      .single()

    if (createError) throw createError
    return NextResponse.json({ success: true, record, created: true })
  } catch (error) {
    console.error("토큰 저장 오류:", error)
    return NextResponse.json({ success: false, detail: error.message }, { status: 500 })
  }
}
