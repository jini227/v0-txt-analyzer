// /lib/lexicon.ts
export const positiveWords = [
  "좋다","좋아요","즐거웠다","굿","고마워","감사","최고","행복","대박",
  "멋져","예쁘","웃껴","웃겨","사랑","맛있어요","귀여운","축하","화이팅",
  "멋있","짱","짱이야","짱이다","쩐다","쩔어"
]

export const negativeWords = [
  "싫다","안좋아","별로","최악","짜증","빡","화나","불편","나쁘","개같",
  "힘들","미친","죽어","답답","속상해요"
]

// 프로젝트 어조에 맞춰 필요시 확장하세요
export const swearWords = [
  "씨발","시발","ㅅㅂ","십할","ㅈ같","좆","병신","ㅂㅅ","ㅄ",
  "개같","개새","지랄","염병","닥쳐","꺼져","개처" // 대화에서 쓰인 변형 포함
]

// 특수문자 이스케이프
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// words → 전역 정규식 (중복 매칭 집계용)
export const makeMatcher = (words: string[]) =>
  new RegExp(words.map(esc).join("|"), "g")

// 텍스트 내 매칭 개수(없는 경우 0)
export const countMatches = (text: string, rx: RegExp): number =>
  (text.match(rx)?.length) ?? 0

// 필요시 개별 포함 여부만 체크
export const includesAny = (text: string, words: string[]) =>
  words.some(w => text.includes(w))
