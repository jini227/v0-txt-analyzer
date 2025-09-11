import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { messages, speakers } = await request.json()

    const apiKey = process.env.AI_API_KEY
    if (!apiKey) {
      throw new Error("AI_API_KEY 환경변수가 설정되지 않았습니다")
    }

    // 대화 샘플 준비 (최대 50개 메시지)
    const sampleMessages = messages
      .slice(0, 50)
      .map((msg: any) => `${msg.speaker}: ${msg.content}`)
      .join("\n")

    const prompt = `다음 카카오톡 대화를 분석하여 각 화자의 특징과 대화방 분위기를 파악해주세요.

대화 내용:
${sampleMessages}

화자 목록: ${speakers.join(", ")}

다음 JSON 형식으로 응답해주세요:
{
  "roomSummary": "대화방 전체 분위기 설명 (2-3문장)",
  "speakerAnalyses": [
    {
      "speaker": "화자명",
      "nickname": "적절한 별명 (예: 질문왕김철수, 유머왕이영희)",
      "traits": ["특징1", "특징2", "특징3"],
      "analysis": "화자 특성 분석 (1-2문장)"
    }
  ]
}

별명 규칙:
- 각 화자마다 고유한 별명을 부여하세요 (중복 금지)
- 00왕, 00러, 00가 등 다양한 형태 사용
- 화자의 실제 대화 패턴을 반영하세요

특징 분석:
- 긍정적/부정적 성향
- 질문 빈도
- 유머 감각
- 리액션 스타일
- 메시지 길이 패턴
- 활동 시간대 등을 고려하세요`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`)
    }

    const data = await response.json()
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!aiText) {
      throw new Error("AI 응답을 받을 수 없습니다")
    }

    // JSON 파싱 시도
    let aiResult
    try {
      // JSON 블록 추출
      const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/) || aiText.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiText
      aiResult = JSON.parse(jsonText)
    } catch (parseError) {
      console.error("AI 응답 파싱 오류:", parseError)
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
