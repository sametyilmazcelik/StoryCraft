import { ImageProvider, GenerateImageOptions } from '@storycraft/core';
import { fal } from '@fal-ai/client';

export class FalProvider implements ImageProvider {
    name = 'fal.ai';

    async generate(options: GenerateImageOptions): Promise<string> {
        if (!process.env.FAL_KEY) {
            throw new Error("FAL_KEY environment variable is missing.");
        }

        // Default to a fast/good model. flux/dev is extremely high quality.
        const result: any = await fal.subscribe("fal-ai/flux/dev", {
            input: {
                prompt: options.prompt,
                image_size: {
                    width: options.width,
                    height: options.height
                },
                num_inference_steps: 28,
                guidance_scale: 3.5,
                num_images: 1,
                enable_safety_checker: false,
                sync_mode: true,
                seed: options.seed || options.characterProfile?.baseSeed || Math.floor(Math.random() * 100000000)
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs.map((log) => log.message).forEach(console.log);
                }
            },
        });

        if (result.data && result.data.images && result.data.images.length > 0) {
            return result.data.images[0].url;
        }

        throw new Error("Fal.ai returned an empty image array.");
    }
}
