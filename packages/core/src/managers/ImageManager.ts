import { ImageProvider, GenerateImageOptions } from '../providers/ImageProvider';

export class ImageManager {
    private providers: ImageProvider[];

    constructor(providers: ImageProvider[]) {
        this.providers = providers;
    }

    async generateWithFallback(options: GenerateImageOptions, maxRetries = 2): Promise<{ url: string, provider: string }> {
        for (const provider of this.providers) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`[ImageManager] Trying provider: ${provider.name}, Attempt: ${attempt}`);
                    const url = await provider.generate(options);
                    return { url, provider: provider.name };
                } catch (error: any) {
                    console.error(`[ImageManager] ${provider.name} failed on attempt ${attempt}:`, error.message);
                    if (attempt === maxRetries) {
                        console.log(`[ImageManager] Provider ${provider.name} exhausted. Switching to next.`);
                        break; // Switch to the next provider
                    }
                    // Simple backoff
                    await new Promise(res => setTimeout(res, attempt * 1000));
                }
            }
        }
        throw new Error("All image providers failed to generate an image.");
    }
}
