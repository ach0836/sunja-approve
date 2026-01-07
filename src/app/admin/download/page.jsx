"use client"

import { useCallback, useEffect, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "react-responsive"
import { useToast } from "@/components/toast/ToastProvider"
import { transformRequest } from "@/lib/admin/requests"
import AdminTableLayout from "@/components/admin/AdminTableLayout"
import PaginationControls from "@/components/admin/PaginationControls"

// pdf-lib와 downloadjs를 사용하여 템플릿 PDF를 불러와 데이터를 채워 다운로드하는 함수
import { PDFDocument, rgb } from "pdf-lib"
import download from "downloadjs"
import fontkit from "@pdf-lib/fontkit"
// 날짜 문자열을 파싱하여 { month, day } 객체로 반환하는 함수
const formatDateParts = (dateStr) => {
  if (!dateStr) return { month: "월", day: "일" }

  const dateObj = new Date(dateStr)
  if (Number.isNaN(dateObj.getTime())) return { month: "오류", day: "오류" }

  // 금요일인 경우, 해당 주의 일요일 날짜로 조정
  if (dateObj.getDay() === 5) {
    dateObj.setDate(dateObj.getDate() + 2) // 일요일은 금요일보다 이틀 뒤
  }

  const month = dateObj.getMonth() + 1
  const day = dateObj.getDate()
  return { month, day }
}

// ─── 사용하지 않는 함수들 제거됨 ─────────────────────────────

// ─── 템플릿 PDF에 데이터를 채워 다운로드하는 함수 ─────────────────────────────
const downloadTemplatePDF = async (rowData) => {
  // 템플릿 PDF 파일을 public 폴더에서 불러오기 (경로 조정 필요)
  const existingPdfBytes = await fetch("/sunja.pdf").then((res) => res.arrayBuffer())

  // PDFDocument 생성 및 fontkit 등록
  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  pdfDoc.registerFontkit(fontkit)

  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  // width 변수 사용하지 않으므로 제거
  const { height } = firstPage.getSize()

  // 한글 텍스트를 출력하기 위해 public 폴더에 위치한 NanumGothic.ttf 파일을 불러와 임베드
  const fontBytes = await fetch("/malgun.ttf").then((res) => res.arrayBuffer())
  const customFont = await pdfDoc.embedFont(fontBytes)

  // created_at에서 월, 일을 분리해서 추출
  const { month, day } = formatDateParts(rowData.created_at)

  // 예시: 월과 일을 각각 다른 좌표에 출력 (좌표는 템플릿에 맞게 조정)
  firstPage.drawText(`${month}`, {
    x: 430,
    y: height - 155,
    size: 15,
    font: customFont,
    color: rgb(0, 0, 0),
  })
  firstPage.drawText(`${day}`, {
    x: 475,
    y: height - 155,
    size: 15,
    font: customFont,
    color: rgb(0, 0, 0),
  })

  // 사용시간과 사유 추가
  firstPage.drawText(`야자 ${rowData.timeValue ?? rowData.time} 교시`, {
    x: 280,
    y: height - 193,
    size: 20,
    font: customFont,
    color: rgb(0, 0, 0),
  })
  firstPage.drawText(`${rowData.reason || "정보 없음"}`, {
    x: 160,
    y: height - 230,
    size: 18,
    font: customFont,
    color: rgb(0, 0, 0),
  })

  if (rowData.applicant && rowData.applicant.length > 0) {
    const applicants = rowData.applicant
    const groups = []
    // 신청자 수가 10명 초과면 한 줄에 3명씩, 아니면 2명씩 그룹화
    const groupSize = applicants.length > 8 ? 3 : 2
    for (let i = 0; i < applicants.length; i += groupSize) {
      groups.push(applicants.slice(i, i + groupSize))
    }
    let yPos = height - 258 // 시작 y 좌표 (템플릿에 맞게 조정)
    groups.forEach((group) => {
      const text = group.map((applicant) => `${applicant.number} ${applicant.name}`).join(" / ")
      firstPage.drawText(text, {
        x: 190,
        y: yPos,
        size: 15,
        font: customFont,
        color: rgb(0, 0, 0),
      })
      yPos -= 22
    })
  }

  const pdfBytes = await pdfDoc.save()
  download(pdfBytes, `${rowData.name}_template.pdf`, "application/pdf")
}

// ─── 데스크톱용 테이블 열 정의 ─────────────────────────────
const columnsDesktop = (downloadTemplatePDF, onShowApplicants) => [
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
    cell: ({ row }) => (
      <>
        {row.original.count}{" "}
        <button
          type="button"
          onClick={() => onShowApplicants(row.original.applicant)}
          className="ml-1 link link-primary text-xs"
        >
          더보기
        </button>
      </>
    ),
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
    id: "template",
    header: "다운로드",
    cell: ({ row }) => (
      <button
        type="button"
        className="btn btn-soft btn-primary btn-sm"
        onClick={() => downloadTemplatePDF(row.original)}
      >
        다운로드
      </button>
    ),
  },
]

// ─── 모바일용 리스트 뷰 컴포넌트 (한 화면에 3개씩 표시) ─────────────────────────────
const MobileDataView = ({
  data,
  downloadTemplatePDF,
  router,
  pageIndex,
  totalPages,
  handleNextPage,
  handlePreviousPage,
  onShowApplicants = () => { },
}) => {
  // 한 페이지에 mobilePageSize(3)개의 항목만 표시
  const mobilePageSize = 3
  const itemsToShow = data.slice(
    pageIndex * mobilePageSize,
    pageIndex * mobilePageSize + mobilePageSize,
  )

  return (
    <div className="w-full space-y-4">
      {itemsToShow.map((item) => (
        <div key={item.id} className="card bg-base-100 shadow-lg">
          <div className="card-body space-y-2 text-left">
            <p>
              <span className="font-semibold text-base-content">대표자:</span> {item.name}
            </p>
            <p>
              <span className="font-semibold text-base-content">전화번호:</span> {item.contact}
            </p>
            <p>
              <span className="font-semibold text-base-content">총인원:</span> {item.count}
              {onShowApplicants ? (
                <button
                  type="button"
                  className="ml-2 link link-primary text-xs"
                  onClick={() => onShowApplicants(item.applicant)}
                >
                  더보기
                </button>
              ) : null}
            </p>
            <p>
              <span className="font-semibold text-base-content">신청교시:</span> {item.time}
            </p>
            <p>
              <span className="font-semibold text-base-content">사유:</span> {item.reason}
            </p>
            <button
              type="button"
              className="btn btn-soft btn-primary w-full"
              onClick={() => downloadTemplatePDF(item)}
            >
              다운로드
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-outline"
          onClick={handlePreviousPage}
          disabled={pageIndex === 0}
        >
          이전
        </button>
        <span className="text-sm text-base-content/70">
          {pageIndex + 1} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleNextPage}
          disabled={pageIndex + 1 === totalPages}
        >
          다음
        </button>
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/status")}
        >
          승인 현황
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin")}
        >
          홈
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/statusfalse")}
        >
          거절 현황
        </button>
      </div>
    </div>
  )
}

// ─── 데스크톱용 데이터 테이블 컴포넌트 ─────────────────────────────
const DataTable = ({ table, data, isLoading, handlePreviousPage, handleNextPage, router }) => (
  <AdminTableLayout
    isLoading={isLoading}
    isEmpty={!data || data.length === 0}
    emptyMessage="신청 목록이 없습니다"
    footer={
      <>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/statusfalse")}
        >
          거절 현황
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin")}
        >
          홈
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/status")}
        >
          승인 현황
        </button>
      </>
    }
  >
    <div className="overflow-x-auto rounded-xl border border-base-200">
      <table className="table table-zebra w-full">
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
            <tr key={row.original.id}>
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
      canPrevious={table.getCanPreviousPage()}
      canNext={table.getCanNextPage()}
      pageLabel={`${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()}`}
    />
  </AdminTableLayout>
)

export default function Homeadmin() {
  const router = useRouter()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  // 데스크톱용 페이지 인덱스
  const [pageIndex, setPageIndex] = useState(0)
  // 모바일용 페이지 인덱스 (한 화면에 3개씩)
  const [mobilePageIndex, setMobilePageIndex] = useState(0)
  const pageSize = 8
  const mobilePageSize = 3
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" })
  const toast = useToast()

  // API에서 데이터 가져오기
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/requests?isApproved=true`)
      const result = await response.json()
      const transformedData = result.requests
        .map(transformRequest)
        .map((request) => ({
          ...request,
          teacher: request.teacher,
        }))
        // created_at을 기준으로 정렬
        .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))

      setData(transformedData)
    } catch (error) {
      console.error("데이터 가져오기 오류:", error)
      toast.error("데이터 가져오기 중 오류 발생")
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [toast.error])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleNextPage = () => {
    setPageIndex((prev) => Math.min(prev + 1, table.getPageCount() - 1))
  }

  const handlePreviousPage = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0))
  }

  // 모바일용 페이지네이션 핸들러 (한 화면에 mobilePageSize개씩)
  const handleMobileNext = () => {
    setMobilePageIndex((prev) => Math.min(prev + 1, Math.ceil(data.length / mobilePageSize) - 1))
  }

  const handleMobilePrevious = () => {
    setMobilePageIndex((prev) => Math.max(prev - 1, 0))
  }

  const totalMobilePages = Math.ceil(data.length / mobilePageSize)

  // 데스크톱용 테이블
  const table = useReactTable({
    data,
    columns: columnsDesktop(downloadTemplatePDF, (applicants = []) => {
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
    pageCount: Math.ceil(data.length / pageSize),
    state: {
      pagination: { pageIndex, pageSize },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-base-200 p-6">
      {isMobile ? (
        <MobileDataView
          data={data}
          downloadTemplatePDF={downloadTemplatePDF}
          router={router}
          pageIndex={mobilePageIndex}
          totalPages={totalMobilePages}
          handleNextPage={handleMobileNext}
          handlePreviousPage={handleMobilePrevious}
          onShowApplicants={(applicants) => {
            if (!applicants?.length) return
            const text = applicants
              .map((applicant) => `${applicant.name} (${applicant.number})`)
              .join("\n")
            toast.addToast({
              title: "신청자 목록",
              content: <p className="whitespace-pre-wrap text-sm leading-snug">{text}</p>,
              variant: "info",
              duration: 5000,
            })
          }}
        />
      ) : (
        <DataTable
          table={table}
          data={data}
          isLoading={isLoading}
          handlePreviousPage={handlePreviousPage}
          handleNextPage={handleNextPage}
          router={router}
        />
      )}
    </main>
  )
}
