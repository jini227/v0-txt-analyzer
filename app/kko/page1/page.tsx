"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Chips } from "@/components/ui/chips";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Download,
  FileText,
  Calendar,
  Users,
  TrendingUp,
  Camera,
  Share2,
  UserRound,
} from "lucide-react";
import {
  parseKakaoTxt,
  getDaysSinceStart,
  formatKoreanDate,
} from "@/lib/parseKakao";
import { analyzeKeyword } from "@/lib/analysis";
import {
  generateKeywordSummaryCSV,
  generateKeywordDetailsCSV,
  downloadCSV,
} from "@/lib/csv";
import { captureAndSave, captureAndKakaoShare } from "@/lib/capture";
import type { ParseResult } from "@/lib/parseKakao";
import type { KeywordAnalysis } from "@/lib/analysis";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

type SpeakerStat = { speaker: string; totalHits: number; messageCount: number };
type TimelineRow = {
  date: string;
  time: string;
  speaker: string;
  message: string;
  hitsInMessage: number; // 사용 안 해도 유지 가능
};

function groupTimelineBySpeaker(rows: TimelineRow[]) {
  const by = new Map<string, TimelineRow[]>();
  for (const r of rows) {
    if (!by.has(r.speaker)) by.set(r.speaker, []);
    by.get(r.speaker)!.push(r);
  }
  for (const v of by.values()) {
    v.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  }
  return Array.from(by.entries());
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword) return text;
  const re = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-yellow-100 px-0.5 rounded">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function colorFromString(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}

function speakerDateRange(rows: { date: string; time: string }[]) {
  const sorted = [...rows].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time)
  );
  return {
    first: `${sorted[0]?.date ?? ""} ${sorted[0]?.time ?? ""}`.trim(),
    last: `${sorted.at(-1)?.date ?? ""} ${sorted.at(-1)?.time ?? ""}`.trim(),
  };
}

// Y축 라벨을 화자 색으로 렌더링
const SpeakerTick = ({ x, y, payload }: any) => {
  const name = payload?.value as string;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={colorFromString(name)}>
      {name}
    </text>
  );
};

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

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseResult(null);
    setAnalysis(null);
    setIsProcessing(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const result = await parseKakaoTxt(selectedFile);

      clearInterval(progressInterval);
      setProgress(100);

      setParseResult(result);
      setIncludedSpeakers(result.speakers);

      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 500);
    } catch (error) {
      console.error("파일 파싱 오류:", error);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleAnalyze = () => {
    if (!parseResult || !keyword.trim()) return;

    setIsAnalyzing(true);

    setTimeout(() => {
      const result = analyzeKeyword(
        parseResult.messages,
        keyword.trim(),
        includedSpeakers
      );
      setAnalysis(result);
      setIsAnalyzing(false);
    }, 1000);
  };

  const handleSpeakerRemove = (speaker: string) => {
    setIncludedSpeakers((prev) => prev.filter((s) => s !== speaker));
  };

  const handleSpeakerAdd = (speaker: string) => {
    if (!includedSpeakers.includes(speaker)) {
      setIncludedSpeakers((prev) => [...prev, speaker]);
    }
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
    const csv = generateKeywordSummaryCSV(analysis);
    downloadCSV(csv, `keyword_summary_${keyword}.csv`);
  };

  const handleDownloadDetails = () => {
    if (!analysis) return;
    const csv = generateKeywordDetailsCSV(analysis);
    downloadCSV(csv, `keyword_details_${keyword}.csv`);
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
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `keyword_meta_${keyword}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleKakaoShare = async () => {
    await captureAndKakaoShare(
      "analysis-results",
      async (dataUrl: string) => {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append("image", blob, "analysis.png");
        const res = await fetch("/api/share/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("업로드 실패");
        const { url } = await res.json();
        return url as string;
      },
      {
        title: "What's in my Kakao 분석 결과",
        description: "키워드 분석 결과를 확인해보세요!",
        linkUrl:
          typeof window !== "undefined" ? window.location.href : undefined,
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-3">
      <LoadingOverlay
        isLoading={isProcessing || isAnalyzing}
        message={isProcessing ? "파일 분석 중..." : "키워드 분석 중..."}
      />

      {/* 헤더 / 액션 */}
      <div className="mb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">키워드 카운터</h1>
            <p className="text-muted-foreground">
              카카오톡 대화에서 특정 키워드의 사용 빈도를 분석하고 시각화합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => captureAndSave("analysis-results")}
              disabled={!analysis}
            >
              <Camera className="h-4 w-4 mr-2" />
              이미지 저장
            </Button>

            <Button
              variant="outline"
              onClick={handleKakaoShare}
              disabled={!analysis}
            >
              <Share2 className="h-4 w-4 mr-2" />
              카카오톡 공유
            </Button>
          </div>
        </div>
      </div>

      {/* 파일 업로드 및 키워드 입력 */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            파일 업로드 및 키워드 설정
          </CardTitle>
          <CardDescription>
            카카오톡 대화 파일(.txt)을 업로드하고 분석할 키워드를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            onFileSelect={handleFileSelect}
            selectedFile={file}
            onClearFile={handleClearFile}
          />

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
              getColor={colorFromString}
            />
            
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {analysis && parseResult && (
        <div id="analysis-results" className="space-y-6">
          {/* 요약 카드 3열 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 경과 일수 */}
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
                <p className="text-2xl font-bold">
                  {getDaysSinceStart(parseResult.conversationStartDate)}일
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatKoreanDate(parseResult.conversationStartDate)} ~
                </p>
              </CardContent>
            </Card>

            {/* 총 키워드 발생 */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">
                  <div className="flex items-center gap-2 min-w-0 leading-none">
                    <span className="h-4 w-4 grid place-items-center text-muted-foreground">
                      #
                    </span>
                    <span className="truncate">총 키워드 발생</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">
                    <strong>{analysis.summary.totalKeywordHits}</strong>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    # {analysis.keyword}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* TOP1 */}
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
                  const c = colorFromString(stat.speaker);
                  return (
                    <div
                      key={stat.speaker}
                      className="flex items-center justify-between"
                    >
                      <span className="text-2xl font-bold" style={{ color: c }}>
                        {stat.speaker}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {stat.totalHits}회
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* 화자별 키워드 사용 횟수 그래프 (화자색 적용) */}
          <Card className="rounded-xl">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">화자별 키워드 사용 횟수</CardTitle>
              <CardDescription className="text-xs">
                화자 간 사용량을 한눈에 비교합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] pl-0 pr-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart
                  data={[...analysis.speakerStats]
                    .map((s: SpeakerStat) => ({
                      name: s.speaker,
                      count: s.totalHits,
                    }))
                    .sort((a, b) => b.count - a.count)}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 0, bottom: 6 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={<SpeakerTick />}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      const speaker = p?.payload?.name as string;
                      const color = colorFromString(speaker);
                      return (
                        <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm shadow-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{speaker}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            총 {p?.value}회
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" barSize={16} radius={[4, 4, 4, 4]}>
                    {([...analysis.speakerStats]
                      .map((s: SpeakerStat) => ({
                        name: s.speaker,
                        count: s.totalHits,
                      }))
                      .sort((a, b) => b.count - a.count)
                    ).map((d) => (
                      <Cell key={d.name} fill={colorFromString(d.name)} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 타임라인 (가독성 개선 + 화자색 인디케이터) */}
          <Card>
            <CardHeader>
              <CardTitle>타임라인</CardTitle>
              <CardDescription>
                화자 이름을 클릭하면 해당 화자의 타임라인이 열립니다.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Accordion type="multiple" className="w-full">
                {groupTimelineBySpeaker(
                  analysis.timeline as unknown as TimelineRow[]
                ).map(([speaker, rows]) => {
                  const color = colorFromString(speaker);
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
                            <span className="font-semibold truncate">
                              {speaker}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              최초 {first} · 최신 {last}
                            </span>
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
                        <div className="overflow-x-auto">
                          <div className="min-w-[720px]">
                            <div className="grid grid-cols-[110px_70px_1fr] text-[12px] uppercase text-muted-foreground bg-muted/50 sticky top-0 px-4 py-2">
                              <div>날짜</div>
                              <div>시간</div>
                              <div>메시지</div>
                            </div>
                            <ul className="px-4 pb-4">
                              {rows.map((r, i) => (
                                <li
                                  key={i}
                                  className="grid grid-cols-[110px_70px_1fr] items-start border-b last:border-0 odd:bg-muted/20 hover:bg-muted/40 transition-colors"
                                >
                                  <div className="py-2 pr-2 text-sm">
                                    {r.date}
                                  </div>
                                  <div className="py-2 pr-2 text-sm font-mono tabular-nums">
                                    {r.time}
                                  </div>
                                  <div className="py-2 pr-2 text-sm">
                                    <div className="max-w-[90ch]">
                                      {highlightKeyword(
                                        r.message,
                                        analysis.keyword
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* 다운로드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                데이터 내보내기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
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
