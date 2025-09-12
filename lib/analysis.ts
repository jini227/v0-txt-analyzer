import type { ParsedMessage } from "./parseKakao"
import { positiveWords, negativeWords, swearWords, makeMatcher, countMatches } from "@/lib/lexicon"

const POS_RX = makeMatcher(positiveWords)
const NEG_RX = makeMatcher(negativeWords)
const SWEAR_RX = makeMatcher(swearWords)

export interface KeywordAnalysis {
  keyword: string
  totalHits: number
  speakerStats: SpeakerKeywordStats[]
  timeline: KeywordTimeline[]
  summary: {
    analyzedLines: number
    totalMessages: number
    totalKeywordHits: number
  }
}

export interface SpeakerKeywordStats {
  speaker: string
  totalHits: number
  messageCount: number
}

export interface KeywordTimeline {
  date: string
  time: string
  datetimeISO: string
  speaker: string
  message: string
  hitsInMessage: number
}

export interface WordAnalysis {
  speaker: string
  topWords: WordCount[]
  wordUsages: Record<string, WordUsage[]>
}

export interface WordCount {
  word: string
  count: number
  rank: number
}

export interface WordUsage {
  date: string
  time: string
  message: string
}

export interface SpeakerVibeAnalysis {
  speaker: string
  nickname: string
  traits: string[]
  features: SpeakerFeatures
  evidenceSnippets: string[]
  featureSummary?: string // 추가
}

export interface SpeakerFeatures {
  positiveCount: number
  negativeCount: number
  swearCount: number
  questionCount: number
  exclamationCount: number
  linkCount: number
  averageMessageLength: number
  timeDistribution: Record<string, number>
}

export function analyzeKeyword(
  messages: ParsedMessage[],
  keyword: string,
  includedSpeakers?: string[],
): KeywordAnalysis {
  const filteredMessages = includedSpeakers
    ? messages.filter((msg) => includedSpeakers.includes(msg.speaker))
    : messages

  const keywordRegex = new RegExp(keyword, "gi")
  const speakerStatsMap = new Map<string, { totalHits: number; messageCount: number }>()
  const timeline: KeywordTimeline[] = []
  let totalHits = 0

  for (const message of filteredMessages) {
    const matches = message.text.match(keywordRegex)
    const hitsInMessage = matches ? matches.length : 0

    if (hitsInMessage > 0) {
      totalHits += hitsInMessage

      // 화자별 통계 업데이트
      const stats = speakerStatsMap.get(message.speaker) || { totalHits: 0, messageCount: 0 }
      stats.totalHits += hitsInMessage
      stats.messageCount += 1
      speakerStatsMap.set(message.speaker, stats)

      // 타임라인에 추가
      timeline.push({
        date: message.date,
        time: message.time,
        datetimeISO: message.datetimeISO,
        speaker: message.speaker,
        message: message.text,
        hitsInMessage,
      })
    }
  }

  const speakerStats: SpeakerKeywordStats[] = Array.from(speakerStatsMap.entries())
    .map(([speaker, stats]) => ({
      speaker,
      totalHits: stats.totalHits,
      messageCount: stats.messageCount,
    }))
    .sort((a, b) => b.totalHits - a.totalHits)

  return {
    keyword,
    totalHits,
    speakerStats,
    timeline: timeline.sort((a, b) => new Date(b.datetimeISO).getTime() - new Date(a.datetimeISO).getTime()),
    summary: {
      analyzedLines: filteredMessages.length,
      totalMessages: messages.length,
      totalKeywordHits: totalHits,
    },
  }
}

// 토크나이저 및 단어 분석
export function tokenizeText(text: string): string[] {
  // URL, 이메일 제거
  let cleaned = text.replace(/https?:\/\/[^\s]+/g, "").replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")

  // ㅋ, ㅎ, ㅠ, ㅜ 연속 제거
  cleaned = cleaned.replace(/[ㅋㅎㅠㅜ]{2,}/g, "")

  // 공백 정규화
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  // 토큰 추출 (한글, 영문, 숫자 2글자 이상)
  const tokens: string[] = []
  const koreanRegex = /[가-힣]{2,}/g
  const englishRegex = /[a-zA-Z]{2,}/g
  const numberRegex = /\d{2,}/g

  let match
  while ((match = koreanRegex.exec(cleaned)) !== null) {
    tokens.push(match[0])
  }
  while ((match = englishRegex.exec(cleaned)) !== null) {
    tokens.push(match[0].toLowerCase())
  }
  while ((match = numberRegex.exec(cleaned)) !== null) {
    tokens.push(match[0])
  }

  return tokens
}

export function analyzeWords(messages: ParsedMessage[]): WordAnalysis[] {
  const speakerWords = new Map<string, Map<string, WordUsage[]>>()

  // 줄바꿈된 메시지 합치기 및 토큰화
  for (const message of messages) {
    if (message.is_media_like) continue

    const tokens = tokenizeText(message.text)

    if (!speakerWords.has(message.speaker)) {
      speakerWords.set(message.speaker, new Map())
    }

    const wordMap = speakerWords.get(message.speaker)!

    for (const token of tokens) {
      if (!wordMap.has(token)) {
        wordMap.set(token, [])
      }
      wordMap.get(token)!.push({
        date: message.date,
        time: message.time,
        message: message.text,
      })
    }
  }

  // 각 화자별 Top 10 단어 계산
  const analyses: WordAnalysis[] = []

  for (const [speaker, wordMap] of speakerWords) {
    const wordCounts = Array.from(wordMap.entries())
      .map(([word, usages]) => ({ word, count: usages.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }))

    const wordUsages: Record<string, WordUsage[]> = {}
    for (const { word } of wordCounts) {
      wordUsages[word] = wordMap.get(word) || []
    }

    analyses.push({
      speaker,
      topWords: wordCounts,
      wordUsages,
    })
  }

  return analyses.sort((a, b) => a.speaker.localeCompare(b.speaker))
}

// 간단한 휴리스틱 기반 분위기 분석
export function analyzeVibe(messages: ParsedMessage[]): {
  roomSummary: string
  speakerAnalyses: SpeakerVibeAnalysis[]
} {
  const speakerFeatures = new Map<string, SpeakerFeatures>()

  // 각 화자별 특성 분석
  for (const message of messages) {
    if (message.is_media_like) continue

    const features = speakerFeatures.get(message.speaker) || {
      positiveCount: 0,
      negativeCount: 0,
      swearCount: 0,
      questionCount: 0,
      exclamationCount: 0,
      linkCount: 0,
      averageMessageLength: 0,
      timeDistribution: {},
    }

    // 감정 분석 (간단한 키워드 기반)
    const text = message.text

    features.positiveCount += countMatches(text, POS_RX)
    features.negativeCount += countMatches(text, NEG_RX)
    features.swearCount    += countMatches(text, SWEAR_RX)

    if (/\?|뭐|어떻|언제|어디|누구|왜|어떡/.test(text)) {
      features.questionCount++
    }
    if (/!|와|우와|대박|진짜/.test(text)) {
      features.exclamationCount += (text.match(/[!！]+/g)?.join("").length ?? 0)
    }
    if (/https?:\/\//i.test(text)) {
      features.linkCount++
    }

    // 시간대 분포
    const hour = Number.parseInt(message.time.split(":")[0])
    const timeSlot = hour < 6 ? "새벽" : hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁"
    features.timeDistribution[timeSlot] = (features.timeDistribution[timeSlot] || 0) + 1

    speakerFeatures.set(message.speaker, features)
  }

  // 평균 메시지 길이 계산
  const speakerMessageCounts = new Map<string, number>()
  const speakerTotalLength = new Map<string, number>()

  for (const message of messages) {
    if (message.is_media_like) continue

    speakerMessageCounts.set(message.speaker, (speakerMessageCounts.get(message.speaker) || 0) + 1)
    speakerTotalLength.set(message.speaker, (speakerTotalLength.get(message.speaker) || 0) + message.text.length)
  }

  for (const [speaker, features] of speakerFeatures) {
    const messageCount = speakerMessageCounts.get(speaker) || 1
    const totalLength = speakerTotalLength.get(speaker) || 0
    features.averageMessageLength = Math.round(totalLength / messageCount)
  }

  // 별명 및 특성 생성
  const speakerAnalyses: SpeakerVibeAnalysis[] = []

  for (const [speaker, features] of speakerFeatures) {
    const traits: string[] = []
    let nickname = speaker

    if (features.questionCount > 5) traits.push("질문왕")
    if (features.linkCount > 3) traits.push("링크수집가")
    if (features.positiveCount > features.negativeCount * 2) traits.push("긍정왕")
    if (features.exclamationCount > 10) traits.push("감탄왕")
    if (features.averageMessageLength > 50) traits.push("장문러")

    // 별명 생성 (간단한 휴리스틱)
    if (features.positiveCount > 10) nickname = `갓${speaker}`
    else if (features.questionCount > 8) nickname = `질문왕${speaker}`
    else if (features.linkCount > 5) nickname = `링크왕${speaker}`

    speakerAnalyses.push({
      speaker,
      nickname,
      traits: traits.slice(0, 3),
      features,
      evidenceSnippets: [],
      featureSummary: `${nickname} — ${traits.slice(0, 3).join(", ")} 스타일`, // 예시 요약
    })
  }

  const roomSummary = `총 ${messages.length}개의 메시지를 분석한 결과, ${speakerFeatures.size}명의 화자가 참여한 활발한 대화방입니다. 전반적으로 ${Array.from(speakerFeatures.values()).reduce((sum, f) => sum + f.positiveCount, 0) > Array.from(speakerFeatures.values()).reduce((sum, f) => sum + f.negativeCount, 0) ? "긍정적이고 밝은" : "차분하고 진지한"} 분위기를 보이고 있습니다.`

  return {
    roomSummary,
    speakerAnalyses,
  }
}
