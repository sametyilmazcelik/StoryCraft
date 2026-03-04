import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
    const jobId = (await params).jobId;
    const outputDir = path.join(process.cwd(), "..", "..", "storage", "jobs", jobId, "output");
    let videoPath = path.join(outputDir, "video_storycraft.mp4");

    // Fallback to old names if they exist
    if (!fs.existsSync(videoPath)) {
        const oldPath = path.join(outputDir, "final_video.mp4");
        const basicPath = path.join(outputDir, "video.mp4");
        if (fs.existsSync(oldPath)) videoPath = oldPath;
        else if (fs.existsSync(basicPath)) videoPath = basicPath;
    }

    if (!fs.existsSync(videoPath)) {
        return new NextResponse("Video not found", { status: 404 });
    }

    const file = fs.readFileSync(videoPath);
    return new NextResponse(file, {
        headers: {
            "Content-Type": "video/mp4",
        },
    });
}
