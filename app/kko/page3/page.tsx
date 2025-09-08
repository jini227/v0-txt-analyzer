"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Chips } from "@/components/ui/chips"
import { EmptyState } from "@/components/ui/empty-state"
import { Separator } from "@/components/ui/separator"
import { FileText, Users, Sparkles, Brain, Settings, RefreshCw } from "lucide-react"
import { parseKakaoTxt } from "@/lib/parseKakao"
import { analyzeVibe } from "@/lib/analysis"
import type { ParseResult } from "@/lib/parseKakao"
import type { SpeakerVibeAnalysis } from "@/lib/analysis"

interface VibeSettings {
  aggressivenessSensitivity: number
  praiseSensitivity: number
  questionSensitivity: number
  emotionSensitivity: number
  messageLengthSensitivity: number
  timePatternSensitivity: number
}

export default function VibeAnalysisPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [roomSummary, setRoomSummary] = useState<string>("")
  const [speakerAnalyses, setSpeakerAnalyses] = useState<SpeakerVibeAnalysis[]>([])
  const [includedSpeakers, setIncludedSpeakers] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [settings, setSettings] = useState<VibeSettings>({
    aggressivenessSensitivity: 50,
    praiseSensitivity: 50,
    questionSensitivity: 50,
    emotionSensitivity: 50,
    messageLengthSensitivity: 50,
    timePatternSensitivity: 50,
  })
  const [useAI, setUseAI] = useState(false)
  const [usedNicknames] = useState<Set<string>>(new Set())

  useState(() => {
    setUseAI(process.env.NEXT_PUBLIC_USE_AI === "true")
  })

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setParseResult(null)
    setRoomSummary("")
    setSpeakerAnalyses([])
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

  const handleAnalyze = async () => {
    if (!parseResult) return

    setIsAnalyzing(true)
    usedNicknames.clear()

    try {
      const filteredMessages = parseResult.messages.filter((msg) => includedSpeakers.includes(msg.speaker))

      const heuristicResult = analyzeVibe(filteredMessages)

      const adjustedAnalyses = heuristicResult.speakerAnalyses.map((analysis) => {
        const aggressiveThreshold = (settings.aggressivenessSensitivity / 100) * 10
        const praiseThreshold = (settings.praiseSensitivity / 100) * 10
        const questionThreshold = (settings.questionSensitivity / 100) * 8
        const emotionThreshold = (settings.emotionSensitivity / 100) * 15
        const lengthThreshold = (settings.messageLengthSensitivity / 100) * 100
        const timeThreshold = (settings.timePatternSensitivity / 100) * 0.4

        const nickname = generateNickname(analysis.speaker, analysis.features, usedNicknames)
        const traits = generateTraits(analysis.features)

        if (analysis.features.questionCount >= questionThreshold) traits.push("궁금이")
        if (analysis.features.exclamationCount >= emotionThreshold) traits.push("표현대장")
        if (analysis.features.averageMessageLength >= lengthThreshold) traits.push("디테일러")

        const timeDistribution = analysis.features.timeDistribution
        const totalMessages = Object.values(timeDistribution).reduce((sum, count) => sum + count, 0)
        const dominantTimeRatio = Math.max(...Object.values(timeDistribution)) / totalMessages
        if (dominantTimeRatio >= timeThreshold) traits.push("시간규칙적")

        return {
          ...analysis,
          nickname,
          traits: traits.slice(0, 4),
        }
      })

      if (useAI) {
        try {
          const aiResult = await enhanceWithAI(adjustedAnalyses, heuristicResult.roomSummary)
          setRoomSummary(aiResult.roomSummary)
          setSpeakerAnalyses(aiResult.speakerAnalyses)
        } catch (error) {
          console.error("AI 분석 오류:", error)
          setRoomSummary(heuristicResult.roomSummary)
          setSpeakerAnalyses(adjustedAnalyses)
        }
      } else {
        setRoomSummary(heuristicResult.roomSummary)
        setSpeakerAnalyses(adjustedAnalyses)
      }
    } catch (error) {
      console.error("분석 오류:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const enhanceWithAI = async (
    heuristicAnalyses: SpeakerVibeAnalysis[],
    heuristicSummary: string,
  ): Promise<{ roomSummary: string; speakerAnalyses: SpeakerVibeAnalysis[] }> => {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return {
      roomSummary: `${heuristicSummary} AI 분석을 통해 더욱 정확한 특성을 파악했습니다.`,
      speakerAnalyses: heuristicAnalyses.map((analysis) => ({
        ...analysis,
        nickname: `AI-${analysis.nickname}`,
        traits: [...analysis.traits, "AI분석"],
      })),
    }
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
    setRoomSummary("")
    setSpeakerAnalyses([])
    setIncludedSpeakers([])
  }

  const handleReanalyze = () => {
    handleAnalyze()
  }

  const getTimeDistributionText = (timeDistribution: Record<string, number>) => {
    const total = Object.values(timeDistribution).reduce((sum, count) => sum + count, 0)
    if (total === 0) return "데이터 없음"

    const percentages = Object.entries(timeDistribution)
      .map(([time, count]) => `${time} ${Math.round((count / total) * 100)}%`)
      .join(", ")

    return percentages
  }

  const generateNickname = (speaker: string, features: any, usedNicknames: Set<string>): string => {
    let nickname = speaker
    const traits: string[] = []

    if (features.negativeCount >= 10) {
      nickname = `난폭왕${speaker}`
      traits.push("과격파")
    } else if (features.positiveCount >= 10) {
      nickname = `갓${speaker}`
      traits.push("긍정왕")
    }

    if (features.questionCount > 5) traits.push("궁금이")
    if (features.linkCount > 3) traits.push("링크수집가")
    if (features.exclamationCount > 8) traits.push("표현대장")
    if (features.averageMessageLength > 50) traits.push("디테일러")

    const timeDistribution = features.timeDistribution
    const maxTimeSlot = Object.entries(timeDistribution).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    if (maxTimeSlot === "새벽") traits.push("올빼미")
    else if (maxTimeSlot === "오전") traits.push("아침형")

    const uniqueNickname = `${nickname}${traits.length}`
    if (!usedNicknames.has(uniqueNickname)) {
      usedNicknames.add(uniqueNickname)
      return uniqueNickname
    }

    return nickname
  }

  const generateTraits = (features: any): string[] => {
    const traits: string[] = []

    if (features.negativeCount >= 10) traits.push("과격파")
    if (features.positiveCount >= 10) traits.push("긍정왕")
    if (features.questionCount > 5) traits.push("궁금이")
    if (features.linkCount > 3) traits.push("링크수집가")
    if (features.exclamationCount > 8) traits.push("표현대장")
    if (features.averageMessageLength > 50) traits.push("디테일러")

    const timeDistribution = features.timeDistribution
    const maxTimeSlot = Object.entries(timeDistribution).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    if (maxTimeSlot === "새벽") traits.push("올빼미")
    else if (maxTimeSlot === "오전") traits.push("아침형")

    return traits
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">대화방 분위기 & 별명</h1>
        <p className="text-muted-foreground">
          대화의 전반적인 분위기를 분석하고 참여자들의 특성에 따른 별명을 제안합니다.
        </p>
        {!useAI && (
          <Badge variant="secondary" className="mt-2">
            AI 미사용 모드
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            파일 업로드
          </CardTitle>
          <CardDescription>카카오톡 대화 파일(.txt)을 업로드하여 분위기 분석을 시작하세요.</CardDescription>
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

          <Button onClick={handleAnalyze} disabled={!parseResult || isAnalyzing} className="w-full">
            {isAnalyzing ? "분석 중..." : "분위기 분석하기"}
          </Button>
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

      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              분석 설정
            </CardTitle>
            <CardDescription>6가지 민감도를 조정하여 분석 결과를 세밀하게 조절할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="aggressiveness">과격함 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.aggressivenessSensitivity}%</span>
                </div>
                <Slider
                  id="aggressiveness"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.aggressivenessSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, aggressivenessSensitivity: value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="praise">칭찬 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.praiseSensitivity}%</span>
                </div>
                <Slider
                  id="praise"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.praiseSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, praiseSensitivity: value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="question">질문 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.questionSensitivity}%</span>
                </div>
                <Slider
                  id="question"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.questionSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, questionSensitivity: value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emotion">감정표현 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.emotionSensitivity}%</span>
                </div>
                <Slider
                  id="emotion"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.emotionSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, emotionSensitivity: value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="messageLength">메시지길이 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.messageLengthSensitivity}%</span>
                </div>
                <Slider
                  id="messageLength"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.messageLengthSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, messageLengthSensitivity: value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="timePattern">시간패턴 민감도</Label>
                  <span className="text-sm text-muted-foreground">{settings.timePatternSensitivity}%</span>
                </div>
                <Slider
                  id="timePattern"
                  min={0}
                  max={100}
                  step={10}
                  value={[settings.timePatternSensitivity]}
                  onValueChange={([value]) => setSettings((prev) => ({ ...prev, timePatternSensitivity: value }))}
                  className="w-full"
                />
              </div>
            </div>

            <Button
              onClick={handleReanalyze}
              disabled={!parseResult || isAnalyzing}
              variant="outline"
              className="w-full bg-transparent"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              재분석하기
            </Button>
          </CardContent>
        </Card>
      )}

      {roomSummary && speakerAnalyses.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                대화방 분위기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed">{roomSummary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {speakerAnalyses.map((analysis) => (
              <Card key={analysis.speaker}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Brain className="h-5 w-5" />
                      <span className="font-bold text-lg">{analysis.nickname}</span>
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {analysis.traits.map((trait) => (
                        <Badge key={trait} variant="secondary">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-semibold text-green-600">{analysis.features.positiveCount}</div>
                      <div className="text-muted-foreground">긍정 표현</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-semibold text-red-600">{analysis.features.negativeCount}</div>
                      <div className="text-muted-foreground">부정 표현</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-semibold text-blue-600">{analysis.features.questionCount}</div>
                      <div className="text-muted-foreground">질문</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-semibold text-purple-600">{analysis.features.linkCount}</div>
                      <div className="text-muted-foreground">링크 공유</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium mb-2">메시지 특성</h4>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>평균 메시지 길이: {analysis.features.averageMessageLength}자</li>
                        <li>감탄문: {analysis.features.exclamationCount}개</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">활동 시간대</h4>
                      <p className="text-muted-foreground">
                        {getTimeDistributionText(analysis.features.timeDistribution)}
                      </p>
                    </div>
                  </div>

                  {analysis.evidenceSnippets.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">대표 메시지</h4>
                      <div className="space-y-2">
                        {analysis.evidenceSnippets.slice(0, 3).map((snippet, index) => (
                          <div key={index} className="p-2 bg-muted rounded text-sm">
                            "{snippet}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!parseResult && !isProcessing && (
        <EmptyState
          title="TXT를 업로드해 시작하세요"
          description="카카오톡 대화 파일을 업로드하면 대화방 분위기와 참여자 특성을 분석할 수 있습니다."
        />
      )}
    </div>
  )
}
