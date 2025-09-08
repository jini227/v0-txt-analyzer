import type { SpeakerFeatures } from "./analysis"

// 감정 키워드 패턴
const POSITIVE_PATTERNS = [
  /좋|감사|고마|최고|굿|좋아|행복|기쁘|웃|ㅎㅎ|ㅋㅋ|대박|와|우와|짱|멋져|훌륭|완벽|사랑|예쁘|귀여/,
]

const NEGATIVE_PATTERNS = [/싫|화|짜증|아|힘들|슬프|우울|ㅠㅠ|ㅜㅜ|죽|미치|빡|열받|답답|스트레스|최악|망|실망/]

const QUESTION_PATTERNS = [/\?|뭐|어떻|언제|어디|누구|왜|어떡|어케|몇|얼마|어느|무슨|어디서|언제까지/]

const EXCLAMATION_PATTERNS = [/!|와|우와|대박|진짜|정말|헐|어머|세상|맙소사|오마이갓|OMG/]

const LINK_PATTERNS = [/http|www\.|\.com|\.kr|\.net|\.org|카톡|링크|주소|사이트/]

const PRAISE_PATTERNS = [/칭찬|잘했|훌륭|멋져|대단|최고|짱|완벽|좋네|괜찮|잘해|수고|고생|애썼/]

const APOLOGY_PATTERNS = [/죄송|미안|sorry|실수|잘못|용서|사과/]

const KING_NICKNAMES = [
  "난폭왕",
  "질문왕",
  "링크왕",
  "감탄왕",
  "장문왕",
  "단답왕",
  "수다왕",
  "갓",
  "천사왕",
  "화염왕",
  "정보왕",
  "리액션왕",
  "호기심왕",
  "긍정왕",
  "표현왕",
  "에너지왕",
  "활력왕",
  "평화왕",
  "중재왕",
  "박학왕",
  "소통왕",
  "친화왕",
  "분석왕",
  "창의왕",
  "유머왕",
  "센스왕",
  "배려왕",
  "응원왕",
  "격려왕",
  "위로왕",
]

export function generateNickname(
  speaker: string,
  features: SpeakerFeatures,
  usedNicknames: Set<string> = new Set(),
): string {
  const scores: { [key: string]: number } = {}

  // 각 왕 별명에 대한 점수 계산
  scores["난폭왕"] = features.negativeCount > 15 ? features.negativeCount * 2 : 0
  scores["질문왕"] = features.questionCount > 8 ? features.questionCount * 3 : 0
  scores["링크왕"] = features.linkCount > 2 ? features.linkCount * 4 : 0
  scores["감탄왕"] = features.exclamationCount > 12 ? features.exclamationCount * 2 : 0
  scores["장문왕"] = features.averageMessageLength > 100 ? 50 : 0
  scores["단답왕"] = features.averageMessageLength < 10 ? 40 : 0
  scores["수다왕"] = features.totalMessages > 300 ? 60 : features.totalMessages > 100 ? features.totalMessages / 10 : 0
  scores["갓"] =
    features.positiveCount > features.negativeCount * 2 && features.positiveCount > 10 ? features.positiveCount * 2 : 0
  scores["천사왕"] = features.positiveCount > 12 ? features.positiveCount * 1.5 : 0
  scores["화염왕"] = features.negativeCount > 20 ? features.negativeCount * 2 : 0
  scores["정보왕"] = features.linkCount > 3 ? features.linkCount * 3 + (features.averageMessageLength > 50 ? 20 : 0) : 0
  scores["리액션왕"] = features.exclamationCount > 15 ? features.exclamationCount * 2.5 : 0
  scores["호기심왕"] = features.questionCount > 10 ? features.questionCount * 2.5 : 0
  scores["긍정왕"] = features.positiveCount > 8 ? features.positiveCount * 2 : 0
  scores["표현왕"] =
    features.exclamationCount + features.positiveCount > 15 ? features.exclamationCount + features.positiveCount : 0
  scores["에너지왕"] =
    features.exclamationCount + features.positiveCount + features.totalMessages / 20 > 20
      ? features.exclamationCount + features.positiveCount + features.totalMessages / 20
      : 0
  scores["활력왕"] = features.positiveCount > 6 ? features.positiveCount * 1.5 + features.exclamationCount : 0
  scores["평화왕"] = features.negativeCount < 3 && features.positiveCount > 10 ? 45 : 0
  scores["중재왕"] = features.negativeCount < 2 && features.questionCount > 5 ? 40 : 0
  scores["박학왕"] = features.linkCount > 1 ? features.linkCount * 2 + (features.averageMessageLength > 80 ? 30 : 0) : 0
  scores["소통왕"] =
    features.questionCount + features.positiveCount > 12 ? features.questionCount + features.positiveCount : 0
  scores["친화왕"] = features.positiveCount > 5 ? features.positiveCount + features.questionCount / 2 : 0
  scores["분석왕"] = features.averageMessageLength > 70 ? 35 : 0
  scores["창의왕"] =
    features.exclamationCount > 3 && features.averageMessageLength > 60 ? features.exclamationCount + 20 : 0
  scores["유머왕"] = features.positiveCount > 8 && features.exclamationCount > 5 ? 30 : 0
  scores["센스왕"] = features.positiveCount > 4 ? features.positiveCount + features.exclamationCount / 2 : 0
  scores["배려왕"] =
    features.positiveCount > features.negativeCount * 3 && features.positiveCount > 6 ? features.positiveCount : 0
  scores["응원왕"] = features.positiveCount > 7 ? features.positiveCount * 1.8 : 0
  scores["격려왕"] = features.positiveCount > 12 ? features.positiveCount * 1.5 : 0
  scores["위로왕"] = features.positiveCount > 8 && features.negativeCount < 5 ? 25 : 0

  const sortedKings = KING_NICKNAMES.map((king) => ({ king, score: scores[king] || 0 })).sort(
    (a, b) => b.score - a.score,
  )

  for (const { king } of sortedKings) {
    if (!usedNicknames.has(king)) {
      usedNicknames.add(king)
      return `${king} ${speaker}`
    }
  }

  // 모든 별명이 사용된 경우 기본값
  return `개성파 ${speaker}`
}

export function generateTraits(features: SpeakerFeatures): string[] {
  const traits: string[] = []

  // 기본 특성
  if (features.questionCount > 5) traits.push("질문왕")
  if (features.linkCount > 3) traits.push("링크수집가")
  if (features.positiveCount > features.negativeCount * 2) traits.push("긍정왕")
  if (features.exclamationCount > 10) traits.push("감탄왕")
  if (features.averageMessageLength > 50) traits.push("장문러")
  if (features.negativeCount > 8) traits.push("까칠이")

  // 추가 특성
  if (features.averageMessageLength < 15) traits.push("간결이")
  if (features.totalMessages > 500) traits.push("수다쟁이")
  if (features.totalMessages < 50) traits.push("과묵이")
  if (features.positiveCount > 15) traits.push("비타민")
  if (features.questionCount > 15) traits.push("호기심대장")
  if (features.linkCount > 10) traits.push("정보통")
  if (features.exclamationCount > 20) traits.push("리액션킹")

  // 시간대별 특성
  const timeDistribution = features.timeDistribution
  const maxTimeSlot = Object.entries(timeDistribution).reduce((a, b) => (a[1] > b[1] ? a : b))[0]

  if (maxTimeSlot === "새벽") traits.push("올빼미")
  else if (maxTimeSlot === "오전") traits.push("아침형")
  else if (maxTimeSlot === "저녁") traits.push("저녁형")
  else if (maxTimeSlot === "오후") traits.push("오후파")

  return traits.slice(0, 4) // 최대 4개로 확장
}

export function analyzeMessageFeatures(text: string): Partial<SpeakerFeatures> {
  const features: Partial<SpeakerFeatures> = {
    positiveCount: 0,
    negativeCount: 0,
    questionCount: 0,
    exclamationCount: 0,
    linkCount: 0,
  }

  // 패턴 매칭
  POSITIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) features.positiveCount! += 1
  })

  NEGATIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) features.negativeCount! += 1
  })

  QUESTION_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) features.questionCount! += 1
  })

  EXCLAMATION_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) features.exclamationCount! += 1
  })

  LINK_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) features.linkCount! += 1
  })

  return features
}

export function generateRoomSummary(
  totalMessages: number,
  speakerCount: number,
  overallPositive: number,
  overallNegative: number,
): string {
  const sentiment = overallPositive > overallNegative ? "긍정적이고 밝은" : "차분하고 진지한"

  return `총 ${totalMessages}개의 메시지를 분석한 결과, ${speakerCount}명의 화자가 참여한 활발한 대화방입니다. 전반적으로 ${sentiment} 분위기를 보이고 있으며, 참여자들 간의 소통이 원활하게 이루어지고 있습니다. 각자의 개성이 뚜렷하게 드러나는 특징을 보입니다.`
}
