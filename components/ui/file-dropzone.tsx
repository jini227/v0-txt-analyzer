"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, File, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  accept?: Record<string, string[]>
  maxSize?: number
  className?: string
  selectedFile?: File | null
  onClearFile?: () => void
}

export function FileDropzone({
  onFileSelect,
  accept = { "text/plain": [".txt"] },
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
  selectedFile,
  onClearFile,
}: FileDropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors[0]?.code === "file-too-large") {
          setError("파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.")
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError("지원하지 않는 파일 형식입니다. .txt 파일만 업로드 가능합니다.")
        } else {
          setError("파일 업로드 중 오류가 발생했습니다.")
        }
        return
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  })

  if (selectedFile) {
    return (
      <div className={cn("border-2 border-dashed border-border rounded-lg p-6", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <File className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          {onClearFile && (
            <button onClick={onClearFile} className="p-2 hover:bg-muted rounded-md transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("border-2 border-dashed border-border rounded-lg p-8 text-center", className)}>
      <div
        {...getRootProps()}
        className={cn("cursor-pointer transition-colors", isDragActive && "border-primary bg-primary/5")}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">
          {isDragActive ? "파일을 여기에 놓으세요" : "카카오톡 대화 파일 업로드"}
        </p>
        <p className="text-sm text-muted-foreground mb-4">.txt 파일을 드래그하거나 클릭하여 선택하세요 (최대 10MB)</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
