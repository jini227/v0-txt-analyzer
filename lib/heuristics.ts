// heuristics.ts — 피처 계산 전용(별명/특성은 page.tsx에서 최종 결정)
import { positiveWords, negativeWords, swearWords, makeMatcher, countMatches } from "@/lib/lexicon"

const POS_RX = makeMatcher(positiveWords)
const NEG_RX = makeMatcher(negativeWords)
const SWEAR_RX = makeMatcher(swearWords)

export type Feature = {
  positiveCount: number
  negativeCount: number
  swearCount: number
  questionCount: number
  linkCount: number
  exclamationCount: number
  averageMessageLength: number
  timeDistribution: Record<"오전" | "오후" | "저녁" | "새벽", number>
}

export type SpeakerVibeAnalysis = {
  speaker: string
  features: Feature
  evidenceSnippets: string[]
  nickname?: string
  traits?: string[]
  featureSummary?: string // 이 줄 추가!
}

type Msg = { speaker: string; text: string; timestamp?: string | number | Date }

function countContains(text: string, dict: string[]) {
  let c = 0
  for (const w of dict) if (text.includes(w)) c++
  return c
}

function timeSlot(d: Date): "오전" | "오후" | "저녁" | "새벽" {
  const h = d.getHours()
  if (h >= 0 && h <= 5) return "새벽"
  if (h >= 6 && h <= 11) return "오전"
  if (h >= 12 && h <= 17) return "오후"
  return "저녁"
}

export function analyzeVibe(messages: Msg[]): {
  roomSummary: string
  speakerAnalyses: SpeakerVibeAnalysis[]
} {
  const bySpeaker: Record<string, Msg[]> = {}
  for (const m of messages) {
    if (!bySpeaker[m.speaker]) bySpeaker[m.speaker] = []
    bySpeaker[m.speaker].push(m)
  }

  const speakerAnalyses: SpeakerVibeAnalysis[] = Object.entries(bySpeaker).map(([speaker, msgs]) => {
    let pos = 0, neg = 0, q = 0, link = 0, bang = 0, lenSum = 0, sw = 0
    const timeDist: Feature["timeDistribution"] = { 오전: 0, 오후: 0, 저녁: 0, 새벽: 0 }
    const evid: string[] = []

    for (const m of msgs) {
      const t = (m.text || "").trim()
      pos += countMatches(t, POS_RX)
      neg += countMatches(t, NEG_RX)
      sw = countMatches(t, SWEAR_RX)
      q += (t.match(/\?/g) || []).length
      link += /(https?:\/\/|www\.)/i.test(t) ? 1 : 0
      bang += (t.match(/!+/g) || []).length
      lenSum += t.length

      if (m.timestamp) timeDist[timeSlot(new Date(m.timestamp))]++
      if (evid.length < 8 && (t.includes("?") || t.includes("!") || /(https?:\/\/|www\.)/i.test(t))) evid.push(t)
    }

    const avgLen = msgs.length ? Math.round(lenSum / msgs.length) : 0
    return {
      speaker,
      features: {
        positiveCount: pos,
        negativeCount: neg,
        swearCount: sw,
        questionCount: q,
        linkCount: link,
        exclamationCount: bang,
        averageMessageLength: avgLen,
        timeDistribution: timeDist,
      },
      evidenceSnippets: evid,
    }
  })

  const total = messages.length
  const ppl = Object.keys(bySpeaker).length
  const mood =
    speakerAnalyses.reduce((a, b) => a + b.features.positiveCount, 0) >=
    speakerAnalyses.reduce((a, b) => a + b.features.negativeCount, 0)
      ? "전체적으로 차분하고 긍정적인"
      : "전체적으로 날이 서 있지만 활발한"
  const roomSummary = `총 ${total}개의 메시지를 분석한 결과, ${ppl}명의 화자가 참여한 대화방입니다. ${mood} 분위기로 보입니다.`

  return { roomSummary, speakerAnalyses }
}

type AiPayload = {
  roomSummary?: string
  speakerAnalyses?: {
    speaker: string
    nickname?: string
    traits?: string[]
    featureSummary?: string // 추가
    analysis?: string
  }[]
}

const mergeHeuristicWithAI = (heuristics: SpeakerVibeAnalysis[], ai: AiPayload | null): SpeakerVibeAnalysis[] => {
  if (!ai || !validateAI(ai)) return heuristics
  return heuristics.map(h => {
    const m = ai.speakerAnalyses?.find(x => x.speaker === h.speaker)
    if (!m) return h
    return {
      ...h,
      nickname: m.nickname ?? h.nickname,
      traits: m.traits ? uniqMerge(h.traits ?? [], m.traits) : h.traits,
      featureSummary: m.featureSummary ?? h.featureSummary,
      evidenceSnippets: m.analysis
        ? uniqMerge(h.evidenceSnippets ?? [], [m.analysis])
        : (h.evidenceSnippets ?? []),
      // features는 그대로 유지!
    }
  })
}

const validateAI = (j: any): j is AiPayload =>
  j && Array.isArray(j.speakerAnalyses) && j.speakerAnalyses.every((x: any) => typeof x?.speaker === "string")

const uniqMerge = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]))
