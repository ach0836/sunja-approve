import { NextResponse } from "next/server"
import { REQUEST_STATUS } from "@/lib/constants"
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin"
import { broadcastAdminRequestNotification } from "@/lib/server/adminNotifications"
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
  // IP 주소 가져오기 (프록시 환경일 경우 X-Forwarded-For 사용)
  const ipHeader = req.headers.get("X-Forwarded-For") || ""
  const ip = ipHeader.split(",")[0].trim()

  try {
    const body = await req.json()
    console.log("POST /api/requests body:", body)

    const client = getSupabaseClient()

    // requests 테이블에 새 레코드 생성
    const { data: record, error } = await client.from("requests").insert([
      {
        applicant: body.applicant,
        contact: body.contact,
        reason: body.reason,
        time: body.time,
        ip,
        fcm: body.fcm,
        is_approved: body.isApproved ?? false,
        status: REQUEST_STATUS.PENDING,
      },
    ]).select().single()

    if (error) {
      console.error("Supabase insert error:", error)
      throw error
    }

    console.log("Record created successfully:", record)

    // 알림 전송은 비동기로 처리하여 응답 속도를 높인다.
    void broadcastAdminRequestNotification(record).catch((notificationError) => {
      console.error("알림 처리 중 오류 발생:", notificationError)
    })

    return NextResponse.json({ success: true, record, notificationsQueued: true })
  } catch (error) {
    console.error("신청 저장 및 알림 전송 오류:", error)
    return NextResponse.json(
      {
        error: error?.message || "데이터베이스 오류가 발생했습니다.",
        details: error?.details || error?.toString(),
      },
      { status: 500 },
    )
  }
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
