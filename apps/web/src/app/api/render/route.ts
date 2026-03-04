import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Scene, ScenePlan } from "@storycraft/core";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const title = formData.get("title") as string;
        const scenesData = formData.get("scenes") as string;
        const scenes: { text: string; imageIndex: number; duration?: number; imageUrl?: string }[] = JSON.parse(scenesData);

        const jobId = `job_${Date.now()}`;
        const jobDir = path.join(process.cwd(), "..", "..", "storage", "jobs", jobId);
        const imagesDir = path.join(jobDir, "images");
        const outputDir = path.join(jobDir, "output");

        // Create directories
        fs.mkdirSync(imagesDir, { recursive: true });
        fs.mkdirSync(outputDir, { recursive: true });

        const finalScenes: Scene[] = [];

        // Save images and build Scene objects
        for (let i = 0; i < scenes.length; i++) {
            const imageFile = formData.get(`image_${i}`) as File;
            const imageUrl = scenes[i].imageUrl;
            const imageName = `scene_${i + 1}.png`;
            const imagePath = path.join(imagesDir, imageName);

            if (imageFile) {
                const buffer = Buffer.from(await imageFile.arrayBuffer());
                fs.writeFileSync(imagePath, buffer);
            } else if (imageUrl) {
                // Robust download from URL with retries
                let response;
                let retries = 5;
                while (retries > 0) {
                    try {
                        response = await fetch(imageUrl, {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Referer": "https://pollinations.ai/"
                            },
                            signal: AbortSignal.timeout(20000)
                        });
                        if (response.ok) break;
                    } catch (e) {
                        console.warn(`Download retry ${6 - retries} failed for ${imageUrl}`);
                    }
                    retries--;
                    if (retries > 0) await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                }

                if (response && response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(imagePath, buffer);
                } else {
                    console.error(`Failed to download image after all retries: ${imageUrl}`);
                    // Fallback to a placeholder so the process doesn't die
                    throw new Error(`Görsel indirilemedi (530/Timeout). Lütfen daha sonra tekrar deneyin.`);
                }
            }

            finalScenes.push({
                id: i + 1,
                text: scenes[i].text,
                image: imageName,
                duration: scenes[i].duration || 5
            });
        }

        // Save plan.json
        const plan: ScenePlan = { title, scenes: finalScenes };
        fs.writeFileSync(path.join(jobDir, "plan.json"), JSON.stringify(plan, null, 2));

        // Initialize status.json
        fs.writeFileSync(path.join(jobDir, "status.json"), JSON.stringify({
            status: "processing",
            startedAt: new Date().toISOString()
        }));

        // Trigger Worker automatically
        const workerPath = path.join(process.cwd(), "..", "..", "worker", "src", "index.ts");

        // Using tsx to run the worker script
        // Windows requires shell: true for npx
        const child = spawn("npx", ["tsx", workerPath, jobId], {
            cwd: path.join(process.cwd(), "..", "..", "worker"),
            detached: true,
            stdio: 'ignore',
            shell: true
        });

        child.unref(); // Allow the parent process to exit independently

        return NextResponse.json({
            success: true,
            jobId,
            message: "Render işlemi arka planda başlatıldı."
        });

    } catch (error: any) {
        console.error("Render error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
