"use client"
/* eslint-env browser */

import { useCallback, useEffect, useMemo, useState, useId, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useToast } from "@/components/toast/ToastProvider"

import formSchema from "@/schema"
import { useFcmToken } from "@/hooks/useFcmToken"
import { DEFAULT_KAKAO_URL, STUDY_PERIOD_OPTIONS, DEFAULT_APPLICANT_OPTIONS } from "@/lib/constants"

function buildEmptyApplicants(count) {
  return Array.from({ length: count }, () => ({ name: "", number: "" }))
}

export default function RequestForm({
  applicantOptions = DEFAULT_APPLICANT_OPTIONS,
  defaultApplicantCount = DEFAULT_APPLICANT_OPTIONS[0],
  statusHref = "/status",
  kakaoHref = DEFAULT_KAKAO_URL,
  showAdminLink = true,
}) {
  const router = useRouter()
  const fcmToken = useFcmToken()
  const toast = useToast()

  const normalizedApplicantOptions = useMemo(() => {
    return [...new Set(applicantOptions)].sort((a, b) => a - b)
  }, [applicantOptions])

  const formIdPrefix = useId()
  const applicantIdCounter = useRef(0)
  const generateApplicantId = useCallback(() => {
    applicantIdCounter.current += 1
    return `${formIdPrefix}-applicant-${applicantIdCounter.current}`
  }, [formIdPrefix])

  const [numApplicants, setNumApplicants] = useState(defaultApplicantCount)
  const [isFormDisabled, setIsFormDisabled] = useState(false)
  const [applicantIds, setApplicantIds] = useState(() =>
    Array.from({ length: defaultApplicantCount }, generateApplicantId),
  )

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      time: "",
      applicant: buildEmptyApplicants(defaultApplicantCount),
      reason: "",
      contact: "",
      applicantNum: String(defaultApplicantCount),
      is_approved: false,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = form

  const showToast = (message, type) => {
    const handler = type === "success" ? toast.success : type === "error" ? toast.error : toast.info

    handler(message, {
      duration: 3000,
    })

    if (type === "success") {
      // 제출 성공 시 1.5초 후 페이지 새로고침
      setTimeout(() => {
        window.location.href = "/"
      }, 1500)
    }
  }

  const handleApplicantNumChange = (value) => {
    const parsed = Number(value)
    setNumApplicants(parsed)
    setValue("applicantNum", value, { shouldValidate: true })
  }

  const onSubmit = async (data) => {
    setIsFormDisabled(true)
    const payload = { ...data, is_approved: false, fcm: fcmToken }

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error("API error response:", responseData)
        setIsFormDisabled(false)
        throw new Error(responseData.error || "Submission failed")
      }

      showToast("제출되었습니다.", "success")
    } catch (error) {
      console.error("Error submitting data:", error)
      showToast(error.message || "제출 실패", "error")
    }
  }

  useEffect(() => {
    setValue("applicant", buildEmptyApplicants(numApplicants))
    setApplicantIds((prev) => {
      if (numApplicants > prev.length) {
        const additions = Array.from({ length: numApplicants - prev.length }, generateApplicantId)
        return [...prev, ...additions]
      }
      if (numApplicants === prev.length) {
        return prev
      }
      return prev.slice(0, numApplicants)
    })
  }, [numApplicants, generateApplicantId, setValue])

  const disableInteractions = isSubmitting || isFormDisabled

  const timeFieldId = `${formIdPrefix}-time`
  const reasonFieldId = `${formIdPrefix}-reason`
  const contactFieldId = `${formIdPrefix}-contact`
  const applicantCountFieldId = `${formIdPrefix}-applicant-count`

  return (
    <main className="min-h-screen bg-base-200 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="card mx-auto max-w-3xl bg-base-100 shadow-lg">
          <div className="card-body space-y-6">
            <header className="space-y-2 text-center">
              <h1 className="text-3xl font-bold text-base-content">순자증 신청</h1>
              <p className="text-sm text-base-content/70">
                신청자 정보와 연락처를 정확히 입력하면 승인 결과를 빠르게 받아볼 수 있습니다.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <input type="hidden" value={numApplicants} {...register("applicantNum")} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-control w-full">
                  <label className="label" htmlFor={timeFieldId}>
                    <span className="label-text font-semibold">사용 시간</span>
                  </label>
                  <select
                    id={timeFieldId}
                    className="select select-bordered w-full"
                    disabled={disableInteractions}
                    defaultValue=""
                    {...register("time")}
                  >
                    <option value="" disabled>
                      사용 시간을 선택하세요
                    </option>
                    {STUDY_PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.time && (
                    <span className="mt-1 text-xs text-error">{errors.time.message}</span>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label" htmlFor={applicantCountFieldId}>
                    <span className="label-text font-semibold">사용 인원</span>
                  </label>
                  <select
                    id={applicantCountFieldId}
                    className="select select-bordered w-full"
                    disabled={disableInteractions}
                    value={String(numApplicants)}
                    onChange={(event) => handleApplicantNumChange(event.target.value)}
                  >
                    {normalizedApplicantOptions.map((option) => (
                      <option key={option} value={String(option)}>
                        {option}명
                      </option>
                    ))}
                  </select>
                  {errors.applicantNum && (
                    <span className="mt-1 text-xs text-error">{errors.applicantNum.message}</span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-control w-full sm:col-span-2">
                  <label className="label" htmlFor={reasonFieldId}>
                    <span className="label-text font-semibold">사유</span>
                  </label>
                  <input
                    id={reasonFieldId}
                    placeholder="사용 사유를 입력하세요"
                    type="text"
                    className="input input-bordered w-full"
                    disabled={disableInteractions}
                    {...register("reason")}
                  />
                  {errors.reason && (
                    <span className="mt-1 text-xs text-error">{errors.reason.message}</span>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label" htmlFor={contactFieldId}>
                    <span className="label-text font-semibold">전화번호 (대표자)</span>
                  </label>
                  <input
                    id={contactFieldId}
                    placeholder="010-0000-0000"
                    type="tel"
                    className="input input-bordered w-full"
                    disabled={disableInteractions}
                    {...register("contact")}
                  />
                  {errors.contact && (
                    <span className="mt-1 text-xs text-error">{errors.contact.message}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-base-content">참여자 정보</span>
                  <span className="badge badge-outline">총 {numApplicants}명</span>
                </div>
                <AnimatePresence>
                  {applicantIds.map((rowId, index) => (
                    <motion.div
                      key={rowId}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="grid gap-3 rounded-xl border border-base-200 bg-base-100 px-4 py-3 sm:grid-cols-2"
                    >
                      <div className="form-control w-full">
                        <label className="label" htmlFor={`${rowId}-name`}>
                          <span className="label-text font-semibold">
                            이름 {index + 1}
                            {index === 0 ? " (대표자)" : ""}
                          </span>
                        </label>
                        <input
                          id={`${rowId}-name`}
                          placeholder={`이름 ${index + 1}${index === 0 ? " (대표자)" : ""}`}
                          type="text"
                          className="input input-bordered w-full"
                          disabled={disableInteractions}
                          {...register(`applicant.${index}.name`)}
                        />
                        {errors.applicant?.[index]?.name && (
                          <span className="mt-1 text-xs text-error">
                            {errors.applicant[index]?.name?.message}
                          </span>
                        )}
                      </div>

                      <div className="form-control w-full">
                        <label className="label" htmlFor={`${rowId}-number`}>
                          <span className="label-text font-semibold">
                            학번 {index + 1}
                            {index === 0 ? " (대표자)" : ""}
                          </span>
                        </label>
                        <input
                          id={`${rowId}-number`}
                          placeholder={`학번 ${index + 1}${index === 0 ? " (대표자)" : ""}`}
                          type="text"
                          className="input input-bordered w-full"
                          disabled={disableInteractions}
                          {...register(`applicant.${index}.number`)}
                        />
                        {errors.applicant?.[index]?.number && (
                          <span className="mt-1 text-xs text-error">
                            {errors.applicant[index]?.number?.message}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => router.push(statusHref)}
                    disabled={disableInteractions}
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    승인 현황 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.open(kakaoHref, "_blank")
                      }
                    }}
                    disabled={disableInteractions}
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    카카오톡 문의
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={disableInteractions}
                  className="btn btn-soft btn-primary w-full sm:w-auto"
                >
                  신청 접수하기
                </button>
              </div>

              {showAdminLink && (
                <div className="text-right text-xs text-base-content/60">
                  <Link href="/admin" className="link link-hover">
                    관리자 페이지로 이동
                  </Link>
                </div>
              )}
            </form>
          </div>
        </div>
      </motion.div>
    </main>
  )
}
