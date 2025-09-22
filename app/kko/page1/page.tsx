"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Chips } from "@/components/ui/chips";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Download, FileText, Users, TrendingUp, Camera, Share2, UserRound,
} from "lucide-react";
import {
  parseKakaoTxt, getDaysSinceStart, formatKoreanDate,
} from "@/lib/parseKakao";
import { analyzeKeyword } from "@/lib/analysis";
import {
  generateKeywordSummaryCSV, generateKeywordDetailsCSV, downloadCSV,
} from "@/lib/csv";
import { captureAndSave, captureAndKakaoShare } from "@/lib/capture";
import type { ParseResult } from "@/lib/parseKakao";
import type { KeywordAnalysis } from "@/lib/analysis";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";

/* ------------------------------------------------------------------ */
/* types & helpers                                                     */
/* ------------------------------------------------------------------ */

type SpeakerStat = { speaker: string; totalHits: number; messageCount: number };
type TimelineRow = {
  date: string;
  time: string;
  speaker: string;
  message: string;
  hitsInMessage: number;
};

const DISTINCT_PALETTE = [
  "#E74C3C", "#FF6B81", "#F39C12", "#F1C40F",
  "#2ECC71", "#27AE60", "#3498DB", "#2980B9",
  "#9B59B6", "#8E44AD", "#1ABC9C", "#16A085",
  "#E67E22", "#D35400", "#95A5A6", "#7F8C8D",
  "#FFC300", "#FF5733", "#C70039", "#900C3F",
  "#581845", "#6C3483", "#5DADE2", "#48C9B0",
];

// 전체 화자 기준으로 색상 고정
function makeColorPicker(speakers: string[]) {
  const uniq = Array.from(new Set(speakers)).sort((a, b) => a.localeCompare(b));
  const n = DISTINCT_PALETTE.length;
  const spaced = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];

  const map = new Map<string, string>();
  uniq.forEach((name, i) => {
    const idx = spaced[i % n];
    map.set(name, DISTINCT_PALETTE[idx]);
  });

  return (name: string) => map.get(name) ?? DISTINCT_PALETTE[0];
}

function groupTimelineBySpeaker(rows: TimelineRow[]) {
  const by = new Map<string, TimelineRow[]>();
  for (const r of rows) {
    if (!by.has(r.speaker)) by.set(r.speaker, []);
    by.get(r.speaker)!.push(r);
  }
  for (const v of by.values()) v.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  return by; // Map 유지
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword) return text;
  const re = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-100 px-0.5 rounded">{p}</mark> : <span key={i}>{p}</span>
  );
}

function speakerDateRange(rows: { date: string; time: string }[]) {
  if (!rows.length) return { first: "", last: "" };
  const sorted = [...rows].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return {
    first: `${sorted[0]?.date ?? ""} ${sorted[0]?.time ?? ""}`.trim(),
    last: `${sorted.at(-1)?.date ?? ""} ${sorted.at(-1)?.time ?? ""}`.trim(),
  };
}

/* Y축 라벨(화자명) - 앞 3글자 + … */
const makeSpeakerTick =
  (colorOf: (name: string) => string) =>
  ({ x, y, payload }: any) => {
    const name = payload?.value as string;
    const short = name.length > 3 ? name.slice(0, 3) + "…" : name;
    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill={colorOf(name)}
        fontSize={12}
      >
        {short}
      </text>
    );
  };

/* ------------------------------------------------------------------ */
/* 아주 간단한 자체 Toast (외부 의존성 없이 사용)                      */
/* ------------------------------------------------------------------ */
function useSimpleToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };
  const Toast = () =>
    msg ? (
      <div className="fixed top-3 right-3 z-[60]">
        <div className="rounded-md border-2 border-red-200 bg-background px-3 py-2 shadow-md">
          <span className="text-sm">{msg}</span>
        </div>
      </div>
    ) : null;
  return { show, Toast };
}

/* ------------------------------------------------------------------ */

export default function KeywordCounterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [keyword, setKeyword] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [analysis, setAnalysis] = useState<KeywordAnalysis | null>(null);
  const [includedSpeakers, setIncludedSpeakers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false); // 화자 변경 재계산 로딩
  const [enforceExisting, setEnforceExisting] = useState(true); // 존재하는 화자만 추가 허용

  const { show: showToast, Toast } = useSimpleToast();

  // 색상 고정: 파싱된 전체 화자 기준
  const baseSpeakers = useMemo(
    () => (parseResult?.speakers ?? []).slice().sort((a, b) => a.localeCompare(b)),
    [parseResult]
  );
  const colorOf = useMemo(() => makeColorPicker(baseSpeakers), [baseSpeakers]);

  // 화자 변경 시 자동 재계산 + 로딩
  useEffect(() => {
    if (!analysis) return;               // 분석이 한 번도 안된 상태면 패스
    if (!parseResult || !keyword.trim()) return;

    setIsRecomputing(true);
    const id = setTimeout(() => {
      const next = analyzeKeyword(parseResult.messages, keyword.trim(), includedSpeakers);

      // 현재 선택된 화자들 기준 0건이면 결과 숨기고 토스트
      if (next.summary.totalKeywordHits === 0) {
        setAnalysis(null);
        setIsRecomputing(false);
        showToast(`선택한 화자들에서 '${keyword.trim()}' 키워드가 발견되지 않았습니다.`);
        return;
      }

      setAnalysis(next);
      setIsRecomputing(false);
    }, 0);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedSpeakers]);


  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseResult(null);
    setAnalysis(null);
    setIncludedSpeakers([]);
    setIsProcessing(true);
    setProgress(0);
    try {
      const t = setInterval(() => setProgress((p) => Math.min(p + 10, 90)), 100);
      const result = await parseKakaoTxt(selectedFile);
      clearInterval(t);
      setProgress(100);
      setParseResult(result);
      setIncludedSpeakers(result.speakers);
      setTimeout(() => { setIsProcessing(false); setProgress(0); }, 500);
    } catch (e) {
      console.error("파일 파싱 오류:", e);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleAnalyze = () => {
    if (!parseResult || !keyword.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = analyzeKeyword(parseResult.messages, keyword.trim(), includedSpeakers);

      // 전체 결과 0건이면 토스트만 띄우고 결과는 숨김
      if (result.summary.totalKeywordHits === 0) {
        setAnalysis(null);
        showToast(`'${keyword.trim()}' 키워드가 발견되지 않았습니다.`);
        setIsAnalyzing(false);
        return;
      }

      setAnalysis(result);
      setIsAnalyzing(false);
    }, 1000);
  };

  const handleSpeakerRemove = (s: string) => setIncludedSpeakers((prev) => prev.filter((x) => x !== s));

  const handleSpeakerAdd = (s: string) => {
    if (!parseResult) return false;
    const trimmed = s.trim();
    if (!trimmed) return false;

    if (includedSpeakers.includes(trimmed)) {
      showToast(`"${trimmed}" 화자는 이미 추가되어 있습니다.`);
      return false; // 실패 처리 → 입력창 유지
    }

    if (enforceExisting && !parseResult.speakers.includes(trimmed)) {
      showToast(`"${trimmed}" 화자는 이 대화에 존재하지 않습니다.`);
      return false; // 실패 -> 입력 유지
    }

    setIncludedSpeakers((p) => [...p, trimmed]);
    return true; // 성공 -> 입력 닫기
  };

  const handleClearFile = () => {
    setFile(null);
    setParseResult(null);
    setAnalysis(null);
    setIncludedSpeakers([]);
    setKeyword("");
  };

  const handleDownloadSummary = () => {
    if (!analysis) return;
    downloadCSV(generateKeywordSummaryCSV(analysis), `keyword_summary_${keyword}.csv`);
  };
  const handleDownloadDetails = () => {
    if (!analysis) return;
    downloadCSV(generateKeywordDetailsCSV(analysis), `keyword_details_${keyword}.csv`);
  };
  const handleDownloadMeta = () => {
    if (!analysis || !parseResult) return;
    const meta = {
      conversation_start_date: parseResult.conversationStartDate,
      days_since_start: getDaysSinceStart(parseResult.conversationStartDate),
      keyword: analysis.keyword,
      speakers: includedSpeakers,
      analysis_timestamp: new Date().toISOString(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyword_meta_${keyword}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKakaoShare = async () => {
    await captureAndKakaoShare(
      "analysis-results",
      async (dataUrl: string) => {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append("image", blob, "analysis.png");
        const res = await fetch("/api/share/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("업로드 실패");
        const { url } = await res.json();
        return url as string;
      },
      { title: "What's in my Kakao 분석 결과", description: "키워드 분석 결과를 확인해보세요!", linkUrl: typeof window !== "undefined" ? window.location.href : undefined }
    );
  };

  // 화자 수에 따라 차트 높이 자동 조절
  const chartHeight = useMemo(() => {
    const n = analysis ? analysis.speakerStats.length : includedSpeakers.length;
    return Math.max(220, n * 28 + 40);
  }, [analysis, includedSpeakers.length]);

  const orderedSpeakers = useMemo(() => {
  if (!analysis) return [];
  return [...analysis.speakerStats]
    .sort((a, b) => b.totalHits - a.totalHits)
    .map((s) => s.speaker)
    .filter((sp) => includedSpeakers.includes(sp));
  }, [analysis, includedSpeakers]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-3">
      <Toast />
      <LoadingOverlay
        isLoading={isProcessing || isAnalyzing || isRecomputing}
        message={
          isProcessing
            ? "파일 분석 중..."
            : isAnalyzing
            ? "키워드 분석 중..."
            : "필터 적용 중..."
        }
      />

      {/* 헤더 */}
      <div className="mb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">키워드 카운터</h1>
          <p className="text-muted-foreground">카카오톡 대화에서 특정 키워드의 사용 빈도를 분석하고 시각화합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => captureAndSave("analysis-results")} disabled={!analysis}>
            <Camera className="h-4 w-4 mr-2" /> 이미지 저장
          </Button>
          <Button variant="outline" onClick={handleKakaoShare} disabled={!analysis}>
            <Share2 className="h-4 w-4 mr-2" /> 카카오톡 공유
          </Button>
        </div>
      </div>

      {/* 업로드/키워드 */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> 파일 업로드 및 키워드 설정
          </CardTitle>
          <CardDescription>카카오톡 대화 파일(.txt)을 업로드하고 분석할 키워드를 입력하세요.</CardDescription>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">분석할 키워드</Label>
              <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 출근, 회의, 점심" disabled={!parseResult} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAnalyze} disabled={!parseResult || !keyword.trim() || isAnalyzing} className="w-full">
                {isAnalyzing ? "분석 중..." : "분석하기"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 화자 선택 */}
      {parseResult && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">
              <div className="flex items-center gap-2 min-w-0 leading-none">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">분석 대상 화자</span>
              </div>
            </CardTitle>
            <CardDescription className="text-xs">
              분석에 포함할 화자를 선택하세요. 기본적으로 모든 화자가 포함됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-4">
            <Chips
              items={includedSpeakers}
              onRemove={handleSpeakerRemove}
              onAdd={handleSpeakerAdd}
              addable
              getColor={colorOf}
            />

            {/* 존재하는 화자만 추가 허용 토글 */}
            {/* <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                className="accent-foreground"
                checked={enforceExisting}
                onChange={(e) => setEnforceExisting(e.target.checked)}
              />
              존재하는 화자만 추가 허용
            </label> */}
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {analysis && parseResult && (
        <div id="analysis-results" className="space-y-6">
          {/* 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="rounded-xl">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">
                  <div className="flex items-center gap-2 min-w-0 leading-none">
                    <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">경과 일수</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <p className="text-2xl font-bold">{getDaysSinceStart(parseResult.conversationStartDate)}일</p>
                <p className="text-xs text-muted-foreground mt-1">{formatKoreanDate(parseResult.conversationStartDate)} ~</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">
                  <div className="flex items-center gap-2 min-w-0 leading-none">
                    <span className="h-4 w-4 grid place-items-center text-muted-foreground">#</span>
                    <span className="truncate">총 키워드 발생</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold"><strong>{analysis.summary.totalKeywordHits}</strong></span>
                  <span className="text-sm text-muted-foreground"># {analysis.keyword}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">
                  <div className="flex items-center gap-2 min-w-0 leading-none">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">키워드 사용 TOP 1</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                {analysis.speakerStats.slice(0, 1).map((stat) => {
                  const c = colorOf(stat.speaker);
                  return (
                    <div key={stat.speaker} className="flex items-center justify-between">
                      <span className="text-2xl font-bold" style={{ color: c }}>{stat.speaker}</span>
                      <span className="text-sm text-muted-foreground">{stat.totalHits}회</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* 화자별 사용 횟수 차트 */}
          <Card className="rounded-xl">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">화자별 키워드 사용 횟수</CardTitle>
              <CardDescription className="text-xs">화자 간 사용량을 한눈에 비교합니다.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pr-2 pb-3" style={{ height: chartHeight }}>
              {(() => {
                const chartData = [...analysis.speakerStats]
                  .map((s: SpeakerStat) => ({ name: s.speaker, count: s.totalHits }))
                  .filter((d) => d.count > 0)   
                  .sort((a, b) => b.count - a.count);

                const SpeakerTick = makeSpeakerTick(colorOf);

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={chartData} layout="vertical" margin={{ top: 6, right: 12, left: 4, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={50}
                        tick={<SpeakerTick />}
                        interval={0}        // 모든 라벨 표시
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          const speaker = p?.payload?.name as string;
                          const color = colorOf(speaker);
                          return (
                            <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium">{speaker}</span>
                              </div>
                              <div className="mt-1 text-muted-foreground">총 {p?.value}회</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" barSize={14} radius={[4, 4, 4, 4]}>
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={colorOf(d.name)} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          {/* 타임라인 */}
          <Card>
            <CardHeader>
              <CardTitle>타임라인</CardTitle>
              <CardDescription>화자 이름을 클릭하면 해당 화자의 타임라인이 열립니다.</CardDescription>
            </CardHeader>

            <CardContent>
              <Accordion type="multiple" className="w-full">
                {(() => {
                  const grouped = groupTimelineBySpeaker(
                    analysis.timeline as unknown as TimelineRow[]
                  );

                  return orderedSpeakers.map((speaker) => {
                    const color = colorOf(speaker);
                    const rows = grouped.get(speaker) ?? [];
                    if (rows.length === 0) return null; // 0건은 보여줄 필요 없음

                    const { first, last } = speakerDateRange(rows);

                    return (
                      <AccordionItem
                        key={speaker}
                        value={speaker}
                        className="rounded-lg border mb-3"
                      >
                        <AccordionTrigger className="px-4 py-3">
                          <div className="flex w-full items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="h-4 w-1 rounded"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-semibold truncate">{speaker}</span>
                            </div>
                            <span
                              className="text-xs px-2 py-1 rounded-full bg-muted text-foreground shrink-0"
                              style={{ border: `1px solid ${color}` }}
                            >
                              {rows.length}건
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-0 pb-0">
                          <div className="px-4 pb-4">
                            {/* 날짜 범위 라벨: 본문 상단, 작은/연한 글씨 */}
                            <div className="mb-2 text-[11px] text-muted-foreground">
                              최초 {first} · 최신 {last}
                            </div>

                            <div className="overflow-x-auto">
                              <div className="min-w-[680px]">
                                {/* 헤더: sm 이상에서만 표시. 컬럼 수는 행과 동일하게 맞춘다 */}
                                <div className="hidden sm:grid sm:grid-cols-[180px_1fr] text-[12px] uppercase text-muted-foreground bg-muted/50 sticky top-0 px-4 py-2">
                                  <div>날짜 / 시간</div>
                                  <div>메시지</div>
                                </div>

                                <ul>
                                  {rows.map((r, i) => (
                                    <li
                                      key={i}
                                      className="
                                        grid grid-cols-1 sm:grid-cols-[180px_1fr]
                                        items-start border-b last:border-0
                                        px-4 py-2
                                        odd:bg-muted/10 hover:bg-muted/20 transition-colors
                                      "
                                    >
                                      {/* 날짜/시간: 더 작고 연한 색, 모노스페이스 */}
                                      <div className="sm:py-2 sm:pr-2 text-[11px] text-muted-foreground font-mono tabular-nums">
                                        {r.date} {r.time}
                                      </div>

                                      {/* 메시지: 가독성 유지, 키워드 하이라이트 */}
                                      <div className="sm:py-2 sm:pr-2 text-sm leading-relaxed">
                                        <div className="max-w-[70ch] sm:max-w-[90ch]">
                                          {highlightKeyword(r.message, analysis.keyword)}
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  });
                })()}
              </Accordion>
            </CardContent>
          </Card>


          {/* 다운로드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> 데이터 내보내기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleDownloadSummary}>요약 CSV 다운로드</Button>
                <Button variant="outline" onClick={handleDownloadDetails}>상세 CSV 다운로드</Button>
                <Button variant="outline" onClick={handleDownloadMeta}>메타데이터 JSON 다운로드</Button>
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
  );
}
