"use client"

import Link from "next/link"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { BarChart3, Users, Sparkles } from "lucide-react"

const menuItems = [
  {
    title: "키워드 카운터",
    description: "대화 시작일·경과일·화자별 키워드 분석/시각화",
    href: "/kko/page1",
    icon: BarChart3,
    color: "text-blue-600",
  },
  {
    title: "화자별 Top 단어",
    description: "화자 자동 추출, Top10 단어, 시점/문장 펼쳐보기",
    href: "/kko/page2",
    icon: Users,
    color: "text-green-600",
  },
  {
    title: "대화방 분위기 & 별명",
    description: "톤·감정·특성 추출 및 별명 추천 (AI)",
    href: "/kko/page3",
    icon: Sparkles,
    color: "text-purple-600",
  },
]

export default function KkoMenuPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handlePageNavigation = () => {
    setIsLoading(true)
    // 페이지 이동 시 약간의 지연 후 로딩 해제 (Next.js 라우팅 완료 시점)
    setTimeout(() => setIsLoading(false), 500)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <LoadingOverlay isLoading={isLoading} message="페이지 이동 중..." />

      <div className="text-center mb-12">
        <img
          src="/chatmates.png"
          alt="Chat Mates Mascot"
          className="mx-auto mb-6 w-40 h-auto"
        />
        <h1 className="text-3xl font-bold text-balance mb-4">What's in my Kakao</h1>
        <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto text-sm">
          카카오톡 대화 파일을 업로드하여 키워드 분석, 화자별 단어 분석, 대화 분위기 분석을 수행할 수 있습니다. 모든
          분석은 브라우저에서만 처리되어 개인정보가 안전하게 보호됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const IconComponent = item.icon
          return (
            <Link key={item.href} href={item.href} className="group" onClick={handlePageNavigation}>
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{item.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>로컬 처리 - 파일이 서버로 전송되지 않습니다</span>
        </div>
      </div>
    </div>
  )
}
