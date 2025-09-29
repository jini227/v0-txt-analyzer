"use client"

import { useState, useEffect, useMemo, useRef, Fragment } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Chips } from "@/components/ui/chips"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { Download, FileText, Users, Camera, Share2, Crown, Medal, Award, Info, ArrowUp } from "lucide-react"
import { parseKakaoTxt } from "@/lib/parseKakao"
import { analyzeWords } from "@/lib/analysis"
import { generateWordAnalysisCSV, downloadCSV } from "@/lib/csv"
import { captureAndSave, captureAndKakaoShare } from "@/lib/capture"
import type { ParseResult } from "@/lib/parseKakao"
import type { WordAnalysis } from "@/lib/analysis"

/* ---------------- 유틸: 하이라이트 ---------------- */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function highlightKeyword(text: string, keyword: string | undefined | null) {
  if (!keyword) return text
  try {
    const re = new RegExp(`(${escapeRegExp(keyword)})`, "gi")
    const parts = text.split(re)
    return parts.map((p, i) =>
      re.test(p) ? <mark key={i} className="bg-yellow-100 px-0.5 rounded">{p}</mark> : <span key={i}>{p}</span>
    )
  } catch {
    return text
  }
}

/* ---------------- 팔레트/유틸 ---------------- */
const DISTINCT_PALETTE = [
  "#E74C3C", "#FF6B81", "#F39C12", "#F1C40F",
  "#2ECC71", "#27AE60", "#3498DB", "#2980B9",
  "#9B59B6", "#8E44AD", "#1ABC9C", "#16A085",
  "#E67E22", "#D35400", "#95A5A6", "#7F8C8D",
  "#FFC300", "#FF5733", "#C70039", "#900C3F",
  "#581845", "#6C3483", "#5DADE2", "#48C9B0",
]
function makeColorPicker(speakers: string[]) {
  const uniq = Array.from(new Set(speakers)).sort((a, b) => a.localeCompare(b))
  const n = DISTINCT_PALETTE.length
  const spaced = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
  const map = new Map<string, string>()
  uniq.forEach((name, i) => map.set(name, DISTINCT_PALETTE[spaced[i % n]]))
  return (name: string) => map.get(name) ?? DISTINCT_PALETTE[0]
}

function useSimpleToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const show = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }
  const Toast = () =>
    msg ? (
      <div className="fixed top-3 right-3 z-[60]">
        <div className="rounded-md border-2 border-red-200 bg-background px-3 py-2 shadow-md">
          <span className="text-sm">{msg}</span>
        </div>
      </div>
    ) : null
  return { show, Toast }
}

type GlobalTopMap = Record<string, 1 | 2 | 3>

export default function SpeakerWordsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  const [analysis, setAnalysis] = useState<WordAnalysis[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isRecomputing, setIsRecomputing] = useState(false)

  const [includedSpeakers, setIncludedSpeakers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("all")
  const [openKeywords, setOpenKeywords] = useState<Set<string>>(new Set())

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const [globalTop, setGlobalTop] = useState<GlobalTopMap>({})
  const [globalTopList, setGlobalTopList] = useState<{ word: string; count: number }[]>([])

  const [showTopBtn, setShowTopBtn] = useState(false)
  const { show: showToast, Toast } = useSimpleToast()

  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 400)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 500, behavior: "smooth" })

  const baseSpeakers = useMemo(
    () => (parseResult?.speakers ?? []).slice().sort((a, b) => a.localeCompare(b)),
    [parseResult]
  )
  const colorOf = useMemo(() => makeColorPicker(baseSpeakers), [baseSpeakers])

  const speakerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const setSpeakerRef = (speaker: string) => (el: HTMLDivElement | null) => speakerRefs.current.set(speaker, el)
  const scrollToSpeaker = (speaker: string) => {
    const el = speakerRefs.current.get(speaker)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const toggleKeyword = (speaker: string, word: string) => {
    setOpenKeywords(prev => {
      const ns = new Set(prev)
      const key = speaker + "||" + word
      ns.has(key) ? ns.delete(key) : ns.add(key)
      return ns
    })
  }

  /* ---------------- 파일 업로드 ---------------- */
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setParseResult(null)
    setAnalysis([])
    setGlobalTop({})
    setGlobalTopList([])
    setIncludedSpeakers([])
    setIsProcessing(true)
    setProgress(0)

    try {
      const t = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 100)
      const result = await parseKakaoTxt(selectedFile)
      clearInterval(t)
      setProgress(100)
      setParseResult(result)
      setIncludedSpeakers(result.speakers)
      setTimeout(() => { setIsProcessing(false); setProgress(0) }, 400)
    } catch (e) {
      console.error(e)
      setIsProcessing(false); setProgress(0)
    }
  }

  const handleClearFile = () => {
    setFile(null); setParseResult(null)
    setAnalysis([]); setGlobalTop({}); setGlobalTopList([])
    setIncludedSpeakers([])
    setSearchTerm(""); setSelectedSpeaker("all")
    setOpenKeywords(new Set())
  }

  /* ---------------- 분석 ---------------- */
  const recomputeGlobalTop = (res: WordAnalysis[]) => {
    const totals = new Map<string, number>()
    for (const sa of res) for (const wc of sa.topWords) {
      totals.set(wc.word, (totals.get(wc.word) ?? 0) + wc.count)
    }
    const top3 = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const gt: GlobalTopMap = {}
    top3.forEach(([w], i) => (gt[w] = (i + 1) as 1 | 2 | 3))
    setGlobalTop(gt)
    setGlobalTopList(top3.map(([word, count]) => ({ word, count })))
  }

  const handleAnalyze = () => {
    if (!parseResult) return
    setIsAnalyzing(true)
    setTimeout(() => {
      const filtered = parseResult.messages.filter(m => includedSpeakers.includes(m.speaker))
      const res = analyzeWords(filtered)
      setAnalysis(res)
      recomputeGlobalTop(res)
      setIsAnalyzing(false)
    }, 200)
  }

  useEffect(() => {
    if (!parseResult) return
    if (!analysis.length) return
    setIsRecomputing(true)
    const id = setTimeout(() => {
      const filtered = parseResult.messages.filter(m => includedSpeakers.includes(m.speaker))
      const res = analyzeWords(filtered)
      if (!res.length) {
        setAnalysis([]); setGlobalTop({}); setGlobalTopList([])
        setIsRecomputing(false)
        showToast("선택한 화자들에서 키워드 Top이 생성되지 않았습니다.")
        return
      }
      setAnalysis(res)
      recomputeGlobalTop(res)
      setIsRecomputing(false)
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedSpeakers])

  const handleSpeakerRemove = (s: string) =>
    setIncludedSpeakers(prev => prev.filter(v => v !== s))
  const handleSpeakerAdd = (s: string) => {
    if (!parseResult) return false
    const name = s.trim()
    if (!name) return false
    if (includedSpeakers.includes(name)) { showToast(`"${name}" 화자는 이미 추가되어 있습니다.`); return false }
    if (!parseResult.speakers.includes(name)) { showToast(`"${name}" 화자는 이 대화에 존재하지 않습니다.`); return false }
    setIncludedSpeakers(prev => [...prev, name]); return true
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
      { title: "화자별 Top 단어", description: "키워드 분석 결과를 확인해보세요!", linkUrl: typeof window !== "undefined" ? window.location.href : undefined }
    )
  }

  const handleDownloadCSV = () => {
    if (!analysis.length) return
    const csv = generateWordAnalysisCSV(analysis)
    downloadCSV(csv, `kko_result_${Date.now()}.csv`)
  }

  /* ---------------- 표시용 파생 ---------------- */
  const filteredAnalysis = analysis.filter(sa => {
    if (selectedSpeaker !== "all" && sa.speaker !== selectedSpeaker) return false
    if (!searchTerm) return true
    return sa.speaker.toLowerCase().includes(searchTerm.toLowerCase())
      || sa.topWords.some(w => w.word.toLowerCase().includes(searchTerm.toLowerCase()))
  })

  const top1Summary = useMemo(() => {
    return analysis
      .map(sa => ({
        speaker: sa.speaker,
        word: sa.topWords[0]?.word ?? "",
        count: sa.topWords[0]?.count ?? 0,
      }))
      .filter(i => i.word)
      .sort((a, b) => b.count - a.count)
  }, [analysis])

  const globalBadge = (word: string) => {
    const rank = globalTop[word]
    if (!rank) return null
    const color =
      rank === 1 ? "w-5 h-5 text-yellow-400 stroke-[2.5]" :   // 금
      rank === 2 ? "w-4 h-4 text-gray-400 stroke-[2]"  :    // 은
                  "w-4 h-4 text-amber-600 stroke-[2]"      // 동
    return <Crown className={`h-4 w-4 ${color}`} />
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="analysis-results">
      {showTopBtn && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-primary text-white shadow-lg hover:bg-primary/80 transition p-3"
          aria-label="위로"
          title="위로"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <Toast />
      <LoadingOverlay
        isLoading={isProcessing || isAnalyzing || isRecomputing}
        message={isProcessing ? "파일 분석 중..." : isAnalyzing ? "단어 분석 중..." : "필터 적용 중..."}
      />

      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">화자별 Top 단어</h1>
            <p className="text-muted-foreground">대화 참여자별로 가장 많이 사용한 단어들을 분석하고 사용 시점을 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => captureAndSave("analysis-results")} disabled={!analysis.length}>
              <Camera className="h-4 w-4 mr-2" />
              이미지 저장
            </Button>
            <Button variant="outline" onClick={handleKakaoShare} disabled={!analysis.length}>
              <Share2 className="h-4 w-4 mr-2" />
              카카오로 공유
            </Button>
          </div>
        </div>
      </div>

      {/* 파일 업로드 */}
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
                <span>파일 분석 중...</span><span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleAnalyze} disabled={!parseResult || isAnalyzing} className="flex-1">
              {isAnalyzing ? "분석 중..." : "분석하기"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 분석 대상 화자 */}
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
            <Chips items={includedSpeakers} onRemove={handleSpeakerRemove} onAdd={handleSpeakerAdd} addable getColor={colorOf} />
            {isRecomputing && (
              <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <Info className="h-4 w-4" />
                필터 적용 중…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ✅ 전체 Top 박스 (요청 1) */}
      {analysis.length > 0 && globalTopList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>전체 TOP</CardTitle>
            <CardDescription>선택된 화자들의 모든 메시지를 합산한 상위 3개 단어입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {globalTopList.map((item, idx) => {
                const color = idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : "text-amber-600"
                return (
                  <div key={item.word} className="border rounded-lg p-3 flex items-center justify-between">
                    <div className="text-base font-semibold">{item.word}</div>
                    <div className="flex items-center gap-2">
                      <Crown className={`h-4 w-4 ${color}`} />
                      <div className="text-sm tabular-nums">{item.count}회</div>
                    </div>
                  </div>
                )
              })}

            </div>
          </CardContent>
        </Card>
      )}

      {/* 화자별 TOP 1 요약 */}
      {analysis.length > 0 && top1Summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>화자별 TOP 1 요약</CardTitle>
            <CardDescription>카드를 클릭하면 해당 화자의 Top10 위치로 이동합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {top1Summary.map(item => (
                <button
                  key={item.speaker}
                  onClick={() => scrollToSpeaker(item.speaker)}
                  className="text-left border rounded-lg p-3 flex items-center justify-between hover:bg-muted/40 transition"
                  style={{ borderColor: colorOf(item.speaker) }}
                >
                  <div>
                    <div className="text-xs text-muted-foreground">{item.speaker}</div>
                    <div className="text-base md:text-lg font-semibold flex items-center gap-2">
                      {item.word}
                      {globalBadge(item.word)}
                    </div>
                  </div>
                  <div className="text-sm md:text-base tabular-nums">{item.count}회</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검색 및 필터 */}
      {analysis.length > 0 && (
        <Card>
          <CardHeader><CardTitle>검색 및 필터</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">단어 또는 화자 검색</Label>
                <Input id="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="검색어를 입력하세요" />
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
                  {baseSpeakers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 화자 카드 (요청 2 반영: 전체 Top 컬럼 제거, 키워드 옆 아이콘 표시) */}
      {filteredAnalysis.map(sa => {
        const color = colorOf(sa.speaker)

        const q = searchTerm.trim().toLowerCase()
        const speakerMatched = q && sa.speaker.toLowerCase().includes(q)
        const visibleTopWords = !q || speakerMatched
          ? sa.topWords
          : sa.topWords.filter(w => w.word.toLowerCase().includes(q))
        if (!visibleTopWords.length) return null

        return (
          <div key={sa.speaker} ref={setSpeakerRef(sa.speaker) as any}>
            <Card className="border" style={{ borderColor: color }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span>{sa.speaker}</span>
                  {sa.topWords[0] && (
                    <Badge variant="secondary" className="flex items-center gap-1" style={{ borderColor: color }}>
                      <span className="font-bold">{sa.topWords[0].word}</span>
                      <span className="text-muted-foreground">({sa.topWords[0].count}회)</span>
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="table-fixed w-full text-sm">
                    <colgroup>
                      <col className="w-[15%]" />
                      <col className="w-[55%]" />
                      <col className="w-[30%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-3 text-center">순위</th>
                        <th className="py-2 px-3 text-left">단어</th>
                        <th className="py-2 px-3 text-center">횟수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTopWords.map(wc => {
                        const key = sa.speaker + "||" + wc.word
                        const open = openKeywords.has(key)
                        const usages = sa.wordUsages[wc.word] || []
                        return (
                          <Fragment key={key}>
                            <tr
                              className="border-b hover:bg-muted/40 cursor-pointer"
                              onClick={() => toggleKeyword(sa.speaker, wc.word)}
                            >
                              <td className="py-2 px-3 text-center">{wc.rank}</td>
                              <td className="py-2 px-3 font-medium truncate">
                                <span className="inline-flex items-center gap-2">
                                  {wc.word}
                                  {globalBadge(wc.word)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">{wc.count}</td>
                            </tr>
                            {open && (
                              <tr className="bg-muted/20">
                                <td colSpan={3} className="py-3 px-3">
                                  <div className="border rounded-lg p-3">
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                      <span>"{wc.word}" 사용 내역</span>
                                      <Badge variant="outline" style={{ borderColor: color }}>{usages.length}회</Badge>
                                    </h4>
                                    <DataTable
                                      data={usages}
                                      columns={[
                                        {
                                          key: "message",
                                          header: "메시지",
                                          render: (value: string) => (
                                            <div className="max-w-md truncate" title={value}>
                                              {highlightKeyword(value, wc.word)}
                                            </div>
                                          ),
                                        },
                                        { key: "date", header: "날짜", sortable: true },
                                        { key: "time", header: "시간", sortable: true },
                                      ]}
                                      pageSize={10}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}

      {/* 내보내기 */}
      {analysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              데이터 내보내기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleDownloadCSV}>분석 결과 CSV 다운로드</Button>
          </CardContent>
        </Card>
      )}

      {/* 빈 상태 */}
      {!parseResult && !isProcessing && (
        <EmptyState title="TXT를 업로드해 시작하세요" description="카카오톡 대화 파일을 업로드하면 화자별 단어 분석을 시작할 수 있습니다." />
      )}

      {/* 파일 정보 */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle>파일 정보</CardTitle>
            <CardDescription>업로드한 대화 파일의 기본 정보를 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <p>참여자 수: {parseResult.speakers.length}</p>
              <p>총 메시지 수: {parseResult.messages.length}</p>
              <p>대화 시작일: {parseResult.conversationStartDate}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

declare global {
  interface Window { Kakao: any }
}
