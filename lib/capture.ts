import html2canvas from "html2canvas"

export async function captureElement(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`)
  }

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2, // 고해상도
    useCORS: true,
    allowTaint: true, // oklch 색상 허용
    logging: false,
    ignoreElements: (element) => {
      // oklch를 사용하는 요소들을 무시하거나 처리
      const computedStyle = window.getComputedStyle(element)
      return computedStyle.color?.includes("oklch") || computedStyle.backgroundColor?.includes("oklch")
    },
    onclone: (clonedDoc) => {
      // 클론된 문서에서 oklch 색상을 rgb로 변환
      const allElements = clonedDoc.querySelectorAll("*")
      allElements.forEach((el) => {
        const style = el.style
        if (style.color?.includes("oklch")) {
          style.color = "#000000" // 기본 검은색으로 변경
        }
        if (style.backgroundColor?.includes("oklch")) {
          style.backgroundColor = "#ffffff" // 기본 흰색으로 변경
        }
      })
    },
  })

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          throw new Error("Failed to capture element")
        }
      },
      "image/png",
      0.9,
    )
  })
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
