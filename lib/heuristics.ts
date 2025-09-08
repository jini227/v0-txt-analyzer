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

export function generateNickname(speaker: string, features: SpeakerFeatures): string {
  // 특성 기반 별명 생성 로직
  if (features.negativeCount > 10) {
    return `난폭왕${speaker}`
  }

  if (features.positiveCount > features.negativeCount * 2 && features.positiveCount > 8) {
    return `갓${speaker}`
  }

  if (features.questionCount > 8) {
    return `질문왕${speaker}`
  }

  if (features.linkCount > 5) {
    return `링크왕${speaker}`
  }

  if (features.exclamationCount > 15) {
    return `감탄왕${speaker}`
  }

  if (features.averageMessageLength > 100) {
    return `장문왕${speaker}`
  }

  return speaker
}

export function generateTraits(features: SpeakerFeatures): string[] {
  const traits: string[] = []

  if (features.questionCount > 5) traits.push("질문왕")
  if (features.linkCount > 3) traits.push("링크수집가")
  if (features.positiveCount > features.negativeCount * 2) traits.push("긍정왕")
  if (features.exclamationCount > 10) traits.push("감탄왕")
  if (features.averageMessageLength > 50) traits.push("장문러")
  if (features.negativeCount > 8) traits.push("까칠이")

  // 시간대별 특성
  const timeDistribution = features.timeDistribution
  const maxTimeSlot = Object.entries(timeDistribution).reduce((a, b) => (a[1] > b[1] ? a : b))[0]

  if (maxTimeSlot === "새벽") traits.push("올빼미")
  else if (maxTimeSlot === "오전") traits.push("아침형")
  else if (maxTimeSlot === "저녁") traits.push("저녁형")

  return traits.slice(0, 3) // 최대 3개
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
