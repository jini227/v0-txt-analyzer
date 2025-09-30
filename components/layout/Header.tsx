"use client"

import { SITE } from "@/lib/site";
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  const getBreadcrumb = () => {
    // 현재 상단 메뉴명 비노출, 서비스명으로 통일 함. 변경 시 주석 해제 및 메뉴명 추가
    // if (pathname === "/kko" || pathname === "/kko/") return SITE.name;
    // if (pathname === "/kko/page1" || pathname === "/kko/page1/") return SITE.name;
    // if (pathname === "/kko/page2" || pathname === "/kko/page2/") return SITE.name;
    // if (pathname === "/kko/page3" || pathname === "/kko/page3/") return SITE.name;
    return SITE.name;
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
