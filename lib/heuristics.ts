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

export function generateNickname(
  speaker: string,
  features: SpeakerFeatures,
  usedNicknames: Set<string> = new Set(),
): string {
  const candidates: string[] = []

  // 감정 기반 별명 (8가지)
  if (features.negativeCount > 10) candidates.push(`난폭왕${speaker}`, `화염방사기${speaker}`, `폭풍전사${speaker}`)
  if (features.positiveCount > features.negativeCount * 2 && features.positiveCount > 8) {
    candidates.push(`갓${speaker}`, `천사${speaker}`, `햇살${speaker}`, `비타민${speaker}`)
  }

  // 행동 패턴 기반 별명 (12가지)
  if (features.questionCount > 8) candidates.push(`질문왕${speaker}`, `호기심대장${speaker}`, `궁금이${speaker}`)
  if (features.linkCount > 5) candidates.push(`링크왕${speaker}`, `정보수집가${speaker}`, `뉴스봇${speaker}`)
  if (features.exclamationCount > 15) candidates.push(`감탄왕${speaker}`, `리액션킹${speaker}`, `표현대장${speaker}`)
  if (features.averageMessageLength > 100)
    candidates.push(`장문왕${speaker}`, `소설가${speaker}`, `에세이스트${speaker}`)
  if (features.averageMessageLength < 10) candidates.push(`단답왕${speaker}`, `미니멀${speaker}`, `간결이${speaker}`)

  // 시간대 기반 별명 (6가지)
  const timeDistribution = features.timeDistribution
  const maxTimeSlot = Object.entries(timeDistribution).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
  if (maxTimeSlot === "새벽") candidates.push(`올빼미${speaker}`, `야행성${speaker}`)
  else if (maxTimeSlot === "오전") candidates.push(`아침형${speaker}`, `일찍이${speaker}`)
  else if (maxTimeSlot === "저녁") candidates.push(`저녁형${speaker}`, `황혼족${speaker}`)

  // 특수 패턴 기반 별명 (10가지)
  const messageRatio = features.totalMessages / 100
  if (messageRatio > 5) candidates.push(`수다왕${speaker}`, `채팅머신${speaker}`, `말많은${speaker}`)
  if (messageRatio < 1) candidates.push(`조용이${speaker}`, `관찰자${speaker}`, `신중한${speaker}`)

  // 복합 특성 별명 (8가지)
  if (features.positiveCount > 5 && features.questionCount > 5) candidates.push(`친근한${speaker}`, `사교적${speaker}`)
  if (features.linkCount > 3 && features.averageMessageLength > 50)
    candidates.push(`정보통${speaker}`, `박학다식${speaker}`)
  if (features.exclamationCount > 10 && features.positiveCount > 8)
    candidates.push(`에너지${speaker}`, `활력소${speaker}`)
  if (features.negativeCount < 2 && features.positiveCount > 10)
    candidates.push(`평화주의자${speaker}`, `중재자${speaker}`)

  // 사용되지 않은 별명 선택
  for (const candidate of candidates) {
    if (!usedNicknames.has(candidate)) {
      usedNicknames.add(candidate)
      return candidate
    }
  }

  // 모든 별명이 사용된 경우 기본값
  return `개성파${speaker}`
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
