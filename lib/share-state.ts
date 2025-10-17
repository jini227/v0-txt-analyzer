// lib/share-state.ts
"use client"

import LZString from "lz-string"

export type ShareState = Record<string, any>

/** 앱 상태 → URL-safe 문자열(압축) */
export function encodeShareState(state: ShareState): string {
  const json = JSON.stringify(state)
  return LZString.compressToEncodedURIComponent(json)
}

/** URL-safe 문자열 → 앱 상태 */
export function decodeShareState(encoded: string | null | undefined): ShareState | null {
  if (!encoded) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** baseUrl에 ?state=... 붙여 반환 */
export function appendStateToUrl(baseUrl: string, encodedState: string): string {
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : undefined)
  url.searchParams.set("state", encodedState)
  return url.toString()
}

/** 현재 location에서 state 읽어 복원 */
export function readShareStateFromLocation(): ShareState | null {
  if (typeof window === "undefined") return null
  const enc = new URL(window.location.href).searchParams.get("state")
  return decodeShareState(enc)
}
