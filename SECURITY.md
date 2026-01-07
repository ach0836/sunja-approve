# 보안 개선 사항

## 🔐 구현된 보안 개선

### 1. **API 인증 강화**
- ✅ GET 요청: 관리자만 신청서 조회 가능 (Bearer token 필수)
- ✅ POST 요청: 입력값 검증
- ✅ PUT/PATCH/DELETE: 비밀번호 기반 인증 필수
- ✅ 인증 실패: 401 Unauthorized 응답

### 2. **입력값 검증**
- ✅ 토큰 형식 검증: 길이(100-300자), 영숫자 + 하이픈/언더스코어만 허용
- ✅ 연락처 검증: 길이 제한 (5-50자)
- ✅ 이유 검증: 길이 제한 (1-500자)
- ✅ 시간 값 검증: 숫자만 허용
- ✅ 레이블 검증: 길이 제한 (최대 100자)
- ✅ ID 검증: 문자열 형식 확인

### 3. **정보 보안**
- ✅ 에러 메시지: 민감한 정보 제외
- ✅ 데이터베이스 응답: 필요한 필드만 반환
- ✅ 콘솔 로그: 상세 디버깅 정보 제거

### 4. **Timing Attack 방지**
- ✅ 비밀번호 비교: `crypto.timingSafeEqual()` 사용
- ✅ 길이가 다른 입력: 먼저 거부되지 않음 (constant time 비교)

### 5. **Rate Limiting**
- ✅ 로그인 시도: IP당 15분마다 5회 제한
- ✅ 과도한 시도 시: 429 Too Many Requests 응답
- ✅ 메모리 누수 방지: 1시간마다 정기적 정리

### 6. **데이터 조작 방지**
- ✅ PUT API: 기존 UPSERT 대신 명시적 UPDATE 사용
- ✅ 업데이트 가능 필드 화이트리스트: status, is_approved, reason만 수정 가능
- ✅ PATCH: PUT과 동일하게 필드 제한 적용

### 7. **보안 헤더 추가**
- ✅ **X-Frame-Options: DENY** - Clickjacking 공격 방지
- ✅ **X-Content-Type-Options: nosniff** - MIME type sniffing 방지
- ✅ **X-XSS-Protection: 1; mode=block** - XSS 공격 방지
- ✅ **Referrer-Policy: strict-origin-when-cross-origin** - Referrer 정보 유출 방지
- ✅ **Permissions-Policy** - 불필요한 API 접근 차단

### 8. **CORS 정책**
- ✅ Whitelist 기반 origin 허용 (localhost, NEXT_PUBLIC_APP_URL)
- ✅ Preflight OPTIONS 요청 처리
- ✅ 허용 메서드 명시: GET, POST, PUT, PATCH, DELETE
- ✅ 환경변수로 배포 환경 설정 가능

---

## 📋 API 사용 가이드

### 신청서 조회 (관리자만)
```bash
curl -X GET http://localhost:3000/api/requests \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD"
```

### 신청서 생성 (누구나)
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": [{"name": "홍길동"}],
    "contact": "010-1234-5678",
    "reason": "신청 사유",
    "time": "1"
  }'
```

### 관리자 토큰 저장 (관리자만)
```bash
curl -X POST http://localhost:3000/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_FCM_TOKEN",
    "label": "My Device"
  }'
```

### 신청서 업데이트 (관리자만)
```bash
curl -X PUT "http://localhost:3000/api/requests?id=REQUEST_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "is_approved": true
  }'
```

---

## 🛡️ 환경 변수 설정

1. `.env.example`을 참고하여 `.env.local` 생성
2. 각 환경변수에 실제 값 입력:
   - **ADMIN_PASSWORD**: 최소 16자 이상의 강력한 비밀번호
   - **Firebase 설정**: Firebase Console에서 취득
   - **Supabase 설정**: Supabase Dashboard에서 취득
   - **NEXT_PUBLIC_APP_URL**: 배포된 앱 URL (CORS 허용)

---

## ⚠️ 프로덕션 배포 체크리스트

### 배포 전 필수:
1. **HTTPS 사용**: 모든 통신은 SSL/TLS 암호화 필수
2. **ADMIN_PASSWORD**: 최소 16자 이상의 강력한 비밀번호
3. **환경변수**: .env.local은 절대 Git에 커밋하지 않기
4. **CORS origin**: 배포 환경의 도메인만 허용

### 권장사항:
1. **Rate Limiting**: Redis 기반 분산 Rate Limiting 적용
2. **감사 로그**: 모든 관리자 작업 기록
3. **IP 화이트리스트**: 관리자 IP 제한 (선택사항)
4. **2FA**: 추가 인증 수단 고려 (선택사항)
5. **WAF**: AWS WAF 또는 CloudFlare 사용 권장
6. **보안 모니터링**: 의심스러운 활동 감지
7. **정기 감사**: OWASP Top 10 취약점 검토

### 지속적인 모니터링:
- 의심스러운 로그인 시도 모니터링
- Rate limiting 트리거 확인
- 데이터베이스 접근 로그 검토
