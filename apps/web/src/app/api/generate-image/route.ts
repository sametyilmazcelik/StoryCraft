import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ImageManager, GenerateImageOptions, CharacterProfile } from "@storycraft/core";
import { FalProvider, GeminiProvider, PollinationsProvider } from "@/lib/image-providers";

export const maxDuration = 60; // Max duration for Vercel deployment

// Initialize the ImageManager with the prioritized providers
const imageManager = new ImageManager([
    new FalProvider(),
    new GeminiProvider(),
    new PollinationsProvider()
]);

// Helper to save image URL or Base64 data to local FS
async function saveImageToDisk(urlOrBase64: string, destinationPath: string): Promise<number> {
    if (urlOrBase64.startsWith('data:image')) {
        // Handle Base64 (from Gemini)
        const base64Data = urlOrBase64.split(';base64,').pop();
        if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(destinationPath, buffer);
            return buffer.byteLength;
        }
    } else {
        // Handle URL (from Fal or Pollinations)
        const response = await fetch(urlOrBase64);
        if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(destinationPath, buffer);
            return buffer.byteLength;
        } else {
            throw new Error(`Failed to download image from provider URL: ${response.statusText}`);
        }
    }
    throw new Error('Invalid image data format returned by provider.');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const prompt = body.prompt;
        const index = body.index;
        const passedSeed = body.seed;
        const characterProfile: CharacterProfile | undefined = body.characterProfile;

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Aggressive Character Consistency: Prepend the character description 
        // strictly to the prompt regardless of what the LLM generated.
        let finalPrompt = prompt;
        if (characterProfile && characterProfile.appearance) {
            finalPrompt = `[CHARACTER PROFILE: ${characterProfile.name} - ${characterProfile.appearance}] ${prompt}`;
        }

        const tempDir = path.join(process.cwd(), "public", "ai-images");
        fs.mkdirSync(tempDir, { recursive: true });

        const seed = passedSeed || (characterProfile?.baseSeed) || Math.floor(Math.random() * 100000);
        const imageFileName = `scene_${index}_${seed}.jpg`;
        const imagePath = path.join(tempDir, imageFileName);

        console.log(`\n[generate-image] === Task: Scene ${index} ===`);

        const options: GenerateImageOptions = {
            prompt: finalPrompt,
            width: 1080,
            height: 1920,
            seed,
            characterProfile
        };

        const result = await imageManager.generateWithFallback(options, 2);

        const sizeBytes = await saveImageToDisk(result.url, imagePath);

        return NextResponse.json({
            success: true,
            url: `/ai-images/${imageFileName}`,
            provider: result.provider,
            size: sizeBytes
        });

    } catch (error: any) {
        console.error("[generate-image] Fatal Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
