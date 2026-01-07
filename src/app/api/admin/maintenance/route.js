import path from "node:path"

import { NextResponse } from "next/server"

import {
  backupSupabaseSnapshot,
  synchronizeRequestStatuses,
} from "@/lib/server/supabaseMaintenance"

const ADMIN_PASSWORD = process.env.PASSWORD ?? process.env.ADMIN_PASSWORD

function unauthorizedResponse() {
  return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 })
}

export async function POST(req) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "서버에 PASSWORD 환경 변수가 설정되어 있지 않습니다." },
      { status: 500 },
    )
  }

  try {
    const { action, secret, options = {} } = await req.json()
    if (secret !== ADMIN_PASSWORD) {
      return unauthorizedResponse()
    }

    if (action === "backup") {
      const { filePath, snapshot } = await backupSupabaseSnapshot()
      return NextResponse.json({
        success: true,
        action,
        filename: path.basename(filePath),
        counts: snapshot.counts,
      })
    }

    if (action === "sync-status") {
      const result = await synchronizeRequestStatuses()
      return NextResponse.json({ success: true, action, result })
    }

    return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 })
  } catch (error) {
    console.error("관리자 유지보수 작업 실패:", error)
    return NextResponse.json({ error: "요청 처리 중 오류", detail: error.message }, { status: 500 })
  }
}
