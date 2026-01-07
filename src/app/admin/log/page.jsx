"use client"

import { useCallback, useEffect, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/toast/ToastProvider"
import { transformRequest } from "@/lib/admin/requests"
import AdminTableLayout from "@/components/admin/AdminTableLayout"
import PaginationControls from "@/components/admin/PaginationControls"

// 테이블 열 정의
const columns = (onShowApplicants) => [
  {
    accessorKey: "name",
    header: "대표자",
  },
  {
    accessorKey: "contact",
    header: "전화번호",
  },
  {
    accessorKey: "count",
    header: "총인원",
  },
  {
    accessorKey: "time",
    header: "신청교시",
  },
  {
    accessorKey: "reason",
    header: "사유",
  },
  {
    accessorKey: "status",
    header: "승인 상태",
    cell: ({ row }) => (row.original.isApproved ? "승인" : "미승인"),
  },
  {
    accessorKey: "ip",
    header: "IP 주소",
  },
  {
    accessorKey: "createdAt",
    header: "신청일",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: "details",
    header: "총신청자",
    cell: ({ row }) => (
      <button
        type="button"
        className="btn btn-soft btn-primary btn-xs"
        onClick={() => onShowApplicants(row.original.applicant)}
      >
        더보기
      </button>
    ),
  },
]

const DataTable = ({ table, data, isLoading, handlePreviousPage, handleNextPage, router }) => (
  <AdminTableLayout
    isLoading={isLoading}
    isEmpty={!data || data.length === 0}
    emptyMessage="신청 목록이 없습니다."
    footer={
      <button
        type="button"
        className="btn btn-outline flex-1"
        onClick={() => router.push("/admin")}
      >
        홈으로 돌아가기
      </button>
    }
  >
    <div className="overflow-x-auto rounded-xl border border-base-200">
      <table className="table table-zebra">
        <thead className="bg-base-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="text-sm font-semibold text-base-content">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="align-top text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <PaginationControls
      onPrevious={handlePreviousPage}
      onNext={handleNextPage}
      canPrevious={!isLoading && table.getCanPreviousPage()}
      canNext={!isLoading && table.getCanNextPage()}
      pageLabel={`${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()}`}
    />
  </AdminTableLayout>
)

export default function Homeadmin() {
  const router = useRouter()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const toast = useToast()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/requests")

      if (!response.ok) {
        throw new Error("데이터를 가져오는 중 네트워크 오류가 발생했습니다.")
      }

      const result = await response.json()

      if (!result.requests) {
        throw new Error("서버에서 요청 데이터를 받지 못했습니다.")
      }

      // applicant 배열이 존재하는지, 첫 번째 요소가 있는지 확인
      const transformedData = result.requests
        .map(transformRequest)
        .map((request) => ({ ...request, ip: request.ip ?? "N/A" }))
        .reverse()

      setData(transformedData)
    } catch (error) {
      console.error("데이터 가져오기 오류:", error)
      toast.error(`데이터 가져오기 중 오류 발생: ${error.message}`)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [toast.error])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const table = useReactTable({
    data,
    columns: columns((applicants = []) => {
      if (!applicants.length) return
      const text = applicants
        .map((applicant) => `${applicant.name} (${applicant.number})`)
        .join("\n")
      toast.addToast({
        title: "신청자 목록",
        content: <p className="whitespace-pre-wrap text-sm leading-snug">{text}</p>,
        variant: "info",
        duration: 5000,
      })
    }),
    pageCount: Math.ceil(data.length / 8),
    state: {
      pagination: { pageIndex, pageSize: 8 },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleNextPage = () => {
    setPageIndex((prev) => Math.min(prev + 1, table.getPageCount() - 1))
  }

  const handlePreviousPage = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0))
  }

  return (
    <main className="min-h-screen bg-base-200 py-10">
      <div className="container mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-base-content">신청 전체 로그</h1>
          <p className="text-sm text-base-content/70">
            승인 여부와 사유, 접속 IP까지 한 번에 확인할 수 있습니다.
          </p>
        </div>
        <DataTable
          table={table}
          data={data}
          isLoading={isLoading}
          handlePreviousPage={handlePreviousPage}
          handleNextPage={handleNextPage}
          router={router}
        />
      </div>
    </main>
  )
}
