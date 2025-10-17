// app/kko/result/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { readShareStateFromLocation } from "@/lib/share-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Activity, Users, Clock, MessageSquare } from "lucide-react";

/** --- 이 페이지에서만 쓰는 '라이트 결과' 타입 --- */
type SpeakerStat = { speaker: string; totalHits: number; messageCount?: number };
type LightSummary = { totalKeywordHits: number } & Record<string, any>;
type LightAnalysis = {
  keyword: string;
  summary: LightSummary;
  speakerStats: SpeakerStat[];
  timeline: any[]; // 공유 라이트에서는 비움
};

const nf = (n: number | string) => Number(n ?? 0).toLocaleString();

const PALETTE = [
  "#E74C3C","#FF6B81","#F39C12","#F1C40F","#2ECC71","#27AE60",
  "#3498DB","#2980B9","#9B59B6","#8E44AD","#1ABC9C","#16A085",
  "#E67E22","#D35400","#95A5A6","#7F8C8D"
];
const spaced = [0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15];
function makeColorPicker(speakers: string[]) {
  const uniq = Array.from(new Set(speakers)).sort((a,b)=>a.localeCompare(b));
  const map = new Map<string,string>();
  uniq.forEach((name, i)=> map.set(name, PALETTE[spaced[i % PALETTE.length]]));
  return (name: string) => map.get(name) ?? PALETTE[0];
}

export default function SharedResultPage() {
  const [analysis, setAnalysis] = useState<LightAnalysis | null>(null);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");

  // 1) URL의 state 읽어 복원
  useEffect(() => {
    const s = readShareStateFromLocation();
    if (!s?.analysis?.speakerStats) return;

    const lightSpeakerStats: SpeakerStat[] = (s.analysis.speakerStats as any[]).map((x) => ({
      speaker: String(x.speaker),
      totalHits: Number(x.totalHits ?? x.count ?? 0),
      messageCount: Number(x.messageCount ?? 0),
    }));

    const totalFromStats = lightSpeakerStats.reduce((a,b)=> a + (b.totalHits || 0), 0);
    const lightSummary: LightSummary = {
      ...(s.analysis.summary ?? {}),
      totalKeywordHits: Number(s.analysis?.summary?.totalKeywordHits ?? totalFromStats ?? 0),
    };

    setSpeakers(lightSpeakerStats.map(v=>v.speaker));
    setStartDate(String(s.meta?.conversationStartDate ?? ""));

    setAnalysis({
      keyword: String(s.keyword ?? ""),
      summary: lightSummary,
      speakerStats: lightSpeakerStats,
      timeline: [], // 공유 라이트에서는 타임라인 제외
    });
  }, []);

  const colorOf = useMemo(()=> makeColorPicker(speakers), [speakers]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.speakerStats]
      .map(s=> ({ name: s.speaker, count: s.totalHits }))
      .filter(d=>d.count>0)
      .sort((a,b)=> b.count - a.count);
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>공유된 결과를 불러올 수 없어요</CardTitle>
            <CardDescription>링크가 잘못되었거나 만료되었을 수 있어요.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalHits = analysis.summary.totalKeywordHits ?? chartData.reduce((a,b)=>a+b.count,0);
  const top1 = chartData[0]?.name ?? "-";
  const top1Count = chartData[0]?.count ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더: 키워드 크게 */}
      <div className="text-center space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">공유된 분석 결과</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold">
          키워드: <span className="text-primary">#{analysis.keyword}</span>
        </h1>
        {startDate ? <div className="text-xs text-muted-foreground">대화 시작일: {startDate}</div> : null}
      </div>

      {/* TOP 1 */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">키워드 사용 TOP 1</CardTitle>
          <CardDescription className="text-xs">누가 가장 많이 썼나?</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-4">
          {top1 !== "-" ? (
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" style={{ color: colorOf(top1) }}>{top1}</span>
              <span className="text-sm text-muted-foreground">{nf(top1Count)}회</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">데이터가 없어요.</div>
          )}
        </CardContent>
      </Card>

      {/* 화자별 바차트 */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">화자별 키워드 사용 횟수</CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-2 pb-3" style={{ height: Math.max(220, chartData.length * 28 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <ReBarChart data={chartData} layout="vertical" margin={{ top: 6, right: 12, left: 4, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} interval={0} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={(props: TooltipProps<number, string>) => {
                  const { active, payload } = props;
                  if (!active || !payload || payload.length === 0) return null;
                  const p: any = payload[0];
                  const speaker = String(p?.payload?.name ?? "");
                  const value = Number(p?.value ?? 0);
                  const color = colorOf(speaker);
                  return (
                    <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium">{speaker}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground">총 {nf(value)}회</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" barSize={14} radius={[4,4,4,4]}>
                {chartData.map((d) => (
                  <Cell key={d.name} fill={colorOf(d.name)} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 요약 KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            요약
          </CardTitle>
          <CardDescription>핵심 지표</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Activity className="h-4 w-4" />} label="총 키워드 사용" value={`${nf(totalHits)}회`} hint={`# ${analysis.keyword}`} />
            <Kpi icon={<Users className="h-4 w-4" />} label="참여 화자" value={`${nf(analysis.speakerStats.filter(s=>s.totalHits>0).length)}명`} />
            <Kpi icon={<MessageSquare className="h-4 w-4" />} label="타임라인" value={`공유 뷰 제외`} />
            <Kpi icon={<Clock className="h-4 w-4" />} label="TOP 화자" value={top1} hint={`${nf(top1Count)}회`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string; }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span className="text-muted-foreground/80">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-semibold">{value}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}
