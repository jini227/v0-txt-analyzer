"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  const getBreadcrumb = () => {
    if (pathname === "/kko" || pathname === "/kko/") return "What's in my Kakao"
    if (pathname === "/kko/page1" || pathname === "/kko/page1/") return "What's in my Kakao"
    if (pathname === "/kko/page2" || pathname === "/kko/page2/") return "What's in my Kakao"
    if (pathname === "/kko/page3" || pathname === "/kko/page3/") return "What's in my Kakao"
    return "What's in my Kakao"
  }

  const isMenuPage = pathname === "/kko" || pathname === "/kko/"

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {!isMenuPage && (
            <Link
              href="/kko"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">메뉴로</span>
            </Link>
          )}
          <h1 className="text-lg font-semibold text-balance">{getBreadcrumb()}</h1>
        </div>
      </div>
    </header>
  )
}
