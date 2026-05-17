import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Providers from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "就勝つ — 就活選考管理",
  description: "就活の選考ステータスと締切をリアルタイムで管理するカンバンボード",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${inter.className} h-full bg-slate-100 text-slate-900 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
