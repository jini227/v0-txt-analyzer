export interface ParsedMessage {
  datetimeISO: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  speaker: string
  text: string
  is_media_like: boolean
}

export interface ParseResult {
  messages: ParsedMessage[]
  speakers: string[]
  conversationStartDate: string // YYYY-MM-DD
  totalLines: number
  validMessages: number
}

// PC 형식 정규식
const PC_REGEX = /^(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.)\s*(오전|오후)\s*(\d{1,2}:\d{2}),\s*([^:]+)\s*:\s*(.*)$/
const PC_ALT_REGEX = /^\[(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.)\s*(오전|오후)\s*(\d{1,2}:\d{2})\]\s*([^:]+)\s*:\s*(.*)$/

// Mobile/Mac 형식 정규식
const MOBILE_DATE_REGEX = /^-{5,}\s*(\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*[^\s-]+)\s*-{5,}$/
const MOBILE_MSG_REGEX = /^\[([^\]]+)\]\s*\[(오전|오후|\d{1,2}:\d{2})\s*(\d{1,2}:\d{2})?\]\s*(.*)$/

// 미디어/시스템 메시지 패턴
const MEDIA_PATTERNS = [
  /사진/,
  /이모티콘/,
  /동영상/,
  /음성메시지/,
  /파일/,
  /메시지가 삭제되었습니다/,
  /님이 들어왔습니다/,
  /님이 나갔습니다/,
  /방장 권한이/,
  /대화방 이름을/,
]

function isMediaLike(text: string): boolean {
  return MEDIA_PATTERNS.some((pattern) => pattern.test(text))
}

function convertToKoreanDate(dateStr: string): string {
  // "2025년 9월 2일 화요일" -> "2025-09-02"
  const match = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
  if (!match) return ""

  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function convertToPCDate(dateStr: string): string {
  // "2025. 1. 2." -> "2025-01-02"
  const cleaned = dateStr.replace(/\s+/g, "").replace(/\.$/, "")
  const parts = cleaned.split(".")
  if (parts.length !== 3) return ""

  const [year, month, day] = parts
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function convertTo24Hour(timeStr: string, period: string): string {
  const [hour, minute] = timeStr.split(":").map(Number)

  if (period === "오전") {
    if (hour === 12) return `00:${minute.toString().padStart(2, "0")}`
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  } else {
    // 오후
    if (hour === 12) return `12:${minute.toString().padStart(2, "0")}`
    return `${(hour + 12).toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }
}

function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // UTF-8 BOM 체크
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8"
  }

  // UTF-8 유효성 체크 (간단한 휴리스틱)
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
    // 한글이 포함되어 있고 깨지지 않았는지 확인
    if (/[가-힣]/.test(text)) {
      return "utf-8"
    }
  } catch {
    // UTF-8 디코딩 실패
  }

  // CP949/EUC-KR 시도
  return "euc-kr"
}

function decodeText(buffer: ArrayBuffer): string {
  const encoding = detectEncoding(buffer)

  if (encoding === "utf-8") {
    return new TextDecoder("utf-8").decode(buffer)
  } else {
    // EUC-KR/CP949는 브라우저에서 직접 지원하지 않으므로
    // 일단 UTF-8로 시도하고 실패하면 latin1로 읽어서 처리
    try {
      return new TextDecoder("utf-8").decode(buffer)
    } catch {
      // 폴백: latin1로 읽고 수동 변환 (간단한 경우만)
      return new TextDecoder("latin1").decode(buffer)
    }
  }
}

export async function parseKakaoTxt(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const text = decodeText(buffer).normalize("NFC")
  const lines = text.split(/\r?\n/)

  const messages: ParsedMessage[] = []
  const speakerSet = new Set<string>()
  let currentDate = ""
  let conversationStartDate = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Mobile/Mac 날짜 헤더 체크
    const mobileDateMatch = line.match(MOBILE_DATE_REGEX)
    if (mobileDateMatch) {
      currentDate = convertToKoreanDate(mobileDateMatch[1])
      continue
    }

    // PC 형식 체크
    let pcMatch = line.match(PC_REGEX)
    if (!pcMatch) {
      pcMatch = line.match(PC_ALT_REGEX)
    }

    if (pcMatch) {
      const [, dateStr, period, timeStr, speaker, text] = pcMatch
      const date = convertToPCDate(dateStr)
      const time = convertTo24Hour(timeStr, period)
      const datetimeISO = `${date}T${time}:00+09:00`

      if (!conversationStartDate) {
        conversationStartDate = date
      }

      speakerSet.add(speaker.trim())
      messages.push({
        datetimeISO,
        date,
        time,
        speaker: speaker.trim(),
        text: text.trim(),
        is_media_like: isMediaLike(text.trim()),
      })
      continue
    }

    // Mobile/Mac 메시지 체크
    const mobileMatch = line.match(MOBILE_MSG_REGEX)
    if (mobileMatch && currentDate) {
      const [, speaker, period, timeStr, text] = mobileMatch

      let time: string
      if (period === "오전" || period === "오후") {
        time = convertTo24Hour(timeStr || "00:00", period)
      } else {
        // 24시간 형식
        time = period
      }

      const datetimeISO = `${currentDate}T${time}:00+09:00`

      if (!conversationStartDate) {
        conversationStartDate = currentDate
      }

      speakerSet.add(speaker.trim())
      messages.push({
        datetimeISO,
        date: currentDate,
        time,
        speaker: speaker.trim(),
        text: text.trim(),
        is_media_like: isMediaLike(text.trim()),
      })
      continue
    }

    // 이전 메시지에 이어지는 텍스트 (줄바꿈된 메시지)
    if (messages.length > 0 && !line.includes(":") && !line.includes("[")) {
      const lastMessage = messages[messages.length - 1]
      lastMessage.text += "\n" + line
      lastMessage.is_media_like = isMediaLike(lastMessage.text)
    }
  }

  return {
    messages,
    speakers: Array.from(speakerSet).sort(),
    conversationStartDate,
    totalLines: lines.length,
    validMessages: messages.length,
  }
}

export function getDaysSinceStart(startDate: string): number {
  const start = new Date(startDate + "T00:00:00+09:00")
  const today = new Date()
  const diffTime = today.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays) // 최소 1일
}

export function formatKoreanDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+09:00")
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(date)
}
