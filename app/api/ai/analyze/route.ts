import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { messages, speakers, settings, heuristics } = await request.json()

    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY(AI_API_KEY) 환경변수가 설정되지 않았습니다")
    }

    // 모델/폴백/디버그
    const debug = process.env.DEBUG_AI === "true"
    const model = process.env.AI_MODEL || "gemini-1.5-flash"
    const fallbackModels = ["gemini-2.0-flash-lite", "gemini-1.5-flash-8b"]

    // 분석설정 요약
    const settingsText = settings
      ? `
분석 민감도 설정:
- 과격함 민감도: ${settings.aggressivenessSensitivity}
- 칭찬 민감도: ${settings.praiseSensitivity}
- 질문 민감도: ${settings.questionSensitivity}
- 감정표현 민감도: ${settings.emotionSensitivity}
- 메시지길이 민감도: ${settings.messageLengthSensitivity}
- 시간패턴 민감도: ${settings.timePatternSensitivity}
(이 값이 높을수록 해당 특성을 더 민감하게 반영해 분석하세요. 극단적 값일 경우 결과도 극적으로 표현하세요!)
`
      : ""

    // 휴리스틱 결과 요약
    const heuristicsText = heuristics
      ? `
휴리스틱 분석 결과:
${heuristics.speakerAnalyses
        .map(
          (h: any) =>
            `- ${h.speaker}: 별명=${h.nickname ?? ""}, 특성=${(h.traits ?? []).join(", ")}, 긍정=${h.features?.positiveCount ?? 0}, 부정=${h.features?.negativeCount ?? 0}, 욕설=${h.features?.swearCount ?? 0}, 질문=${h.features?.questionCount ?? 0}, 링크=${h.features?.linkCount ?? 0}, 감탄=${h.features?.exclamationCount ?? 0}, 평균길이=${h.features?.averageMessageLength ?? 0}, 활동시간=${JSON.stringify(h.features?.timeDistribution ?? {})}`
        )
        .join("\n")}
`
      : ""

    // 대화 샘플 준비
    const S: string[] = Array.isArray(speakers) ? (speakers as string[]) : []
    const MAX_TOTAL_LINES = Math.min(320, S.length * 28)
    const MAX_PER_SPEAKER = 36
    const MIN_BASE = 4

    const SKIP_PAT = /^(사진|이모티콘|동영상|지도|파일|메시지가 삭제되었습니다\.)$/

    function cleanContent(t: string) {
      if (!t) return ""
      t = t.replace(/\s+/g, " ").trim()
      t = t.replace(/https?:\/\/\S+/g, "")
      t = t.replace(/[ㅋㅎ]{3,}/g, "웃음")
      return t
    }

    function takeEvenly<T>(arr: T[], n: number): T[] {
      if (n <= 0) return []
      if (arr.length <= n) return arr.slice()
      const out: T[] = []
      for (let i = 0; i < n; i++) {
        const idx = Math.floor((i * (arr.length - 1)) / (n - 1))
        out.push(arr[idx])
      }
      return out
    }

    const rawBy: Record<string, string[]> = {}
    for (const s of S) rawBy[s] = []

    for (const m of (messages || [])) {
      const spk = String(m.speaker ?? "").trim()
      if (!(spk in rawBy)) continue
      let txt = String(m.content ?? m.text ?? "").trim()
      if (!txt || SKIP_PAT.test(txt)) continue
      txt = cleanContent(txt)
      if (!txt) continue
      rawBy[spk].push(`${spk}: ${txt}`)
    }

    for (const s of S) {
      rawBy[s] = Array.from(new Set(rawBy[s]))
      rawBy[s].sort((a, b) => b.length - a.length)
    }

    const baseQuota = Math.min(
      MAX_PER_SPEAKER,
      Math.max(MIN_BASE, Math.ceil(MAX_TOTAL_LINES / Math.max(1, S.length)))
    )

    const basePicked = new Map<string, string[]>()
    const restQueue = new Map<string, string[]>()
    for (const s of S) {
      const lines = rawBy[s] || []
      const take = Math.min(baseQuota, lines.length)
      const picked = takeEvenly(lines, take)
      basePicked.set(s, picked.length ? picked : [`${s}: (활동 적음)`])
      const used = new Set(picked)
      restQueue.set(s, lines.filter(l => !used.has(l)))
    }

    const rr = (map: Map<string, string[]>, cap: number, limitPerSpeaker?: (s: string) => number) => {
      const out: string[] = []
      const usedCount = new Map<string, number>()
      let more = true
      while (more && out.length < cap) {
        more = false
        for (const s of S) {
          const q = map.get(s) || []
          const used = usedCount.get(s) ?? 0
          const capForS = limitPerSpeaker ? limitPerSpeaker(s) : Infinity
          if (q.length && used < capForS) {
            out.push(q.shift()!)
            usedCount.set(s, used + 1)
            more = true
            if (out.length >= cap) break
          }
        }
      }
      return out
    }

    let sampleLines: string[] = rr(basePicked, MAX_TOTAL_LINES)

    let remaining = MAX_TOTAL_LINES - sampleLines.length
    if (remaining > 0) {
      const usedNow = Object.fromEntries(
        S.map(s => [s, sampleLines.filter(l => l.startsWith(`${s}:`)).length])
      ) as Record<string, number>
      const topup = rr(
        restQueue,
        remaining,
        (s) => Math.max(0, MAX_PER_SPEAKER - usedNow[s])
      )
      sampleLines = sampleLines.concat(topup)
    }

    const sampleMessages = sampleLines.join("\n")

    // 프롬프트 생성 (설정, 휴리스틱, 샘플, 요구사항 모두 반영)
    const prompt = `
아래는 카카오톡 대화방의 일부입니다.
분석 민감도와 휴리스틱 결과를 참고하여, 각 화자의 특징을 드라마틱하게 분석하고, 대화방 분위기를 요약해주세요.

${settingsText}
${heuristicsText}

대화 내용 샘플:
${sampleMessages}

화자 목록: ${(speakers || []).join(", ")}

요구사항:
- 각 화자별로 "별명", "특성(3개)", "특징 한 문장 요약", "대화내용 분석(3-5문장)"을 반드시 포함하세요.
- 해당 대화방의 말투와 유사하게 작성 되어 집니다. 
- 분석 민감도 설정값이 높거나 낮으면 결과도 그에 맞게 극적으로 표현하세요.
- "특징 한 문장 요약"은 화자의 말투를 통해 알 수 있는 화자의 특징 입니다. 짧고 임팩트 있게 10자 이내로 작성하되 휴리스틱 분석 결과중 욕설이 가장 많은 화자는 반드시 욕쟁이 별명이 붙음.
- 휴리스틱 결과(별명, 특성, 점수 등)를 기반으로 분석 하되, AI의 창의력도 적극 반영하세요.
- 휴리스틱의 분석 결과 중 긍정/부정/질문/링크/감탄의 개수를 적극 고려 하고, 긍정 표현 수 대비 부정 표현의 수가 가장 많은 화자는 반드시 부정적인 특성을 포함하세요.
- 반드시 아래 JSON 형식으로만 응답하세요. (코드펜스/설명/주석 금지)
{
  "roomSummary": "대화방 전체 분위기 설명 (2-3문장)",
  "speakerAnalyses": [
    {
      "speaker": "화자명",
      "nickname": "별명",
      "traits": ["특성1", "특성2", "특성3"],
      "featureSummary": "특징 한 문장 요약",
      "analysis": "대화내용 분석 (3-5문장)"
    }
  ]
}
`
    // === fetch 호출부: 모델/JSON 강제 + 404 폴백 ===
    async function call(modelId: string) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `
          반드시 오직 JSON만 반환(코드펜스/설명/주석 금지)
          스키마: {"roomSummary":"string","speakerAnalyses":[{"speaker":"string","nickname":"string","traits":["string"],"featureSummary":"string","analysis":"string"}]}
          "speakerAnalyses"에는 제공된 화자 목록의 모든 화자를 각각 정확한 철자로 딱 한 번씩 포함하세요.
          근거가 부족한 화자라도 반드시 포함하고, 보수적으로 작성하세요.
          ` }],
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0,
            max_output_tokens: 2048,
          },
        }),
      })
    }

    let response = await call(model)

    if (response.status === 404 || response.status === 429 || response.status >= 500) {
      if (debug) console.warn(`[AI] ${model} → 404, fallback 시도`)
      for (const m of fallbackModels) {
        const r = await call(m)
        if (debug) console.warn(`[AI] fallback ${m} → ${r.status}`)
        if (r.ok) {
          response = r
          break
        }
      }
    }

    if (!response.ok) {
      const raw = await response.text()
      if (debug) console.error("[AI] raw:", raw.slice(0, 1000))
      throw new Error(`Gemini API 오류: ${response.status}`)
    }

    const data = await response.json()
    const parts = data?.candidates?.[0]?.content?.parts || []
    let aiText = ""
    for (const p of parts) {
      if (typeof p?.text === "string" && p.text.trim()) {
        aiText += p.text + "\n"
      }
    }

    const aiResult = tryParseJSON(aiText)

    if (!aiResult) {
      if (debug) console.error("[AI] parse fail. first1KB:", String(aiText).slice(0, 1024))
      throw new Error("AI 응답 형식이 올바르지 않습니다")
    }

    return NextResponse.json(aiResult)

  } catch (error) {
    console.error("AI 분석 오류:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 분석 중 오류가 발생했습니다" },
      { status: 500 },
    )
  }
}

// 안전 파서(부분 잘림/펜스/트레일링 콤마 보정)
function tryParseJSON(maybe: string): any | null {
  if (!maybe) return null
  try { return JSON.parse(maybe) } catch {}
  const fence = maybe.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fence) {
    try { return JSON.parse(fence[1]) } catch {}
  }
  const first = maybe.indexOf("{")
  const last  = maybe.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) {
    const core = maybe.slice(first, last + 1)
    try { return JSON.parse(core) } catch {}
  }
  const cleaned = maybe.replace(/,\s*([}\]])/g, "$1")
  try { return JSON.parse(cleaned) } catch {}
  return null
}
