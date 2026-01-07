import { createClient } from "@supabase/supabase-js"

let instance

/**
 * @returns {ReturnType<typeof createClient>}
 */
export const getSupabaseClient = (options = {}) => {
    if (instance) return instance

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error(
            `Missing Supabase environment variables:\n` +
            `SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}\n` +
            `SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? "✓" : "✗"}`
        )
    }

    instance = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
        },
        ...options,
    })

    return instance
}

/**
 * Execute a Supabase operation with automatic retry on auth errors
 * @param {(client: ReturnType<typeof createClient>) => Promise<any>} operation
 * @param {object} options
 * @param {number} options.retries - Number of retries for failed operations
 * @returns {Promise<any>}
 */
export async function runSupabaseOperation(operation, { retries = 1 } = {}) {
    let attempt = 0
    let client = getSupabaseClient()
    let lastError

    while (attempt <= retries) {
        try {
            return await operation(client)
        } catch (error) {
            lastError = error

            // Check if it's an auth error
            if (error?.status === 401 || error?.message?.includes("invalid")) {
                // Reset the client instance on auth error
                instance = null
                client = getSupabaseClient()
                attempt++

                if (attempt > retries) {
                    throw lastError
                }

                // Wait a bit before retrying
                await new Promise((resolve) => setTimeout(resolve, 100))
            } else {
                // For non-auth errors, throw immediately
                throw error
            }
        }
    }

    throw lastError
}
