import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/server/supabaseClient"

export async function POST(req) {
  try {
    const { token: providedToken, label } = await req.json()
    const token = (providedToken ?? "").trim()

    console.log("관리자 토큰 저장 요청:", { token: token.substring(0, 20) + "...", label })

    if (!token) {
      console.error("토큰이 비어있습니다.")
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
      console.error("기존 토큰 조회 오류:", fetchError)
      throw fetchError
    }

    const payload = {
      label: label ?? existing?.label ?? null,
    }

    if (existing) {
      console.log("기존 토큰 업데이트:", existing.id)
      const { data: updated, error: updateError } = await client
        .from("admin_tokens")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) {
        console.error("토큰 업데이트 오류:", updateError)
        throw updateError
      }
      console.log("토큰 업데이트 성공")
      return NextResponse.json({ success: true, record: updated, created: false })
    }

    console.log("새 토큰 생성")
    const { data: record, error: createError } = await client
      .from("admin_tokens")
      .insert([
        {
          token,
          label: payload.label,
        },
      ])
      .select()
      .single()

    if (createError) {
      console.error("토큰 생성 오류:", createError)
      throw createError
    }
    console.log("토큰 생성 성공:", record.id)
    return NextResponse.json({ success: true, record, created: true })
  } catch (error) {
    console.error("토큰 저장 오류:", error)
    return NextResponse.json({ success: false, detail: error.message }, { status: 500 })
  }
}
