import { ImageProvider, GenerateImageOptions } from '@storycraft/core';

export class GeminiProvider implements ImageProvider {
    name = 'gemini (imagen-3)';

    async generate(options: GenerateImageOptions): Promise<string> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is missing.");
        }

        // Prepare prompt, adding character context if provided
        let finalPrompt = options.prompt;
        if (options.characterProfile) {
            finalPrompt = `${options.characterProfile.appearance}. ${finalPrompt}`;
        }

        const payload = {
            instances: [{ prompt: finalPrompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: "9:16",
                seed: options.seed || options.characterProfile?.baseSeed
            }
        };

        // Google's specific REST endpoint for Imagen 3 via Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Imagen API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
            const base64Data = data.predictions[0].bytesBase64Encoded;
            return `data:image/jpeg;base64,${base64Data}`;
        }

        throw new Error("Gemini returned a success code but no valid image.");
    }
}
