// lib/capture.ts
"use client"

import { toPng } from "html-to-image"

/** elementId를 캡처해 dataURL 반환 */
async function captureElementDataUrl(elementId: string): Promise<string> {
  const el = document.getElementById(elementId)
  if (!el) throw new Error(`#${elementId} not found`)

  // 렌더 안정화(폰트/차트)
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

/** dataURL을 기기 특성에 맞춰 저장/공유 */
async function saveOrShareImage(dataUrl: string, filename: string) {
  const canShareFiles = "share" in navigator && "canShare" in navigator
  if (canShareFiles) {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: "image/png" })
      // @ts-ignore
      if (navigator.canShare?.({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ files: [file], title: filename })
        return
      }
    } catch {}
  }

  // 일반 다운로드
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()

  // iOS 인앱 등 download 미지원일 때
  if (!("download" in HTMLAnchorElement.prototype)) {
    try { window.open(dataUrl, "_blank") } catch {}
  }
}

/** 버튼에서 바로 호출: 캡처 → 저장/공유 */
export async function captureAndSave(elementId: string, filenamePrefix = "kko-result") {
  const dataUrl = await captureElementDataUrl(elementId)
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  await saveOrShareImage(dataUrl, `${filenamePrefix}-${ts}.png`)
}

/**
 * 카카오 공유 헬퍼
 * - makePublicUrl: dataURL을 업로드하여 공개 이미지 URL을 반환(S3/서버)
 * - Kakao JS SDK 초기화는 페이지 쪽에서 수행 필요
 */
export async function captureAndKakaoShare(
  elementId: string,
  makePublicUrl: (dataUrl: string) => Promise<string>,
  opts?: { title?: string; description?: string; linkUrl?: string }
) {
  const dataUrl = await captureElementDataUrl(elementId)
  const imageUrl = await makePublicUrl(dataUrl)
  const linkUrl = opts?.linkUrl ?? (typeof window !== "undefined" ? window.location.href : imageUrl)

  const Kakao = (window as any).Kakao
  if (!Kakao?.Link && !Kakao?.Share) throw new Error("Kakao JS SDK가 초기화되지 않았습니다.")

  // Share API가 있으면 우선
  if (Kakao.Share?.sendDefault) {
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: opts?.title ?? "What's in my Kakao 분석 결과",
        description: opts?.description ?? "키워드 분석 결과를 확인해보세요!",
        imageUrl,
        link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
      },
      buttons: [
        { title: "결과 보기", link: { mobileWebUrl: linkUrl, webUrl: linkUrl } },
      ],
    })
    return
  }

  // 구버전 Link API 폴백
  Kakao.Link.sendDefault({
    objectType: "feed",
    content: {
      title: opts?.title ?? "What's in my Kakao 분석 결과",
      description: opts?.description ?? "키워드 분석 결과를 확인해보세요!",
      imageUrl,
      link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
    },
  })
}
