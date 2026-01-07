import { NextResponse } from "next/server"
import crypto from "crypto"

// Rate limiting을 위한 간단한 메모리 저장소 (프로덕션에서는 Redis 사용)
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 900000 // 15분
const CLEANUP_INTERVAL = 3600000 // 1시간마다 정리

// 정기적으로 오래된 데이터 정리
setInterval(() => {
  const now = Date.now()
  for (const [key, attempts] of loginAttempts.entries()) {
    const recentAttempts = attempts.filter((time) => now - time < WINDOW_MS)
    if (recentAttempts.length === 0) {
      loginAttempts.delete(key)
    } else {
      loginAttempts.set(key, recentAttempts)
    }
  }
}, CLEANUP_INTERVAL)

function checkRateLimit(ip, maxAttempts = MAX_ATTEMPTS, windowMs = WINDOW_MS) {
  const now = Date.now()
  const key = ip

  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, [])
  }

  const attempts = loginAttempts.get(key)
  const recentAttempts = attempts.filter((time) => now - time < windowMs)

  if (recentAttempts.length >= maxAttempts) {
    return false
  }

  recentAttempts.push(now)
  loginAttempts.set(key, recentAttempts)
  return true
}

// 안전한 비밀번호 비교 (timing attack 방지)
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(req) {
  const adminPassword = process.env.PASSWORD ?? process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error("Admin password not configured")
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    )
  }

  // Rate limiting 확인
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"

  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    )
  }

  try {
    const contentType = req.headers.get("content-type") || ""
    let provided

    if (contentType.includes("application/json")) {
      const body = await req.json()
      provided = body.password
    } else {
      provided = await req.text()
    }

    if (!provided || typeof provided !== "string") {
      return NextResponse.json(
        { error: "Invalid password format" },
        { status: 400 }
      )
    }

    // 안전한 비교
    let isValid = false
    try {
      isValid = secureCompare(provided, adminPassword)
    } catch {
      // 길이가 다르면 false 반환
      isValid = false
    }

    return NextResponse.json({ success: isValid })
  } catch (error) {
    console.error("Auth error")
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}
