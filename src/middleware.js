import { NextResponse } from "next/server"

/**
 * Security middleware
 * - CORS 정책 설정
 * - Security headers 추가
 * - Request 검증
 */
export function middleware(req) {
    const res = NextResponse.next()

    // Security Headers
    // Prevents clickjacking attacks
    res.headers.set("X-Frame-Options", "DENY")

    // Prevents MIME type sniffing
    res.headers.set("X-Content-Type-Options", "nosniff")

    // Enables XSS protection in older browsers
    res.headers.set("X-XSS-Protection", "1; mode=block")

    // Referrer policy
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

    // Permissions policy (formerly Feature Policy)
    res.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()"
    )

    // CORS headers
    const origin = req.headers.get("origin") || ""
    const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:8080",
        process.env.NEXT_PUBLIC_APP_URL || "",
    ].filter(Boolean)

    if (allowedOrigins.includes(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin)
        res.headers.set(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        )
        res.headers.set(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
        )
        res.headers.set("Access-Control-Max-Age", "86400")
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: res.headers })
    }

    return res
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|public).*)",
    ],
}
