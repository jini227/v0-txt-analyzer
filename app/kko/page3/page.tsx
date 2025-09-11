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

// -------------------- 설정 타입 --------------------
interface VibeSettings {
  aggressivenessSensitivity: number
  praiseSensitivity: number
  questionSensitivity: number
  emotionSensitivity: number
  messageLengthSensitivity: number
  timePatternSensitivity: number
}

// 분석 피처 타입(heuristics.ts가 만들어 준 features와 동일 구조)
type Feature = {
  positiveCount: number
  negativeCount: number
  questionCount: number
  linkCount: number
  exclamationCount: number
  averageMessageLength: number
  timeDistribution: Record<string, number>
}

// -------------------- 유틸 · 점수화 --------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const scale = (pct: number, min: number, max: number) => min + (pct / 100) * (max - min)
const contrast = (x: number, gamma: number) => clamp01(Math.pow(clamp01(x), gamma))

// 1) 데이터만으로 만든 기본 점수(슬라이더 영향 없음)
function baseBucketScores(f: Feature) {
  const totalTime = Object.values(f.timeDistribution).reduce((a, b) => a + b, 0) || 1
  const r = (k: string) => (f.timeDistribution[k] || 0) / totalTime

  const totalSent = f.negativeCount + f.positiveCount
  const coverage = clamp01(totalSent / 30) // 샘플 부족 과대해석 방지

  const negRel = totalSent > 0 ? Math.max(0, f.negativeCount - f.positiveCount) / totalSent : 0
  const posRel = totalSent > 0 ? Math.max(0, f.positiveCount - f.negativeCount) / totalSent : 0

  const exclaim = clamp01(f.exclamationCount / 35)

  return {
    난폭: clamp01(negRel * 0.9 + exclaim * 0.1) * coverage,
    긍정: clamp01(posRel) * coverage,
    궁금: clamp01(f.questionCount / 25),
    링크: clamp01(f.linkCount / 20),
    감탄: clamp01(f.exclamationCount / 35),
    수다: clamp01(f.averageMessageLength / 120),
    올빼미: clamp01(r("새벽") / 0.45),
    아침형: clamp01(r("오전") / 0.45),
  }
}

// 2) 슬라이더 가중/바이어스 강하게 적용
function applySettingsWeights(base: Record<string, number>, settings: VibeSettings) {
  // 0.25~4배 가중, -0.25~+0.25 바이어스
  const w = {
    난폭: scale(settings.aggressivenessSensitivity, 0.25, 4.0),
    긍정: scale(settings.praiseSensitivity, 0.25, 4.0),
    궁금: scale(settings.questionSensitivity, 0.25, 4.0),
    감탄: scale(settings.emotionSensitivity, 0.25, 4.0),
    수다: scale(settings.messageLengthSensitivity, 0.25, 4.0),
    올빼미: scale(settings.timePatternSensitivity, 0.25, 4.0),
    아침형: scale(settings.timePatternSensitivity, 0.25, 4.0),
    링크: 1.0,
  }
  const b = {
    난폭: scale(settings.aggressivenessSensitivity, -0.25, 0.25),
    긍정: scale(settings.praiseSensitivity, -0.25, 0.25),
    궁금: scale(settings.questionSensitivity, -0.2, 0.2),
    감탄: scale(settings.emotionSensitivity, -0.2, 0.2),
    수다: scale(settings.messageLengthSensitivity, -0.2, 0.2),
    올빼미: scale(settings.timePatternSensitivity, -0.15, 0.15),
    아침형: scale(settings.timePatternSensitivity, -0.15, 0.15),
    링크: 0,
  }

  const out: Record<string, number> = {}
  for (const k of Object.keys(base)) {
    out[k] = clamp01(base[k] * (w as any)[k] + (b as any)[k])
  }

  // 극단값 부스트
  if (settings.aggressivenessSensitivity >= 90 && base["난폭"] > 0.05) out["난폭"] = clamp01(out["난폭"] + 0.15)
  if (settings.praiseSensitivity >= 90 && base["긍정"] > 0.05) out["긍정"] = clamp01(out["긍정"] + 0.15)
  if (settings.questionSensitivity >= 90 && base["궁금"] > 0.05) out["궁금"] = clamp01(out["궁금"] + 0.12)
  if (settings.emotionSensitivity >= 90 && base["감탄"] > 0.05) out["감탄"] = clamp01(out["감탄"] + 0.12)
  if (settings.messageLengthSensitivity >= 90 && base["수다"] > 0.05) out["수다"] = clamp01(out["수다"] + 0.12)

  // 대비(감마)로 순위 차 더 벌리기
  const gamma = 0.65
  for (const k of Object.keys(out)) out[k] = contrast(out[k], gamma)

  return out
}

// 3) 최종 점수 (이 값을 기준으로 별명/특성 결정)
function finalBucketScores(f: Feature, settings: VibeSettings) {
  const base = baseBucketScores(f)
  return applySettingsWeights(base, settings)
}

// -------------------- 별명/특성 사전 & 중복 방지 --------------------
const nicknameSynonyms: Record<string, string[]> = {
  난폭: ["직설가", "스트레이트", "확신러", "난폭왕"],
  긍정: ["해피메이커", "햇살러", "무드업", "갓"],
  // ‘호기심천국’은 후순위로
  궁금: ["질문요정", "왜맨", "호기심러", "탐구왕", "호기심천국"],
  링크: ["링크수집가", "정보브로커", "링크러", "자료왕"],
  감탄: ["리액션장인", "표현대장", "감탄머신", "리액션봇"],
  수다: ["디테일러", "장문러", "설명왕", "분석러"],
  올빼미: ["올빼미", "야행성", "새벽러", "밤지킴이"],
  아침형: ["아침형", "아침지킴이", "모닝러", "모닝버드"],
}

const traitSynonyms: Record<string, string[]> = {
  난폭: ["과격파", "직설파", "스트레이트"],
  긍정: ["긍정왕", "낙관파", "분위기메이커"],
  궁금: ["궁금이", "탐구파", "왜많이묻는러"],
  링크: ["링크수집가", "정보수집가", "큐레이터"],
  감탄: ["리액션장인", "표현대장", "감탄러"],
  수다: ["디테일러", "장문러", "설명러"],
  올빼미: ["올빼미", "야행성", "새벽형"],
  아침형: ["아침형", "모닝형", "아침지킴이"],
}

const isKing = (s: string) => s.endsWith("왕")
const kingHead = (s: string) => (isKing(s) ? s.slice(0, -1) : "")

function chooseNicknameBase(
  primaryKey: string,
  secondaryKey: string | undefined,
  usedBases: Set<string>,
  usedKingHeads: Set<string>,
) {
  const list = nicknameSynonyms[primaryKey] ?? []

  // 1) 비-왕 & 미사용
  for (const b of list)
    if (!isKing(b) && !usedBases.has(b)) {
      usedBases.add(b)
      return b
    }

  // 2) 왕 & 미사용 & 헤드 미사용
  for (const b of list) {
    if (isKing(b) && !usedBases.has(b) && !usedKingHeads.has(kingHead(b))) {
      usedBases.add(b)
      usedKingHeads.add(kingHead(b))
      return b
    }
  }

  // 3) 동의어 소진 시 하이브리드
  if (secondaryKey) {
    const a =
      (nicknameSynonyms[primaryKey] || []).find((x) => !isKing(x)) || (nicknameSynonyms[primaryKey] || [primaryKey])[0]
    const b =
      (nicknameSynonyms[secondaryKey] || []).find((x) => !isKing(x)) ||
      (nicknameSynonyms[secondaryKey] || [secondaryKey])[0]
    const hybrid = `${a}-${b}`
    if (!usedBases.has(hybrid)) {
      usedBases.add(hybrid)
      return hybrid
    }
  }

  // 4) 최후: 자연 접미어
  const seed = (nicknameSynonyms[primaryKey] || [primaryKey])[0]
  for (const t of ["에이스", "리드", "마스터"]) {
    const v = `${seed}${t}`
    if (!usedBases.has(v)) {
      usedBases.add(v)
      return v
    }
  }
  usedBases.add(seed)
  return seed
}

// -------------------- 별명/특성 생성(슬라이더 반영) --------------------
function makeNicknameAndTraits(
  speaker: string,
  f: Feature,
  settings: VibeSettings,
  usedNicknameBases: Set<string>,
  usedKingHeads: Set<string>,
  traitUsageCount: Map<string, number>,
): { nickname: string; traits: string[] } {
  // 1) 슬라이더 반영 최종 점수
  const scores = finalBucketScores(f, settings)
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const topKey = ordered[0][0]
  const secondKey = ordered[1]?.[0]

  // 2) 별명 베이스 선택(겹치지 않게)
  const base = chooseNicknameBase(topKey, secondKey, usedNicknameBases, usedKingHeads)
  const nickname = `${base}${speaker}`

  // 3) 특성: 임계 0.33 이상, 덜 쓰인 라벨 우선, 최대 3개
  const traits: string[] = []
  for (const [k, v] of ordered.slice(1)) {
    if (v < 0.33) continue
    const candidates = traitSynonyms[k] ?? [k]
    let best = candidates[0]
    let bestCnt = traitUsageCount.get(best) ?? 0
    for (const c of candidates) {
      const cnt = traitUsageCount.get(c) ?? 0
      if (cnt < bestCnt) {
        best = c
        bestCnt = cnt
      }
    }
    if (!traits.includes(best)) {
      traits.push(best)
      traitUsageCount.set(best, (traitUsageCount.get(best) ?? 0) + 1)
    }
    if (traits.length >= 3) break
  }

  // 4) 보완: 하나도 못 뽑으면 2등 키에서 1개
  if (traits.length === 0 && ordered[1]) {
    const t = (traitSynonyms[ordered[1][0]] ?? [ordered[1][0]])[0]
    traits.push(t)
    traitUsageCount.set(t, (traitUsageCount.get(t) ?? 0) + 1)
  }

  return { nickname, traits }
}

// -------------------- 컴포넌트 --------------------
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

  const enhanceWithAI = async (
    messages: any[],
    speakers: string[],
  ): Promise<{ roomSummary: string; speakerAnalyses: any[] }> => {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.slice(0, 100), // 최대 100개 메시지만 전송
        speakers: speakers,
      }),
    })

    if (!response.ok) {
      throw new Error("AI 분석 요청 실패")
    }

    const aiResult = await response.json()

    // AI 결과를 기존 형식에 맞게 변환
    const speakerAnalyses = aiResult.speakerAnalyses.map((analysis: any) => ({
      speaker: analysis.speaker,
      nickname: analysis.nickname,
      traits: analysis.traits,
      features: {
        positiveCount: 0,
        negativeCount: 0,
        questionCount: 0,
        linkCount: 0,
        exclamationCount: 0,
        averageMessageLength: 0,
        timeDistribution: {},
      },
      evidenceSnippets: [analysis.analysis || ""],
    }))

    return {
      roomSummary: aiResult.roomSummary,
      speakerAnalyses: speakerAnalyses,
    }
  }

  const handleAnalyze = async () => {
    if (!parseResult) return
    setIsAnalyzing(true)

    try {
      const filteredMessages = parseResult.messages.filter((msg) => includedSpeakers.includes(msg.speaker))

      if (useAI) {
        try {
          const aiResult = await enhanceWithAI(filteredMessages, includedSpeakers)
          setRoomSummary(aiResult.roomSummary)
          setSpeakerAnalyses(aiResult.speakerAnalyses)
        } catch (error) {
          console.error("AI 분석 오류:", error)
          // AI 실패 시 휴리스틱 분석으로 폴백
          const heuristicResult = analyzeVibe(filteredMessages)
          const usedNicknameBases = new Set<string>()
          const usedKingHeads = new Set<string>()
          const traitUsageCount = new Map<string, number>()

          const adjustedAnalyses = heuristicResult.speakerAnalyses.map((analysis) => {
            const { nickname, traits } = makeNicknameAndTraits(
              analysis.speaker,
              analysis.features as Feature,
              settings,
              usedNicknameBases,
              usedKingHeads,
              traitUsageCount,
            )
            return { ...analysis, nickname, traits }
          })

          setRoomSummary(`${heuristicResult.roomSummary} (AI 분석 실패로 휴리스틱 분석 사용)`)
          setSpeakerAnalyses(adjustedAnalyses)
        }
      } else {
        // 휴리스틱 분석
        const heuristicResult = analyzeVibe(filteredMessages)
        const usedNicknameBases = new Set<string>()
        const usedKingHeads = new Set<string>()
        const traitUsageCount = new Map<string, number>()

        const adjustedAnalyses = heuristicResult.speakerAnalyses.map((analysis) => {
          const { nickname, traits } = makeNicknameAndTraits(
            analysis.speaker,
            analysis.features as Feature,
            settings,
            usedNicknameBases,
            usedKingHeads,
            traitUsageCount,
          )
          return { ...analysis, nickname, traits }
        })

        setRoomSummary(heuristicResult.roomSummary)
        setSpeakerAnalyses(adjustedAnalyses)
      }
    } catch (error) {
      console.error("분석 오류:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSpeakerRemove = (speaker: string) => {
    setIncludedSpeakers((prev) => prev.filter((s) => s !== speaker))
  }
  const handleSpeakerAdd = (speaker: string) => {
    if (!includedSpeakers.includes(speaker)) setIncludedSpeakers((prev) => [...prev, speaker])
  }
  const handleClearFile = () => {
    setFile(null)
    setParseResult(null)
    setRoomSummary("")
    setSpeakerAnalyses([])
    setIncludedSpeakers([])
  }
  const handleReanalyze = () => handleAnalyze()

  const getTimeDistributionText = (timeDistribution: Record<string, number>) => {
    const total = Object.values(timeDistribution).reduce((sum, count) => sum + count, 0)
    if (total === 0) return "데이터 없음"
    const percentages = Object.entries(timeDistribution)
      .map(([time, count]) => `${time} ${Math.round((count / total) * 100)}%`)
      .join(", ")
    return percentages
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
              {[
                ["aggressivenessSensitivity", "과격함 민감도"],
                ["praiseSensitivity", "칭찬 민감도"],
                ["questionSensitivity", "질문 민감도"],
                ["emotionSensitivity", "감정표현 민감도"],
                ["messageLengthSensitivity", "메시지길이 민감도"],
                ["timePatternSensitivity", "시간패턴 민감도"],
              ].map(([key, label]) => (
                <div className="space-y-3" key={key}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key}>{label}</Label>
                    <span className="text-sm text-muted-foreground">
                      {(settings as any)[key as keyof VibeSettings]}%
                    </span>
                  </div>
                  <Slider
                    id={key}
                    min={0}
                    max={100}
                    step={10}
                    value={[(settings as any)[key as keyof VibeSettings]]}
                    onValueChange={([value]) => setSettings((prev) => ({ ...prev, [key]: value }) as any)}
                    className="w-full"
                  />
                </div>
              ))}
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
