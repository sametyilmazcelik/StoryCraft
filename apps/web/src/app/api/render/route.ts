import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Scene, ScenePlan } from "@storycraft/core";
import { incrementSeriesEpisode } from "../../../lib/series-db";

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

        const bgMusicFile = formData.get("bgMusic") as File | null;
        if (bgMusicFile) {
            const buffer = Buffer.from(await bgMusicFile.arrayBuffer());
            fs.writeFileSync(path.join(jobDir, "bgMusic.mp3"), buffer);
        }

        // Save images/videos and build Scene objects
        for (let i = 0; i < scenes.length; i++) {
            const videoFile = formData.get(`video_${i}`) as File;
            const imageFile = formData.get(`image_${i}`) as File;
            const imageUrl = scenes[i].imageUrl;

            const videoName = `scene_${i + 1}.mp4`;
            const videoPath = path.join(imagesDir, videoName);
            const imageName = `scene_${i + 1}.png`;
            const imagePath = path.join(imagesDir, imageName);

            let finalImageName = "";
            let finalVideoName = "";

            if (videoFile) {
                const buffer = Buffer.from(await videoFile.arrayBuffer());
                fs.writeFileSync(videoPath, buffer);
                finalVideoName = videoName;
                finalImageName = imageName; // Default placeholder for compatibility
            } else if (imageFile) {
                const buffer = Buffer.from(await imageFile.arrayBuffer());
                fs.writeFileSync(imagePath, buffer);
                finalImageName = imageName;
            } else if (imageUrl) {
                if (imageUrl.startsWith("/api/jobs/")) {
                    // Extract job ID and filename to read directly from storage disk
                    // format: /api/jobs/{editJobId}/media/{filename}
                    const parts = imageUrl.split('/');
                    const editJobId = parts[3];
                    const mediaFileName = parts[5];
                    const localSourcePath = path.join(process.cwd(), "..", "..", "storage", "jobs", editJobId, "images", mediaFileName);

                    if (fs.existsSync(localSourcePath)) {
                        if (mediaFileName.endsWith(".mp4") || mediaFileName.endsWith(".webm")) {
                            fs.copyFileSync(localSourcePath, videoPath);
                            finalVideoName = videoName;
                        } else {
                            fs.copyFileSync(localSourcePath, imagePath);
                            finalImageName = imageName;
                        }
                    } else {
                        throw new Error(`Önceki işin yerel medyası bulunamadı: ${imageUrl}`);
                    }
                } else if (imageUrl.startsWith("/")) {
                    // Local file in public directory
                    const localSourcePath = path.join(process.cwd(), "public", imageUrl);
                    if (fs.existsSync(localSourcePath)) {
                        // Skip fetching completely and just copy it over
                        fs.copyFileSync(localSourcePath, imagePath);
                    } else {
                        throw new Error(`Yerel görsel dosyası bulunamadı: ${imageUrl}`);
                    }
                } else {
                    // Robust download from external URL with retries
                    let response;
                    let retries = 5;
                    while (retries > 0) {
                        try {
                            response = await fetch(imageUrl, {
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
                        throw new Error(`Görsel indirilemedi (530/Timeout). Lütfen daha sonra tekrar deneyin.`);
                    }
                }
                finalImageName = imageName;
            }

            finalScenes.push({
                id: i + 1,
                prompt: (scenes[i] as any).prompt || "",
                text: scenes[i].text,
                image: finalImageName,
                videoPath: finalVideoName,
                duration: scenes[i].duration || 5
            });
        }

        // Save plan.json
        const musicMood = (formData.get("musicMood") as string) || "cinematic";
        const voiceGender = (formData.get("voiceGender") as string) || "female";
        const voiceTone = (formData.get("voiceTone") as string) || "normal";
        const imageStyle = formData.get("imageStyle") as string;

        const characterProfileStr = formData.get("characterProfile") as string;
        let characterProfile = undefined;
        try { if (characterProfileStr) characterProfile = JSON.parse(characterProfileStr); } catch (e) { }

        const seriesId = formData.get("seriesId") as string;
        const episodeNumber = formData.get("episodeNumber") ? parseInt(formData.get("episodeNumber") as string) : undefined;

        if (seriesId) {
            try {
                // Generate a simple summary from the first few scenes for the next episode context
                const simpleSummary = scenes.slice(0, 3).map(s => s.text).join(" ");
                incrementSeriesEpisode(seriesId, simpleSummary, characterProfile);
            } catch (e) {
                console.warn("Failed to increment series episode", e);
            }
        }

        const plan: ScenePlan = {
            title,
            scenes: finalScenes,
            musicMood: musicMood as ScenePlan["musicMood"],
            voiceGender: voiceGender as ScenePlan["voiceGender"],
            voiceTone: voiceTone as ScenePlan["voiceTone"],
            imageStyle,
            characterProfile,
            seriesId,
            episodeNumber
        };
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
