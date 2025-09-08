import type { KeywordAnalysis, WordAnalysis } from "./analysis"

export function generateKeywordSummaryCSV(analysis: KeywordAnalysis): string {
  const headers = ["speaker", "total_keyword_hits", "keyword_message_count"]
  const rows = analysis.speakerStats.map((stat) => [
    stat.speaker,
    stat.totalHits.toString(),
    stat.messageCount.toString(),
  ])

  return [headers, ...rows].map((row) => row.join(",")).join("\n")
}

export function generateKeywordDetailsCSV(analysis: KeywordAnalysis): string {
  const headers = ["date", "time", "datetime_iso", "speaker", "message", "keyword_hits_in_message"]
  const rows = analysis.timeline.map((item) => [
    item.date,
    item.time,
    item.datetimeISO,
    `"${item.speaker}"`,
    `"${item.message.replace(/"/g, '""')}"`,
    item.hitsInMessage.toString(),
  ])

  return [headers, ...rows].map((row) => row.join(",")).join("\n")
}

export function generateWordAnalysisCSV(analyses: WordAnalysis[]): string {
  const headers = ["speaker", "rank", "word", "count"]
  const rows: string[][] = []

  for (const analysis of analyses) {
    for (const word of analysis.topWords) {
      rows.push([`"${analysis.speaker}"`, word.rank.toString(), `"${word.word}"`, word.count.toString()])
    }
  }

  return [headers, ...rows].map((row) => row.join(",")).join("\n")
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
