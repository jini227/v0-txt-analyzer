"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Chips } from "@/components/ui/chips"
import { DataTable } from "@/components/ui/data-table"
import { ChartCard } from "@/components/ui/chart-card"
import { EmptyState } from "@/components/ui/empty-state"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts"
import { Download, FileText, Calendar, Users, TrendingUp, Camera, Share2 } from "lucide-react"
import { parseKakaoTxt, getDaysSinceStart, formatKoreanDate } from "@/lib/parseKakao"
import { analyzeKeyword } from "@/lib/analysis"
import { generateKeywordSummaryCSV, generateKeywordDetailsCSV, downloadCSV } from "@/lib/csv"
import { captureAndSave, captureAndKakaoShare } from "@/lib/capture"
import type { ParseResult } from "@/lib/parseKakao"
import type { KeywordAnalysis } from "@/lib/analysis"
import { LoadingOverlay } from "@/components/ui/loading-overlay"

export default function KeywordCounterPage() {
  const [file, setFile] = useState<File | null>(null)
  const [keyword, setKeyword] = useState("")
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [analysis, setAnalysis] = useState<KeywordAnalysis | null>(null)
  const [includedSpeakers, setIncludedSpeakers] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setParseResult(null)
    setAnalysis(null)
    setIsProcessing(true)
    setProgress(0)

    try {
      // 파싱 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 100)

      const result = await parseKakaoTxt(selectedFile)

      clearInterval(progressInterval)
      setProgress(100)

      setParseResult(result)
      setIncludedSpeakers(result.speakers)

      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
      }, 500)
    } catch (error) {
      console.error("파일 파싱 오류:", error)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const handleAnalyze = () => {
    if (!parseResult || !keyword.trim()) return

    setIsAnalyzing(true)

    setTimeout(() => {
      const result = analyzeKeyword(parseResult.messages, keyword.trim(), includedSpeakers)
      setAnalysis(result)
      setIsAnalyzing(false)
    }, 1000) // 분석 시뮬레이션
  }

  const handleSpeakerRemove = (speaker: string) => {
    setIncludedSpeakers((prev) => prev.filter((s) => s !== speaker))
  }

  const handleSpeakerAdd = (speaker: string) => {
    if (!includedSpeakers.includes(speaker)) {
      setIncludedSpeakers((prev) => [...prev, speaker])
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setParseResult(null)
    setAnalysis(null)
    setIncludedSpeakers([])
    setKeyword("")
  }

  const handleDownloadSummary = () => {
    if (!analysis) return
    const csv = generateKeywordSummaryCSV(analysis)
    downloadCSV(csv, `keyword_summary_${keyword}.csv`)
  }

  const handleDownloadDetails = () => {
    if (!analysis) return
    const csv = generateKeywordDetailsCSV(analysis)
    downloadCSV(csv, `keyword_details_${keyword}.csv`)
  }

  const handleDownloadMeta = () => {
    if (!analysis || !parseResult) return
    const meta = {
      conversation_start_date: parseResult.conversationStartDate,
      days_since_start: getDaysSinceStart(parseResult.conversationStartDate),
      keyword: analysis.keyword,
      speakers: includedSpeakers,
      analysis_timestamp: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `keyword_meta_${keyword}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleKakaoShare = async () => {
    await captureAndKakaoShare(
      "analysis-results",
      async (dataUrl: string) => {
        const blob = await (await fetch(dataUrl)).blob()
        const formData = new FormData()
        formData.append("image", blob, "analysis.png")
        const res = await fetch("/api/share/upload", { method: "POST", body: formData })
        if (!res.ok) throw new Error("업로드 실패")
        const { url } = await res.json()
        return url as string
      },
      {
        title: "What's in my Kakao 분석 결과",
        description: "키워드 분석 결과를 확인해보세요!",
        linkUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }
    )
  }

  // 차트 데이터 준비
  const chartData = analysis
    ? {
        speakerChart: analysis.speakerStats.map((stat) => ({
          speaker: stat.speaker,
          hits: stat.totalHits,
        })),
        timelineChart: (() => {
          const dateMap = new Map<string, Record<string, number>>()

          analysis.timeline.forEach((item) => {
            if (!dateMap.has(item.date)) {
              dateMap.set(item.date, {})
            }
            const dayData = dateMap.get(item.date)!
            dayData[item.speaker] = (dayData[item.speaker] || 0) + item.hitsInMessage
          })

          return Array.from(dateMap.entries())
            .map(([date, speakers]) => ({
              date,
              ...speakers,
              total: Object.values(speakers).reduce((sum, count) => sum + count, 0),
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
        })(),
      }
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LoadingOverlay
        isLoading={isProcessing || isAnalyzing}
        message={isProcessing ? "파일 분석 중..." : "키워드 분석 중..."}
      />

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">키워드 카운터</h1>
            <p className="text-muted-foreground">카카오톡 대화에서 특정 키워드의 사용 빈도를 분석하고 시각화합니다.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => captureAndSave("analysis-results")} disabled={!analysis}>
              <Camera className="h-4 w-4 mr-2" />
              이미지 저장
            </Button>

            <Button variant="outline" onClick={handleKakaoShare} disabled={!analysis}>
              <Share2 className="h-4 w-4 mr-2" />
              카카오톡 공유
            </Button>
          </div>
        </div>
      </div>

      {/* 파일 업로드 및 키워드 입력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            파일 업로드 및 키워드 설정
          </CardTitle>
          <CardDescription>카카오톡 대화 파일(.txt)을 업로드하고 분석할 키워드를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone onFileSelect={handleFileSelect} selectedFile={file} onClearFile={handleClearFile} />

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>파일 분석 중...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">분석할 키워드</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 출근, 회의, 점심"
                disabled={!parseResult}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAnalyze}
                disabled={!parseResult || !keyword.trim() || isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? "분석 중..." : "분석하기"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 화자 선택 */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              분석 대상 화자
            </CardTitle>
            <CardDescription>분석에 포함할 화자를 선택하세요. 기본적으로 모든 화자가 포함됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Chips items={includedSpeakers} onRemove={handleSpeakerRemove} onAdd={handleSpeakerAdd} addable={true} />
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {analysis && parseResult && (
        <div id="analysis-results">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  대화 시작일
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatKoreanDate(parseResult.conversationStartDate)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  경과 일수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{getDaysSinceStart(parseResult.conversationStartDate)}일</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Intl.DateTimeFormat("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                    timeZone: "Asia/Seoul",
                  }).format(new Date())}{" "}
                  기준
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">화자별 키워드 사용</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.speakerStats.slice(0, 3).map((stat, index) => (
                    <div key={stat.speaker} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{stat.speaker}</span>
                      <span className="text-sm text-muted-foreground">{stat.totalHits}회</span>
                    </div>
                  ))}
                  {analysis.speakerStats.length > 3 && (
                    <p className="text-xs text-muted-foreground">외 {analysis.speakerStats.length - 3}명</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 상세 분석 탭 */}
          <Card>
            <CardHeader>
              <CardTitle>상세 분석 결과</CardTitle>
              <CardDescription>화자별 키워드 사용 내역을 자세히 확인할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="summary">요약</TabsTrigger>
                  <TabsTrigger value="timeline">타임라인</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <DataTable
                    data={analysis.speakerStats}
                    columns={[
                      { key: "speaker", header: "화자", sortable: true },
                      { key: "totalHits", header: "총 키워드 횟수", sortable: true },
                      { key: "messageCount", header: "키워드 포함 메시지 수", sortable: true },
                    ]}
                    pageSize={10}
                  />
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  <DataTable
                    data={analysis.timeline}
                    columns={[
                      { key: "date", header: "날짜", sortable: true },
                      { key: "time", header: "시간", sortable: true },
                      { key: "speaker", header: "화자", sortable: true },
                      {
                        key: "message",
                        header: "메시지",
                        render: (value: string) => (
                          <div className="max-w-md truncate" title={value}>
                            {value}
                          </div>
                        ),
                      },
                      { key: "hitsInMessage", header: "키워드 횟수", sortable: true },
                    ]}
                    pageSize={50}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 차트 */}
          {chartData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="화자별 키워드 사용량" description="각 화자가 사용한 키워드의 총 횟수">
                <BarChart data={chartData.speakerChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="speaker" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hits" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ChartCard>

              <ChartCard title="날짜별 키워드 사용 추이" description="시간에 따른 키워드 사용량 변화">
                <LineChart data={chartData.timelineChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                </LineChart>
              </ChartCard>
            </div>
          )}

          {/* 다운로드 및 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                데이터 내보내기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                <Button variant="outline" onClick={handleDownloadSummary}>
                  요약 CSV 다운로드
                </Button>
                <Button variant="outline" onClick={handleDownloadDetails}>
                  상세 CSV 다운로드
                </Button>
                <Button variant="outline" onClick={handleDownloadMeta}>
                  메타데이터 JSON 다운로드
                </Button>
              </div>

              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <p>
                  분석 라인수: <strong>{analysis.summary.analyzedLines}</strong> / 전체 메시지:{" "}
                  <strong>{analysis.summary.totalMessages}</strong> / 키워드 '{analysis.keyword}' 총{" "}
                  <strong>{analysis.summary.totalKeywordHits}</strong>회 발견
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 빈 상태 */}
      {!parseResult && !isProcessing && (
        <EmptyState
          title="TXT를 업로드해 시작하세요"
          description="카카오톡 대화 파일을 업로드하면 키워드 분석을 시작할 수 있습니다."
        />
      )}
    </div>
  )
}
