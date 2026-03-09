import { ImageProvider, GenerateImageOptions } from '@storycraft/core';

export class PollinationsProvider implements ImageProvider {
    name = 'pollinations.ai';

    async generate(options: GenerateImageOptions): Promise<string> {

        let finalPrompt = options.prompt;
        if (options.characterProfile) {
            finalPrompt = `${options.characterProfile.appearance}. ${finalPrompt}`;
        }

        const seed = options.seed || options.characterProfile?.baseSeed || Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(finalPrompt);

        // Pollinations directly returns the image bypass CORS
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${options.width}&height=${options.height}&nologo=true&seed=${seed}`;

        // Test if the URL is reachable and downloads an image
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) {
            throw new Error(`Pollinations API returned ${res.status}`);
        }

        return url;
    }
}
