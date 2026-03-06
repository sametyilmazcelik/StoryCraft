import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 60; // Max duration for Vercel deployment (AI Horde takes time)

const POLLINATIONS_MIRRORS = [
    "https://pollinations.ai/p",
    "https://gen.pollinations.ai/image"
];

const IMAGE_MODELS = ["flux", "zimage", "imagen-4", "grok-imagine"];

async function tryPollinationsImage(prompt: string, seed: number): Promise<Buffer | null> {
    // Enhancement: Add styling if the prompt is too short
    let enhancedPrompt = prompt;
    if (prompt.length < 100 && !prompt.toLowerCase().includes("photorealistic")) {
        enhancedPrompt = `${prompt}, photorealistic, highly detailed, cinematic lighting, 8k, sharp focus`;
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;

    for (const baseUrl of POLLINATIONS_MIRRORS) {
        // Mirrored endpoints like /p/ use different query params sometimes
        const isPROMode = !!apiKey && baseUrl.includes("gen.pollinations.ai");

        for (const model of IMAGE_MODELS) {
            try {
                // Construct URL based on endpoint type
                let url = "";
                if (baseUrl.includes("/p")) {
                    // Public /p/ endpoint (Very reliable)
                    url = `${baseUrl}/${encodeURIComponent(enhancedPrompt)}?width=1080&height=1920&seed=${seed}&nologo=true&model=${model}`;
                } else {
                    // Standard endpoint
                    url = `${baseUrl}/${encodeURIComponent(enhancedPrompt)}?model=${model}&width=1080&height=1920&nologo=true&seed=${seed}&enhance=true`;
                }

                console.log(`[generate-image] Trying ${model} on ${baseUrl}...`);

                const headers: Record<string, string> = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "image/jpeg,image/png,image/*"
                };

                if (apiKey) {
                    headers["Authorization"] = `Bearer ${apiKey}`;
                }

                const response = await fetch(url, {
                    signal: AbortSignal.timeout(baseUrl.includes("/p") ? 30000 : 45000),
                    headers
                });

                if (response.ok) {
                    const ct = response.headers.get("content-type") || "";
                    if (ct.startsWith("image/")) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        if (buffer.byteLength > 2000) {
                            console.log(`[generate-image] ✅ Success with ${model} on ${baseUrl}! (${buffer.byteLength} bytes)`);
                            return buffer;
                        }
                    }
                }
                console.warn(`[generate-image] ${model} failed: HTTP ${response.status}`);
            } catch (e: any) {
                console.warn(`[generate-image] ${model} error: ${e.message}`);
            }
        }
    }
    return null;
}

async function tryAIHorde(prompt: string): Promise<Buffer | null> {
    try {
        console.log(`[generate-image] Trying AI Horde Backend...`);

        const postRes = await fetch("https://stablehorde.net/api/v2/generate/async", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": "0000000000",
                "Client-Agent": "StoryCraft:1.0:user"
            },
            body: JSON.stringify({
                prompt: prompt + ", masterpiece, best quality, highly detailed",
                params: {
                    n: 1,
                    width: 512,
                    height: 512,
                    steps: 20, // Reduced for speed
                    sampler_name: "k_euler_a"
                },
                nsfw: false,
                models: ["stable_diffusion"]
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!postRes.ok) {
            console.error(`Horde POST failed: ${postRes.status} - ${await postRes.text()}`);
            throw new Error(`Horde POST failed: ${postRes.status}`);
        }

        const { id } = await postRes.json();
        console.log(`[generate-image] AI Horde Job ID: ${id}`);

        let retries = 25; // Up to 50 seconds
        while (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${id}`, {
                signal: AbortSignal.timeout(5000)
            });

            if (checkRes.ok) {
                const status = await checkRes.json();
                if (status.done) {
                    const statusRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${id}`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    const resultData = await statusRes.json();
                    if (resultData.generations && resultData.generations[0]?.img) {
                        const imgRes = await fetch(resultData.generations[0].img);
                        if (imgRes.ok) {
                            return Buffer.from(await imgRes.arrayBuffer());
                        }
                    }
                    break;
                }
            }
            retries--;
        }
    } catch (e: any) {
        console.warn(`[generate-image] AI Horde error: ${e.message}`);
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const { prompt, index } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt gerekli" }, { status: 400 });
        }

        const tempDir = path.join(process.cwd(), "public", "ai-images");
        fs.mkdirSync(tempDir, { recursive: true });

        const seed = Math.floor(Math.random() * 100000);
        const imageFileName = `scene_${index}_${seed}.jpg`;
        const imagePath = path.join(tempDir, imageFileName);

        console.log(`\n[generate-image] === Task: Scene ${index} ===`);

        // Layer 1: Pollinations (Multi-model approach)
        let imageBuffer = await tryPollinationsImage(prompt, seed);
        let provider = "pollinations";

        // Layer 2: AI Horde
        if (!imageBuffer) {
            imageBuffer = await tryAIHorde(prompt);
            provider = "ai-horde";
        }

        if (!imageBuffer) {
            return NextResponse.json(
                { error: "Ücretsiz AI servisleri şu an çok yoğun. Lütfen birkaç dakika sonra tekrar deneyin veya daha kısa bir hikaye kullanın." },
                { status: 502 }
            );
        }

        fs.writeFileSync(imagePath, imageBuffer);
        return NextResponse.json({
            success: true,
            url: `/ai-images/${imageFileName}`,
            provider,
            size: imageBuffer.byteLength
        });

    } catch (error: any) {
        console.error("[generate-image] Fatal Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
