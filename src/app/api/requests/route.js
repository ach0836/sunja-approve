import { NextResponse } from "next/server"
import { REQUEST_STATUS } from "@/lib/constants"
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin"
import { broadcastAdminRequestNotification } from "@/lib/server/adminNotifications"
import { getSupabaseClient } from "@/lib/server/supabaseClient"

export async function GET(req) {
  const client = getSupabaseClient()
  const searchParams = new URL(req.url).searchParams

  // 인증 확인 (관리자용 또는 민감한 필터링이 필요한 경우)
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PASSWORD

  // isApproved 파라미터가 있는 경우 (다운로드 페이지) 또는 관리자용 요청이면 인증 필수
  const isDownloadRequest = searchParams.has("isApproved")
  const requiresAuth = isDownloadRequest

  if (requiresAuth && (!adminPassword || token !== adminPassword)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  let query = client.from("requests").select("*")

  // Apply filters from query params
  for (const [key, value] of searchParams.entries()) {
    if (key === "id") {
      query = query.eq("id", value)
    } else if (key === "status") {
      query = query.eq("status", value)
    } else if (key === "isApproved") {
      query = query.eq("is_approved", value === "true")
    } else if (key === "created_at_gte") {
      query = query.gte("created_at", value)
    } else if (key === "created_at_lte") {
      query = query.lte("created_at", value)
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Query error:", error)
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    )
  }

  return NextResponse.json({ requests: data })
}

export async function POST(req) {
  // IP 주소 가져오기 (프록시 환경일 경우 X-Forwarded-For 사용)
  const ipHeader = req.headers.get("X-Forwarded-For") || ""
  const ip = ipHeader.split(",")[0].trim() || "unknown"

  try {
    const body = await req.json()

    // 입력값 검증
    if (!body.applicant || !Array.isArray(body.applicant) || body.applicant.length === 0) {
      return NextResponse.json(
        { error: "Invalid applicant data" },
        { status: 400 }
      )
    }

    if (typeof body.contact !== "string" || body.contact.length < 5 || body.contact.length > 50) {
      return NextResponse.json(
        { error: "Invalid contact" },
        { status: 400 }
      )
    }

    if (typeof body.reason !== "string" || body.reason.length < 1 || body.reason.length > 500) {
      return NextResponse.json(
        { error: "Invalid reason" },
        { status: 400 }
      )
    }

    if (typeof body.time !== "string" || !body.time.match(/^\d+$/)) {
      return NextResponse.json(
        { error: "Invalid time" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()

    // requests 테이블에 새 레코드 생성
    const { data: record, error } = await client.from("requests").insert([
      {
        applicant: body.applicant,
        contact: body.contact,
        reason: body.reason,
        time: body.time,
        ip,
        fcm: body.fcm || null,
        is_approved: false,
        status: REQUEST_STATUS.PENDING,
      },
    ]).select().single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json(
        { error: "Failed to save request" },
        { status: 500 }
      )
    }

    // 알림 전송은 비동기로 처리하여 응답 속도를 높인다.
    void broadcastAdminRequestNotification(record).catch((notificationError) => {
      console.error("Notification error:", notificationError)
    })

    return NextResponse.json({ success: true, record, notificationsQueued: true })
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function PUT(req) {
  // 간단한 인증 확인
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PASSWORD

  if (!adminPassword || token !== adminPassword) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const searchParams = new URL(req.url).searchParams
    const id = searchParams.get("id")

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      )
    }

    // 업데이트할 필드 제한
    const allowedFields = ["status", "is_approved", "reason"]
    const updateData = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()
    const { data, error } = await client
      .from("requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Update error:", error)
      return NextResponse.json(
        { error: "Failed to update request" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function PATCH(req) {
  // 인증 확인
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PASSWORD

  if (!adminPassword || token !== adminPassword) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const searchParams = new URL(req.url).searchParams
    const id = searchParams.get("id")

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      )
    }

    // 업데이트할 필드 제한
    const allowedFields = ["status", "is_approved", "reason"]
    const updateData = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()
    const { data, error } = await client
      .from("requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Update error:", error)
      return NextResponse.json(
        { error: "Failed to update request" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function DELETE(req) {
  // 인증 확인
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PASSWORD

  if (!adminPassword || token !== adminPassword) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const searchParams = new URL(req.url).searchParams
    const id = searchParams.get("id")

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()
    const { data, error } = await client.from("requests").delete().eq("id", id).select().single()

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json(
        { error: "Failed to delete request" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}
