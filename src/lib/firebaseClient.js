"use client"
/* eslint-env browser */

import { initializeApp } from "firebase/app"
import { getMessaging, getToken, onMessage as firebaseOnMessage } from "firebase/messaging"

// Firebase 설정값은 환경변수에서 로드합니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let app = null
let messaging = null

try {
  app = initializeApp(firebaseConfig)

  // 클라이언트 환경에서만 Messaging 초기화 진행
  if (typeof window !== "undefined") {
    try {
      messaging = getMessaging(app)
    } catch (messagingError) {
      console.warn("Firebase Messaging initialization failed:", messagingError.message)
      messaging = null
    }
  }
} catch (error) {
  console.error("Firebase initialization failed:", error.message)
  app = null
  messaging = null
}

export { messaging, getToken, firebaseOnMessage as onMessage }
