export function Footer() {
  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>What's in my Kakao v1.0</span>
            <span>•</span>
            <span>Built with Next.js</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
              로컬에서만 처리
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
