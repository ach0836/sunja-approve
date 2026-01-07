import { Inter } from "next/font/google"
import "./globals.css"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"
import { ToastProvider } from "@/components/toast/ToastProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "순자 신청서",
  description: "순자 신청서",
}

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning={true} lang="en" data-theme="light">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
