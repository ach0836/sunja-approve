"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useId,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "react-responsive"
import { useToast } from "@/components/toast/ToastProvider"
import { REQUEST_STATUS } from "@/lib/constants"
import { updateRequestStatusAction, deleteRequestAction } from "./actions"
import {
  findEarlierPendingRequests,
  isPremiumMember,
  sortRequestsForReview,
  transformRequest,
} from "@/lib/admin/requests"

const HIGHLIGHT_CLASS = "flash-cell"

const highlightIfPremium = (name) => (isPremiumMember(name) ? HIGHLIGHT_CLASS : "")

function showApplicantToast(toastApi, applicants = []) {
  if (!applicants.length) return

  const text = applicants.map((applicant) => `${applicant.name} (${applicant.number})`).join("\n")

  toastApi.addToast({
    title: "신청자 목록",
    content: <p className="whitespace-pre-wrap text-sm leading-snug">{text}</p>,
    variant: "info",
    duration: 5000,
  })
}

function confirmDeletion(toastApi, _request, onConfirm) {
  toastApi.addToast({
    title: "정말 삭제하시겠습니까?",
    variant: "warning",
    dismissible: false,
    duration: 0,
    actions: [
      {
        label: "확인",
        variant: "btn-primary",
        onClick: onConfirm,
      },
      {
        label: "취소",
        variant: "btn-ghost",
      },
    ],
  })
}

function confirmPriorityOverride(toastApi, request, earlierRequests, onConfirm) {
  const names = earlierRequests.map((item) => item.name).join(", ")
  toastApi.addToast({
    title: "먼저 신청한 인원이 있습니다",
    content: (
      <p className="text-sm leading-snug">
        같은 교시({request.time})에 먼저 신청한 사람들이 있습니다:
        <br />
        <strong>{names}</strong>
        <br />
        그래도 이 요청을 승인하시겠습니까?
      </p>
    ),
    variant: "warning",
    dismissible: false,
    duration: 0,
    actions: [
      {
        label: "승인",
        variant: "btn-primary",
        onClick: onConfirm,
      },
      {
        label: "취소",
        variant: "btn-ghost",
      },
    ],
  })
}

function PasswordForm({ password, setPassword, onSubmit, router }) {
  const passwordInputId = useId()
  return (
    <div className="card w-full max-w-md bg-base-100 shadow-lg">
      <div className="card-body space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold text-base-content">관리자 로그인</h2>
          <p className="text-sm text-base-content/60">
            승인 페이지 접근을 위해 비밀번호를 입력하세요.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="form-control w-full">
            <label htmlFor={passwordInputId} className="label">
              <span className="label-text font-semibold">비밀번호</span>
            </label>
            <input
              id={passwordInputId}
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div className="grid gap-3">
            <button type="submit" className="btn btn-soft btn-primary btn-lg">
              로그인
            </button>
            <button type="button" className="btn btn-outline" onClick={() => router.push("/admin")}>
              뒤로가기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DesktopTable({
  data,
  pageIndex,
  pageSize,
  onNext,
  onPrevious,
  onApprove,
  onReject,
  onDelete,
  router,
  busy,
  onShowApplicants = () => { },
}) {
  const start = pageIndex * pageSize
  const pageData = data.slice(start, start + pageSize)
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body space-y-4">
          {data.length === 0 ? (
            <p className="text-sm text-base-content/70">신청 목록이 없습니다.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-base-200">
                <table className="table table-zebra">
                  <thead className="bg-base-200">
                    <tr>
                      <th>대표자</th>
                      <th>전화번호</th>
                      <th>총인원</th>
                      <th>신청교시</th>
                      <th>신청시간</th>
                      <th>사유</th>
                      <th>확인</th>
                      <th>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((row) => (
                      <tr key={row.id}>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>{row.name}</td>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>
                          {row.contact}
                        </td>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>
                          {row.count}{" "}
                          <button
                            type="button"
                            className="link link-primary text-xs"
                            onClick={() => onShowApplicants(row.applicant)}
                          >
                            더보기
                          </button>
                        </td>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>{row.time}</td>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>
                          {row.createdTime}
                        </td>
                        <td className={`align-top ${highlightIfPremium(row.name)}`}>
                          {row.reason}
                        </td>
                        <td className="w-32">
                          <button
                            type="button"
                            className={`btn w-full ${row.is_approved ? "btn-soft btn-error" : "btn-soft btn-success"
                              }`}
                            disabled={busy}
                            onClick={() => (row.is_approved ? onReject(row) : onApprove(row))}
                          >
                            {row.is_approved ? "거부" : "승인"}
                          </button>
                        </td>
                        <td className="w-24">
                          <button
                            type="button"
                            className="btn btn-outline btn-error w-full"
                            disabled={busy}
                            onClick={() => onDelete(row)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onPrevious}
                  disabled={pageIndex === 0}
                >
                  이전
                </button>
                <span className="text-sm text-base-content/70">
                  {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onNext}
                  disabled={pageIndex >= pageCount - 1}
                >
                  다음
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
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
          onClick={() => router.push("/admin/download")}
        >
          다운로드
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/status")}
        >
          승인 현황
        </button>
      </div>
    </div>
  )
}

function MobileCards({
  data,
  pageIndex,
  pageSize,
  onNext,
  onPrevious,
  onApprove,
  onReject,
  onDelete,
  router,
  busy,
  onShowApplicants = () => { },
}) {
  const start = pageIndex * pageSize
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
  const pageData = data.slice(start, start + pageSize)

  if (data.length === 0) {
    return <p className="text-sm text-base-content/70">신청 목록이 없습니다.</p>
  }

  return (
    <div className="w-full space-y-4">
      {pageData.map((item) => (
        <div key={item.id} className="card bg-base-100 shadow-lg">
          <div className="card-body space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content/60">대표자</p>
                <p className={`text-base font-semibold ${highlightIfPremium(item.name)}`}>
                  {item.name}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-error btn-xs"
                disabled={busy}
                onClick={() => onDelete(item)}
              >
                삭제
              </button>
            </div>
            <div className="grid gap-2 text-sm">
              <p>
                <span className="font-semibold">전화번호:</span>{" "}
                <span className={highlightIfPremium(item.name)}>{item.contact}</span>
              </p>
              <p>
                <span className="font-semibold">총인원:</span>{" "}
                <span className={highlightIfPremium(item.name)}>{item.count}</span>{" "}
                <button
                  type="button"
                  className="link link-primary text-xs"
                  onClick={() => onShowApplicants(item.applicant)}
                >
                  더보기
                </button>
              </p>
              <p>
                <span className="font-semibold">신청교시:</span>{" "}
                <span className={highlightIfPremium(item.name)}>{item.time}</span>
              </p>
              <p>
                <span className="font-semibold">신청시간:</span>{" "}
                <span className={highlightIfPremium(item.name)}>{item.createdTime}</span>
              </p>
              <p>
                <span className="font-semibold">사유:</span>{" "}
                <span className={highlightIfPremium(item.name)}>{item.reason}</span>
              </p>
            </div>
            <button
              type="button"
              className={`btn w-full ${item.is_approved ? "btn-soft btn-error" : "btn-soft btn-success"
                }`}
              disabled={busy}
              onClick={() => (item.is_approved ? onReject(item) : onApprove(item))}
            >
              {item.is_approved ? "거부" : "승인"}
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onPrevious}
          disabled={pageIndex === 0}
        >
          이전
        </button>
        <span className="text-sm text-base-content/70">
          {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onNext}
          disabled={pageIndex >= pageCount - 1}
        >
          다음
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
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
          onClick={() => router.push("/admin/download")}
        >
          다운로드
        </button>
        <button
          type="button"
          className="btn btn-outline flex-1"
          onClick={() => router.push("/admin/status")}
        >
          승인 현황
        </button>
      </div>
    </div>
  )
}

export default function ApproveRequestsPage() {
  const router = useRouter()
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" })
  const pageSize = isMobile ? 3 : 8

  const toast = useToast()
  const [password, setPassword] = useState("")
  const [token, setToken] = useState("")
  const [isPasswordCorrect, setIsPasswordCorrect] = useState(false)
  const [requests, setRequests] = useState([])

  // 컴포넌트 마운트 시 로컬 스토리지에서 토큰 복구
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token")
    if (savedToken) {
      setToken(savedToken)
      setIsPasswordCorrect(true)
    }
  }, [])
  const [optimisticRequests, applyOptimisticRequest] = useOptimistic(
    requests,
    (current, action) => {
      switch (action.type) {
        case "update-status":
          return current.map((item) =>
            item.id === action.id
              ? {
                ...item,
                is_approved: action.is_approved,
                status: action.is_approved ? REQUEST_STATUS.APPROVED : REQUEST_STATUS.REJECTED,
              }
              : item,
          )
        case "remove":
          return current.filter((item) => item.id !== action.id)
        case "set":
          return action.requests
        default:
          return current
      }
    },
  )
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(optimisticRequests.length / pageSize)),
    [optimisticRequests.length, pageSize],
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()

      const response = await fetch(`/api/requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await response.json()
      const filtered = (Array.isArray(result.requests) ? result.requests : [])
        .filter((request) => {
          const createdAt = new Date(request.created_at)
          const startDate = new Date(todayStart)
          const endDate = new Date(todayEnd)
          return createdAt >= startDate && createdAt <= endDate
        })
        .map(transformRequest)
      const transformed = sortRequestsForReview(filtered)
      setRequests(transformed)
      startTransition(() => {
        applyOptimisticRequest({ type: "set", requests: transformed })
      })
    } catch (error) {
      console.error("데이터 가져오기 오류:", error)
      toast.error("데이터 가져오기 중 오류 발생", { duration: 500 })
      setRequests([])
      startTransition(() => {
        applyOptimisticRequest({ type: "set", requests: [] })
      })
    } finally {
      setIsLoading(false)
    }
  }, [applyOptimisticRequest, token, toast.error])

  useEffect(() => {
    if (isPasswordCorrect) {
      fetchData()
    }
  }, [isPasswordCorrect, fetchData])

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      body: password,
    })
    const result = await res.json()
    if (result.success) {
      setToken(password)
      localStorage.setItem("admin_token", password)
      setIsPasswordCorrect(true)
    } else {
      toast.error("비밀번호가 틀렸습니다. 다시 시도해주세요.", { duration: 500 })
    }
  }

  const removeRequest = (requestId) => {
    startTransition(() => {
      applyOptimisticRequest({ type: "remove", id: requestId })
    })
    setRequests((prev) => prev.filter((request) => request.id !== requestId))
  }

  const handleStatusChange = async (request, isApproved) => {
    const earlierRequests = findEarlierPendingRequests(request, optimisticRequests)
    const execute = async () => {
      const previousSnapshot = requests.map((item) => ({ ...item }))
      startTransition(() => {
        applyOptimisticRequest({ type: "update-status", id: request.id, is_approved: isApproved })
      })
      const pendingId = toast.info(isApproved ? "승인 처리 중..." : "거부 처리 중...", {
        duration: 0,
        dismissible: false,
      })

      startTransition(async () => {
        try {
          const result = await updateRequestStatusAction(request.id, isApproved)
          const transformed = transformRequest(result.record)
          toast.dismissToast(pendingId)
          toast.success(isApproved ? "승인 되었습니다." : "거부되었습니다.")
          setRequests((prev) =>
            prev.map((item) => (item.id === transformed.id ? transformed : item)),
          )
        } catch (error) {
          console.error("상태 업데이트 오류:", error)
          toast.dismissToast(pendingId)
          toast.error("상태 업데이트 중 오류 발생", { duration: 1000 })
          setRequests(previousSnapshot)
          applyOptimisticRequest({ type: "set", requests: previousSnapshot })
        }
      })
    }

    if (isApproved && earlierRequests.length) {
      confirmPriorityOverride(toast, request, earlierRequests, execute)
      return
    }

    execute()
  }

  const handleDelete = (request) => {
    confirmDeletion(toast, request, async () => {
      const previousSnapshot = requests.map((item) => ({ ...item }))
      removeRequest(request.id)
      const pendingId = toast.info("삭제 처리 중...", { duration: 0, dismissible: false })
      startTransition(async () => {
        try {
          await deleteRequestAction(request.id)
          toast.dismissToast(pendingId)
          toast.success("삭제되었습니다.")
        } catch (error) {
          console.error("삭제 오류:", error)
          toast.dismissToast(pendingId)
          toast.error("삭제 중 오류 발생")
          setRequests(previousSnapshot)
          applyOptimisticRequest({ type: "set", requests: previousSnapshot })
        }
      })
    })
  }

  const goNext = () => setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))
  const goPrevious = () => setPageIndex((prev) => Math.max(prev - 1, 0))

  return (
    <main className="min-h-screen bg-base-200 py-10">
      <div className="container mx-auto">
        {!isPasswordCorrect ? (
          <div className="flex items-center justify-center">
            <PasswordForm
              password={password}
              setPassword={setPassword}
              onSubmit={handlePasswordSubmit}
              router={router}
            />
          </div>
        ) : isLoading ? (
          <div className="card mx-auto w-full max-w-md bg-base-100 shadow-lg">
            <div className="card-body flex items-center justify-center py-10">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          </div>
        ) : isMobile ? (
          <MobileCards
            data={optimisticRequests}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onNext={goNext}
            onPrevious={goPrevious}
            onApprove={(request) => handleStatusChange(request, true)}
            onReject={(request) => handleStatusChange(request, false)}
            onDelete={handleDelete}
            router={router}
            busy={isPending}
            onShowApplicants={(applicants) => showApplicantToast(toast, applicants)}
          />
        ) : (
          <DesktopTable
            data={optimisticRequests}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onNext={goNext}
            onPrevious={goPrevious}
            onApprove={(request) => handleStatusChange(request, true)}
            onReject={(request) => handleStatusChange(request, false)}
            onDelete={handleDelete}
            router={router}
            busy={isPending}
            onShowApplicants={(applicants) => showApplicantToast(toast, applicants)}
          />
        )}
      </div>
    </main>
  )
}
