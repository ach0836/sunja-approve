import { promises as fs } from "node:fs"
import path from "node:path"

import { REQUEST_STATUS } from "../constants.js"
import { runSupabaseOperation } from "./supabaseClient.js"

const BACKUP_DIR = path.join(process.cwd(), "backups")
const ALLOWED_STATUSES = new Set(Object.values(REQUEST_STATUS))

export async function backupSupabaseSnapshot() {
    const client = (await import("./supabaseClient.js")).getSupabaseClient()

    const [requestsRes, adminTokensRes] = await Promise.all([
        client.from("requests").select("*"),
        client.from("admin_tokens").select("*"),
    ])

    if (requestsRes.error) throw requestsRes.error
    if (adminTokensRes.error) throw adminTokensRes.error

    const snapshot = {
        exportedAt: new Date().toISOString(),
        counts: {
            requests: requestsRes.data?.length ?? 0,
            adminTokens: adminTokensRes.data?.length ?? 0,
        },
        requests: requestsRes.data ?? [],
        adminTokens: adminTokensRes.data ?? [],
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filePath = path.join(BACKUP_DIR, `supabase-backup-${timestamp}.json`)
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8")

    return { filePath, snapshot }
}

function normalizeStatus(value) {
    if (typeof value !== "string") {
        return undefined
    }
    return value.toLowerCase()
}

export async function synchronizeRequestStatuses() {
    const client = (await import("./supabaseClient.js")).getSupabaseClient()

    const { data: requests, error } = await client.from("requests").select("*")
    if (error) throw error

    let updated = 0
    const changes = []

    for (const request of requests) {
        const normalizedStatus = normalizeStatus(request.status)
        const isApprovedBoolean = request.is_approved === true
        let desiredStatus = normalizedStatus

        if (!ALLOWED_STATUSES.has(normalizedStatus)) {
            desiredStatus = isApprovedBoolean ? REQUEST_STATUS.APPROVED : REQUEST_STATUS.PENDING
        }

        const updatePayload = {}

        if (desiredStatus !== normalizedStatus) {
            updatePayload.status = desiredStatus
        }

        if (desiredStatus === REQUEST_STATUS.APPROVED && !isApprovedBoolean) {
            updatePayload.is_approved = true
        } else if (desiredStatus !== REQUEST_STATUS.APPROVED && request.is_approved !== false) {
            updatePayload.is_approved = false
        } else if (typeof request.is_approved !== "boolean" && updatePayload.is_approved === undefined) {
            updatePayload.is_approved = isApprovedBoolean
        }

        if (Object.keys(updatePayload).length === 0) {
            continue
        }

        const { error: updateError } = await client
            .from("requests")
            .update(updatePayload)
            .eq("id", request.id)

        if (updateError) throw updateError

        updated += 1
        changes.push({ id: request.id, update: updatePayload })
    }

    return {
        total: requests.length,
        updated,
        skipped: requests.length - updated,
        changes,
    }
}
