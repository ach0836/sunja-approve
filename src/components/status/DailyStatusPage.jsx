"use client"

import { useEffect, useMemo, useState } from "react"

import { STUDY_PERIOD_OPTIONS } from "@/lib/constants"

const columns = [
  { key: "name", header: "대표자" },
  { key: "count", header: "총인원" },
]

function groupByStudyPeriod(requests) {
  const groups = STUDY_PERIOD_OPTIONS.reduce((acc, option) => {
    acc[option.value] = []
    return acc
  }, {})

  requests.forEach((request) => {
    const key = String(request.time)
    if (groups[key]) {
      groups[key].push(request)
    }
  })

  return groups
}

async function fetchDailyRequests(status) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()

  // Supabase는 직접 URL 쿼리 파라미터로 필터링
  // created_at이 todayStart와 todayEnd 사이의 요청만 필터링
  const response = await fetch(
    `/api/requests?status=${status}`,
  )

  if (!response.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.")
  }

  const result = await response.json()
  const filtered = result.requests.filter((request) => {
    const createdAt = new Date(request.created_at)
    const startDate = new Date(todayStart)
    const endDate = new Date(todayEnd)
    return createdAt >= startDate && createdAt <= endDate
  })

  return filtered.map((request) => ({
    ...request,
    name: request.applicant?.[0]?.name ?? "N/A",
    count: `${request.applicant?.length ?? 0}명`,
  }))
}

export default function DailyStatusPage({ status, emptyMessage, loadingMessage = "로딩 중..." }) {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [requestsByPeriod, setRequestsByPeriod] = useState({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadRequests = async () => {
      setIsLoading(true)
      try {
        const data = await fetchDailyRequests(status)
        setRequestsByPeriod(groupByStudyPeriod(data))
      } catch (error) {
        console.error("데이터 가져오기 오류:", error)
        setRequestsByPeriod(groupByStudyPeriod([]))
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [status])

  const tables = useMemo(() => {
    return STUDY_PERIOD_OPTIONS.map((option) => ({
      label: `${option.value}교시 신청 목록`,
      data: requestsByPeriod[option.value] ?? [],
    }))
  }, [requestsByPeriod])

  if (!mounted) {
    return <div>로딩 중...</div>
  }

  return (
    <main className="min-h-screen bg-base-200 py-10">
      <div className="container mx-auto space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-base-content">당일 승인 현황</h1>
          <p className="text-sm text-base-content/60">교시별 승인된 신청 목록을 확인하세요.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {tables.map((slide) => (
            <div key={slide.label} className="card bg-base-100 shadow-md">
              <div className="card-body space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-base-content">{slide.label}</h2>
                  <p className="text-sm text-base-content/60">
                    승인된 대표자와 인원 정보를 제공합니다.
                  </p>
                </div>
                {isLoading ? (
                  <p>{loadingMessage}</p>
                ) : slide.data.length === 0 ? (
                  <p>{emptyMessage}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra text-sm">
                      <thead>
                        <tr>
                          {columns.map((column) => (
                            <th key={column.key} className="uppercase text-xs text-base-content/70">
                              {column.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.data.map((row) => (
                          <tr key={row.id}>
                            {columns.map((column) => (
                              <td key={column.key}>{row[column.key]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
