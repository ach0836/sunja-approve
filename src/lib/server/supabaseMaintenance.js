import { getSupabaseClient } from "./supabaseClient"
import { REQUEST_STATUS } from "@/lib/constants"

/**
 * Backup Supabase 데이터베이스의 스냅샷
 * @returns {Promise<{filePath: string, snapshot: Object}>}
 */
export async function backupSupabaseSnapshot() {
    const client = getSupabaseClient()

    try {
        // requests 테이블의 모든 데이터를 가져오기
        const { data: requests, error: requestsError } = await client
            .from("requests")
            .select("*")

        if (requestsError) {
            throw new Error(`요청 데이터 백업 실패: ${requestsError.message}`)
        }

        // 스냅샷 생성
        const snapshot = {
            timestamp: new Date().toISOString(),
            counts: {
                total_requests: requests?.length || 0,
                approved: requests?.filter(r => r.is_approved === true).length || 0,
                rejected: requests?.filter(r => r.is_approved === false).length || 0,
                pending: requests?.filter(r => r.is_approved === null).length || 0,
            },
            data: {
                requests: requests || [],
            },
        }

        // 파일 경로 (실제 저장은 외부 스토리지를 사용할 수 있음)
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
        const filePath = `backups/supabase-snapshot-${timestamp}.json`

        return {
            filePath,
            snapshot,
        }
    } catch (error) {
        console.error("백업 중 오류:", error)
        throw error
    }
}

/**
 * Firebase와 Supabase의 요청 상태 동기화
 * @returns {Promise<Object>}
 */
export async function synchronizeRequestStatuses() {
    const client = getSupabaseClient()

    try {
        // Supabase에서 모든 요청 가져오기
        const { data: requests, error } = await client
            .from("requests")
            .select("*")

        if (error) {
            throw new Error(`요청 데이터 조회 실패: ${error.message}`)
        }

        // 상태 동기화 로직
        const results = {
            total: requests?.length || 0,
            updated: 0,
            errors: [],
        }

        // 각 요청의 상태 검증 및 필요시 수정
        for (const request of requests || []) {
            try {
                // 상태 검증
                const validStatuses = Object.values(REQUEST_STATUS)
                if (!validStatuses.includes(request.status)) {
                    // 잘못된 상태이면 정정
                    const correctedStatus = request.is_approved
                        ? REQUEST_STATUS.APPROVED
                        : REQUEST_STATUS.REJECTED

                    const { error: updateError } = await client
                        .from("requests")
                        .update({ status: correctedStatus })
                        .eq("id", request.id)

                    if (updateError) {
                        results.errors.push({
                            id: request.id,
                            error: updateError.message,
                        })
                    } else {
                        results.updated++
                    }
                }
            } catch (err) {
                results.errors.push({
                    id: request.id,
                    error: err.message,
                })
            }
        }

        return results
    } catch (error) {
        console.error("동기화 중 오류:", error)
        throw error
    }
}
