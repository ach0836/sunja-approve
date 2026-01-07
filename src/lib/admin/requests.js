import { PREMIUM_MEMBER_NAMES, REQUEST_STATUS, STUDY_PERIOD_OPTIONS } from "@/lib/constants"

export const isPremiumMember = (name) => PREMIUM_MEMBER_NAMES.includes(name)

export function formatCreatedTime(rawRequest) {
  const createdDate = new Date(rawRequest.created_at ?? Date.now())
  return isPremiumMember(rawRequest.applicant?.[0]?.name)
    ? "08:30"
    : `${String(createdDate.getHours()).padStart(2, "0")}:${String(createdDate.getMinutes()).padStart(2, "0")}`
}

export function transformRequest(rawRequest) {
  const timeValue = String(rawRequest.time ?? "")
  return {
    id: rawRequest.id,
    ...rawRequest,
    name: rawRequest.applicant?.[0]?.name ?? "N/A",
    contact: rawRequest.contact ?? "N/A",
    count: `${rawRequest.applicant?.length ?? 0}명`,
    time: `${timeValue}교시`,
    timeValue,
    reason: rawRequest.reason ?? "",
    status: rawRequest.status ?? REQUEST_STATUS.REJECTED,
    is_approved: rawRequest.is_approved ?? false,
    createdTime: formatCreatedTime(rawRequest),
  }
}

export function sortRequestsForReview(requests) {
  return [...requests].sort((a, b) => {
    const aSpecial = isPremiumMember(a.name)
    const bSpecial = isPremiumMember(b.name)
    if (aSpecial && !bSpecial) return -1
    if (bSpecial && !aSpecial) return 1
    return new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0)
  })
}

export function buildDailyQueryString() {
  const start = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const end = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()

  return {
    filter: `created_at.gte.${start},created_at.lte.${end}`,
  }
}

export function mapRequestsByPeriod(requests) {
  const periods = STUDY_PERIOD_OPTIONS.reduce((acc, option) => {
    acc[option.value] = []
    return acc
  }, {})

  requests.forEach((request) => {
    const key = request.timeValue ?? String(request.time).replace("교시", "")
    if (periods[key]) {
      periods[key].push(request)
    }
  })

  return periods
}

export function findEarlierPendingRequests(currentRequest, allRequests) {
  if (isPremiumMember(currentRequest.name)) {
    return []
  }

  return allRequests.filter((request) => {
    if (request.id === currentRequest.id) return false
    const sameTime =
      (request.timeValue ?? request.time) === (currentRequest.timeValue ?? currentRequest.time)
    if (!sameTime) return false
    if (request.is_approved) return false

    const currentCreatedAt = new Date(currentRequest.created_at ?? 0)
    const comparedCreatedAt = new Date(request.created_at ?? 0)

    return comparedCreatedAt < currentCreatedAt
  })
}
