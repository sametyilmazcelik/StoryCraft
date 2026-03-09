import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string, filename: string }> }
) {
    try {
        const { id, filename } = await params;
        const mediaPath = path.join(process.cwd(), "..", "..", "storage", "jobs", id, "images", filename);

        if (!fs.existsSync(mediaPath)) {
            return new NextResponse("File not found", { status: 404 });
        }

        const stat = fs.statSync(mediaPath);
        const fileStream = fs.createReadStream(mediaPath) as any;
        const ext = path.extname(filename).toLowerCase();

        let contentType = "application/octet-stream";
        if (ext === ".png") contentType = "image/png";
        else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".mp4") contentType = "video/mp4";
        else if (ext === ".webm") contentType = "video/webm";

        const res = new NextResponse(fileStream, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": stat.size.toString(),
            },
        });

        return res;
    } catch (error) {
        console.error("Media fetch error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
