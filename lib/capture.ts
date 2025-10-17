// lib/capture.ts
"use client"

import { SITE } from "@/lib/site"
import { toPng } from "html-to-image"
import { encodeShareState, appendStateToUrl, ShareState } from "@/lib/share-state"

/* 1) 캡처 → dataURL */
async function captureElementDataUrl(elementId: string): Promise<string> {
  const el = document.getElementById(elementId)
  if (!el) throw new Error(`#${elementId} not found`)

  if ("fonts" in document) {
    try { await (document as any).fonts.ready } catch {}
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const dpr = Math.min(2, window.devicePixelRatio || 1)

  return await toPng(el, {
    pixelRatio: dpr,
    backgroundColor: "#fff",
    cacheBust: true,
    canvasWidth: el.scrollWidth,
    canvasHeight: el.scrollHeight,
  })
}

/* 2) 로컬 다운로드 */
async function saveImage(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob()
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(() => URL.revokeObjectURL(url), 1500)

  // @ts-ignore (iOS 인앱 등)
  if (!("download" in HTMLAnchorElement.prototype)) {
    try { window.open(url, "_blank") } catch {}
  }
}

/* 3) OS 공유(카톡 포함) - 완전 로컬 */
async function shareImageOs(
  dataUrl: string,
  filename: string,
  opts?: { title?: string; text?: string }
) {
  const canShareApi = typeof navigator !== "undefined" && "share" in navigator
  // @ts-ignore
  const canShareFiles = typeof navigator !== "undefined" && "canShare" in navigator
  if (!canShareApi || !canShareFiles) throw new Error("Web Share API 미지원")

  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], filename, { type: "image/png" })
  // @ts-ignore
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    throw new Error("이 환경에서는 파일 공유가 지원되지 않습니다.")
  }
  // @ts-ignore
  await navigator.share({ files: [file], title: opts?.title ?? filename, text: opts?.text })
}

/* 4) 캡처 → 저장 (이미지 저장 버튼용) */
export async function captureAndSave(elementId: string, filenamePrefix = "kko-result") {
  const dataUrl = await captureElementDataUrl(elementId)
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  await saveImage(dataUrl, `${filenamePrefix}-${ts}.png`)
}

/* 5) 캡처 → OS공유 실패시 Kakao 링크(상태내장) → 마지막은 저장 */
export async function captureAndShareSmart(
  elementId: string,
  filenamePrefix = "kko-result",
  opts?: {
    title?: string
    text?: string
    /** 현재 결과 상태(라이트)를 만들어 넘겨주세요. */
    getShareState?: () => ShareState
    /** 기본값: 현재 페이지 */
    linkUrl?: string
  }
) {
  const dataUrl = await captureElementDataUrl(elementId)
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `${filenamePrefix}-${ts}.png`

  // 1) OS 파일 공유(이미지 자체 전송)
  try {
    await shareImageOs(dataUrl, filename, { title: opts?.title, text: opts?.text })
    return
  } catch {}

  // 2) Kakao SDK로 "링크" 공유하되, 링크에 현재 결과(라이트)를 내장
  try {
    const Kakao = (window as any)?.Kakao
    const baseUrl =
      opts?.linkUrl ?? (typeof window !== "undefined" ? window.location.href : undefined)

    if (baseUrl && (Kakao?.Share?.sendDefault || Kakao?.Link?.sendDefault)) {
      const state = opts?.getShareState?.() ?? {}
      const encoded = encodeShareState(state)
      // 너무 크면(보수적으로) OS 공유 유도: 1.5KB 이상은 스킵
      if (encoded.length > 1500) throw new Error("state-too-long")

      const linkWithState = appendStateToUrl(baseUrl, encoded)
      const payload = {
        objectType: "feed",
        content: {
          title: opts?.title ?? `${SITE.name} 분석 결과`,
          description: opts?.text ?? "링크를 열면 같은 결과가 복원됩니다.",
          imageUrl:
            "https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png",
          link: { mobileWebUrl: linkWithState, webUrl: linkWithState },
        },
        buttons: [
          { title: "결과 보기", link: { mobileWebUrl: linkWithState, webUrl: linkWithState } },
        ],
      }

      if (Kakao?.Share?.sendDefault) { Kakao.Share.sendDefault(payload); return }
      if (Kakao?.Link?.sendDefault)  { Kakao.Link.sendDefault(payload);  return }
    }
  } catch {
    // Kakao 링크 실패 → 폴백
  }

  // 3) 최후 폴백: 이미지 저장
  await saveImage(dataUrl, filename)
}
