import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/server/supabaseClient"

export async function GET(req) {
  const client = getSupabaseClient()
  const searchParams = new URL(req.url).searchParams

  let query = client.from("requests").select("*")

  // Apply filters from query params
  for (const [key, value] of searchParams.entries()) {
    if (key === "id") {
      query = query.eq("id", value)
    } else if (key === "status") {
      query = query.eq("status", value)
    } else if (key === "isApproved") {
      query = query.eq("is_approved", value === "true")
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data })
}

export async function POST(req) {
  const body = await req.json()
  const client = getSupabaseClient()

  const { data, error } = await client.from("requests").insert([body]).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(req) {
  const body = await req.json()
  const searchParams = new URL(req.url).searchParams
  const id = searchParams.get("id")

  const client = getSupabaseClient()
  const { data, error } = await client
    .from("requests")
    .upsert({ ...body, id }, { onConflict: "id" })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req) {
  const body = await req.json()
  const searchParams = new URL(req.url).searchParams
  const id = searchParams.get("id")

  const client = getSupabaseClient()
  const { data, error } = await client
    .from("requests")
    .update(body)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req) {
  const searchParams = new URL(req.url).searchParams
  const id = searchParams.get("id")

  const client = getSupabaseClient()
  const { data, error } = await client.from("requests").delete().eq("id", id).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
