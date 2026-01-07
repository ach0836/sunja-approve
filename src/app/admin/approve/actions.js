"use server"

import { revalidatePath } from "next/cache"

import { REQUEST_STATUS } from "@/lib/constants"
import { getSupabaseClient } from "@/lib/server/supabaseClient"
import { sendApprovalNotification } from "@/lib/server/userNotifications"

export async function updateRequestStatusAction(requestId, isApproved) {
  const status = isApproved ? REQUEST_STATUS.APPROVED : REQUEST_STATUS.REJECTED

  const client = getSupabaseClient()
  const { data: updatedRecord, error } = await client
    .from("requests")
    .update({ is_approved: isApproved, status })
    .eq("id", requestId)
    .select()
    .single()

  if (error) {
    throw new Error(`Request update failed: ${error.message}`)
  }

  if (!updatedRecord) {
    throw new Error("Request update failed")
  }

  const notification = await sendApprovalNotification(requestId, isApproved)
  revalidatePath("/admin/approve")
  revalidatePath("/admin/status")
  revalidatePath("/admin/statusfalse")
  revalidatePath("/admin/statuspending")
  const recordPlain = structuredClone(updatedRecord)
  const notificationPlain = notification ? structuredClone(notification) : null
  return { record: recordPlain, notification: notificationPlain }
}

export async function deleteRequestAction(requestId) {
  const client = getSupabaseClient()
  const { error } = await client.from("requests").delete().eq("id", requestId)

  if (error) {
    throw new Error(`Request delete failed: ${error.message}`)
  }

  revalidatePath("/admin/approve")
  revalidatePath("/admin/status")
  revalidatePath("/admin/statusfalse")
  revalidatePath("/admin/statuspending")
  return { success: true }
}
