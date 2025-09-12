"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Chips } from "@/components/ui/chips"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { Download, FileText, Users, ChevronDown, ChevronRight, Camera, Share2, Crown, Medal, Award } from "lucide-react"
import { parseKakaoTxt } from "@/lib/parseKakao"
import { analyzeWords } from "@/lib/analysis"
import { generateWordAnalysisCSV, downloadCSV } from "@/lib/csv"
import { captureElement, downloadImage } from "@/lib/capture"
import type { ParseResult } from "@/lib/parseKakao"
import type { WordAnalysis } from "@/lib/analysis"

// 글로벌 랭킹을 위한 인터페이스
interface GlobalWordRank {
  word: string
  topSpeaker: string
  topCount: number
  allSpeakers: { speaker: string; count: number }[]
}

export default function SpeakerWordsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [analysis, setAnalysis] = useState<WordAnalysis[]>([])
  const [globalRanks, setGlobalRanks] = useState<GlobalWordRank[]>([])
  const [includedSpeakers, setIncludedSpeakers] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showDetailedLog, setShowDetailedLog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("all")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    // 카카오 SDK 로드는 사용자가 직접 설정할 수 있도록 비활성화
    console.log("카카오톡 공유 기능을 사용하려면 Project Settings에서 카카오 JS 키를 설정하세요.")
  }, [])

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setParseResult(null)
    setAnalysis([])
    setGlobalRanks([])
    setIsProcessing(true)
    setProgress(0)

    try {
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
    if (!parseResult) return

    setIsAnalyzing(true)

    setTimeout(() => {
      const filteredMessages = parseResult.messages.filter((msg) => includedSpeakers.includes(msg.speaker))

      const wordAnalysis = analyzeWords(filteredMessages)
      setAnalysis(wordAnalysis)

      const wordMap = new Map<string, { speaker: string; count: number }[]>()

      wordAnalysis.forEach((speakerAnalysis) => {
        speakerAnalysis.topWords.forEach((wordCount) => {
          if (!wordMap.has(wordCount.word)) {
            wordMap.set(wordCount.word, [])
          }
          wordMap.get(wordCount.word)!.push({
            speaker: speakerAnalysis.speaker,
            count: wordCount.count,
          })
        })
      })

      const globalRanking: GlobalWordRank[] = []
      wordMap.forEach((speakers, word) => {
        const sortedSpeakers = speakers.sort((a, b) => b.count - a.count)
        globalRanking.push({
          word,
          topSpeaker: sortedSpeakers[0].speaker,
          topCount: sortedSpeakers[0].count,
          allSpeakers: sortedSpeakers,
        })
      })

      setGlobalRanks(globalRanking)
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
    setAnalysis([])
    setGlobalRanks([])
    setIncludedSpeakers([])
    setExpandedSections(new Set())
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const getRankIcon = (word: string, speaker: string) => {
    const globalRank = globalRanks.find((rank) => rank.word === word)
    if (!globalRank) return null

    const speakerRank = globalRank.allSpeakers.findIndex((s) => s.speaker === speaker) + 1

    if (speakerRank === 1) {
      return <Crown className="h-4 w-4 text-yellow-500" />
    } else if (speakerRank === 2) {
      return <Medal className="h-4 w-4 text-gray-400" />
    } else if (speakerRank === 3) {
      return <Award className="h-4 w-4 text-amber-600" />
    }
    return null
  }

  const handleCapture = async () => {
    try {
      const blob = await captureElement("analysis-results")
      downloadImage(blob, `speaker_words_${new Date().toISOString().split("T")[0]}.png`)
    } catch (error) {
      console.error("캡처 오류:", error)
    }
  }

  const handleKakaoShare = async () => {
    alert(
      "카카오톡 공유 기능을 사용하려면 Project Settings에서 카카오 JavaScript 키를 설정하고 카카오 SDK를 수동으로 로드해주세요.",
    )
  }

  const handleDownloadCSV = () => {
    if (analysis.length === 0) return
    const csv = generateWordAnalysisCSV(analysis)
    downloadCSV(csv, `speaker_words_${new Date().toISOString().split("T")[0]}.csv`)
  }

  const filteredAnalysis = analysis.filter((speakerAnalysis) => {
    if (selectedSpeaker !== "all" && speakerAnalysis.speaker !== selectedSpeaker) {
      return false
    }
    if (searchTerm) {
      return (
        speakerAnalysis.topWords.some((word) => word.word.toLowerCase().includes(searchTerm.toLowerCase())) ||
        speakerAnalysis.speaker.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    return true
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LoadingOverlay
        isLoading={isProcessing || isAnalyzing}
        message={isProcessing ? "파일 분석 중..." : "단어 분석 중..."}
      />

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">화자별 Top 단어</h1>
            <p className="text-muted-foreground">
              대화 참여자별로 가장 많이 사용한 단어들을 분석하고 사용 시점을 확인합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCapture} disabled={analysis.length === 0}>
              <Camera className="h-4 w-4 mr-2" />
              화면 캡처 저장
            </Button>
            <Button variant="outline" onClick={handleKakaoShare} disabled={analysis.length === 0}>
              <Share2 className="h-4 w-4 mr-2" />
              카카오톡 공유
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            파일 업로드
          </CardTitle>
          <CardDescription>카카오톡 대화 파일(.txt)을 업로드하여 화자별 단어 분석을 시작하세요.</CardDescription>
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

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleAnalyze} disabled={!parseResult || isAnalyzing} className="flex-1">
              {isAnalyzing ? "분석 중..." : "분석하기"}
            </Button>
            <div className="flex items-center space-x-2">
              <Switch id="detailed-log" checked={showDetailedLog} onCheckedChange={setShowDetailedLog} />
              <Label htmlFor="detailed-log">자세한 로그</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              분석 대상 화자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Chips items={includedSpeakers} onRemove={handleSpeakerRemove} onAdd={handleSpeakerAdd} addable={true} />
          </CardContent>
        </Card>
      )}

      {analysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>검색 및 필터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">단어 또는 화자 검색</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="검색어를 입력하세요"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speaker-filter">화자 필터</Label>
                <select
                  id="speaker-filter"
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                >
                  <option value="all">모든 화자</option>
                  {includedSpeakers.map((speaker) => (
                    <option key={speaker} value={speaker}>
                      {speaker}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.length > 0 && (
        <div id="analysis-results" className="space-y-6">
          {filteredAnalysis.map((speakerAnalysis) => {
            const topWord = speakerAnalysis.topWords[0]
            const sectionId = `speaker-${speakerAnalysis.speaker}`
            const isExpanded = expandedSections.has(sectionId)

            return (
              <Card key={speakerAnalysis.speaker}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <span>{speakerAnalysis.speaker}</span>
                      {topWord && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            {getRankIcon(topWord.word, speakerAnalysis.speaker)}
                            <span className="font-bold">{topWord.word}</span>
                            <span className="text-muted-foreground">({topWord.count}회)</span>
                          </Badge>
                        </div>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">순위</th>
                          <th className="text-left py-2 px-3">단어</th>
                          <th className="text-left py-2 px-3">횟수</th>
                          <th className="text-left py-2 px-3">글로벌 순위</th>
                        </tr>
                      </thead>
                      <tbody>
                        {speakerAnalysis.topWords.map((wordCount) => (
                          <tr key={wordCount.word} className="border-b">
                            <td className="py-2 px-3">{wordCount.rank}</td>
                            <td className="py-2 px-3 font-medium">{wordCount.word}</td>
                            <td className="py-2 px-3">{wordCount.count}</td>
                            <td className="py-2 px-3">{getRankIcon(wordCount.word, speakerAnalysis.speaker)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionId)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span>사용 시점 보기</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 mt-4">
                      {speakerAnalysis.topWords.slice(0, 5).map((wordCount) => {
                        const usages = speakerAnalysis.wordUsages[wordCount.word] || []
                        return (
                          <div key={wordCount.word} className="border rounded-lg p-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <span>"{wordCount.word}" 사용 내역</span>
                              <Badge variant="outline">{usages.length}회</Badge>
                            </h4>
                            <DataTable
                              data={usages}
                              columns={[
                                { key: "date", header: "날짜", sortable: true },
                                { key: "time", header: "시간", sortable: true },
                                {
                                  key: "message",
                                  header: "메시지",
                                  render: (value: string) => (
                                    <div className="max-w-md truncate" title={value}>
                                      {value}
                                    </div>
                                  ),
                                },
                              ]}
                              pageSize={10}
                            />
                          </div>
                        )
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )
          })}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                데이터 내보내기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleDownloadCSV}>
                분석 결과 CSV 다운로드
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {!parseResult && !isProcessing && (
        <EmptyState
          title="TXT를 업로드해 시작하세요"
          description="카카오톡 대화 파일을 업로드하면 화자별 단어 분석을 시작할 수 있습니다."
        />
      )}

      {showDetailedLog && parseResult && (
        <Card>
          <CardHeader>
            <CardTitle>상세 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>총 메시지 수: {parseResult.messages.length}</p>
              <p>유효한 메시지 수: {parseResult.validMessages}</p>
              <p>전체 라인 수: {parseResult.totalLines}</p>
              <p>추출된 화자 수: {parseResult.speakers.length}</p>
              <p>대화 시작일: {parseResult.conversationStartDate}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

declare global {
  interface Window {
    Kakao: any
  }
}
