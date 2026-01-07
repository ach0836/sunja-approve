"use client"

import { useEffect, useMemo, useState } from "react"

import { mapRequestsByPeriod, transformRequest } from "@/lib/admin/requests"
import { STUDY_PERIOD_OPTIONS } from "@/lib/constants"

async function fetchAdminRequests(status) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()

  const response = await fetch(`/api/requests?status=${status}`)
  if (!response.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.")
  }
  const result = await response.json()
  return result.requests
    .filter((request) => {
      const createdAt = new Date(request.created_at)
      const startDate = new Date(todayStart)
      const endDate = new Date(todayEnd)
      return createdAt >= startDate && createdAt <= endDate
    })
    .map(transformRequest)
}

const columns = [
  { key: "name", header: "대표자" },
  { key: "contact", header: "전화번호" },
  { key: "reason", header: "사유" },
  { key: "count", header: "총인원" },
]

export default function AdminDailyStatusPage({
  status,
  emptyMessage,
  loadingMessage = "로딩 중...",
}) {
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
        const data = await fetchAdminRequests(status)
        setRequestsByPeriod(mapRequestsByPeriod(data))
      } catch (error) {
        console.error("관리자 데이터 가져오기 오류:", error)
        setRequestsByPeriod(mapRequestsByPeriod([]))
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [status])

  const slides = useMemo(() => {
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
          <h1 className="text-2xl font-bold text-base-content">관리자 승인 현황</h1>
          <p className="text-sm text-base-content/60">
            승인된 신청의 대표자 연락처와 사유를 확인하세요.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {slides.map((slide) => (
            <div key={slide.label} className="card bg-base-100 shadow-md">
              <div className="card-body space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-base-content">{slide.label}</h2>
                  <p className="text-sm text-base-content/60">
                    승인된 팀의 연락처와 신청 사유를 한눈에 볼 수 있습니다.
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
