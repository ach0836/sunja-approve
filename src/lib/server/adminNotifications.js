import { checkTokenValidity, sendNotification } from "./fcm"
import { getSupabaseClient } from "./supabaseClient"

export async function broadcastAdminRequestNotification(record) {
  const client = getSupabaseClient()
  const { data: adminTokenRecords, error } = await client.from("admin_tokens").select("*")

  if (error) {
    console.error("Failed to fetch admin tokens:", error)
    return { skipped: true, reason: "database-error", error: error.message }
  }

  const tokenMap = new Map()
  for (const adminToken of adminTokenRecords) {
    const token = adminToken.token?.trim()
    if (!token || tokenMap.has(token)) continue
    tokenMap.set(token, adminToken)
  }

  if (tokenMap.size === 0) {
    return { skipped: true, reason: "no-tokens" }
  }

  const tokenEntries = Array.from(tokenMap.entries())

  const validityResults = await Promise.all(
    tokenEntries.map(async ([token, adminTokenRecord]) => {
      try {
        const { valid } = await checkTokenValidity(token)
        return { token, adminTokenRecord, valid }
      } catch (error) {
        if (error?.errorInfo?.code === "messaging/registration-token-not-registered") {
          return { token, adminTokenRecord, valid: false }
        }
        console.error(`토큰 검사 중 오류 발생 (${token}):`, error)
        return { token, adminTokenRecord, valid: false, error }
      }
    }),
  )

  const validTokens = []
  const invalidTokens = []
  for (const result of validityResults) {
    if (result.valid) {
      validTokens.push(result)
    } else {
      invalidTokens.push(result)
    }
  }

  if (invalidTokens.length) {
    await Promise.all(
      invalidTokens.map(({ adminTokenRecord }) =>
        client.from("admin_tokens").delete().eq("id", adminTokenRecord.id),
      ),
    )
  }

  if (validTokens.length === 0) {
    return { skipped: true, reason: "no-valid-tokens", removed: invalidTokens.length }
  }

  const baseNotification = {
    title: "신청 알림",
    body: "신청이 들어왔습니다",
  }

  const notificationResults = await Promise.allSettled(
    validTokens.map(({ token, adminTokenRecord }) =>
      (async () => {
        try {
          const response = await sendNotification({
            token,
            notification: baseNotification,
            data: { requestId: String(record.id) },
          })

          return { token, id: adminTokenRecord.id, response }
        } catch (error) {
          error.meta = { token, id: adminTokenRecord.id }
          throw error
        }
      })(),
    ),
  )

  const failures = []
  for (const result of notificationResults) {
    if (result.status === "fulfilled") continue
    const error = result.reason
    const { token, id } = error?.meta ?? {}
    failures.push({ token, error })
    if (error?.errorInfo?.code === "messaging/registration-token-not-registered" && id) {
      await client.from("admin_tokens").delete().eq("id", id)
    }
  }

  return {
    skipped: false,
    sent: notificationResults.length - failures.length,
    failures,
    removedInvalid: invalidTokens.length + failures.length,
  }
}
