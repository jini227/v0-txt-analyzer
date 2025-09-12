import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const id = Date.now().toString(36)
    const mockUrl = `https://example-bucket.s3.amazonaws.com/kko/${id}.png`

    // 실제 구현 시:
    // const s3Client = new S3Client({ region: 'your-region' })
    // const uploadParams = {
    //   Bucket: 'your-bucket',
    //   Key: `kko/${id}.png`,
    //   Body: Buffer.from(await imageFile.arrayBuffer()),
    //   ContentType: 'image/png'
    // }
    // const result = await s3Client.send(new PutObjectCommand(uploadParams))

    return NextResponse.json({
      id,
      url: mockUrl,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
