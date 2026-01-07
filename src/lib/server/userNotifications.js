import { sendNotification } from "./fcm"
import { getSupabaseClient } from "./supabaseClient"

export async function sendApprovalNotification(requestId, isApproved) {
  const client = getSupabaseClient()
  const { data: record, error } = await client.from("requests").select("*").eq("id", requestId).single()

  if (error || !record) {
    return { success: false, error: "record-not-found" }
  }

  const fcmToken = record.fcm
  if (!fcmToken) {
    return { success: true, skipped: true, reason: "missing-fcm-token" }
  }

  const approvedStatus = Boolean(isApproved)
  const messageTitle = approvedStatus ? "신청 승인" : "신청 거부"
  const messageBody = approvedStatus
    ? "이 알림을 클릭해 PDF를 달라고 하세요."
    : "당신의 신청이 거부되었습니다."

  const response = await sendNotification({
    token: fcmToken,
    notification: {
      title: messageTitle,
      body: messageBody,
    },
    webpush: {
      fcmOptions: {
        link: "",
      },
    },
  })

  return { success: true, response, approvedStatus }
}
