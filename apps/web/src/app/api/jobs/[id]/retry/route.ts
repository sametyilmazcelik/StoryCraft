import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: jobId } = await params;
        const jobDir = path.join(process.cwd(), "..", "..", "storage", "jobs", jobId);

        if (!fs.existsSync(jobDir)) {
            return NextResponse.json({ error: "Job bulunamadı" }, { status: 404 });
        }

        // Reset status to processing
        fs.writeFileSync(path.join(jobDir, "status.json"), JSON.stringify({
            status: "processing",
            startedAt: new Date().toISOString()
        }));

        // Delete previous output directory to ensure a clean slate
        const outputDir = path.join(jobDir, "output");
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }

        // Trigger Worker automatically
        const workerPath = path.join(process.cwd(), "..", "..", "worker", "src", "index.ts");

        // Windows requires shell: true for npx
        const child = spawn("npx", ["tsx", workerPath, jobId], {
            cwd: path.join(process.cwd(), "..", "..", "worker"),
            detached: true,
            stdio: 'ignore',
            shell: true
        });

        child.unref();

        return NextResponse.json({ success: true, message: "Render işlemi yeniden başlatıldı." });

    } catch (error: any) {
        console.error("Retry render error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
