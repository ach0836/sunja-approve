import { z } from "zod"

const applicantSchema = z.object({
  name: z.string().min(2, "이름을 입력하세요"),
  number: z.string().regex(/^[1-3][1-4](0[1-9]|[1-2][0-9]|30)$/, "학번을 입력하세요"),
})

const formSchema = z.object({
  time: z.enum(["1", "2", "3"], { message: "사용 시간을 선택하세요" }),
  applicant: z.array(applicantSchema).min(1, "사용 인원을 선택하세요"),
  reason: z.string().min(1, "사유를 입력하세요"),
  contact: z.string().regex(/^(010-\d{4}-\d{4}|010\d{8})$/, "대표자 전화번호를 입력하세요"),
  is_approved: z.boolean().nullable().default(null),
})

export default formSchema
