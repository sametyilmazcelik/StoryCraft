export interface CharacterProfile {
    id: string;
    name: string;
    appearance: string; // Detailed physical description for consistent generation
    baseSeed: number;     // Seed value for deterministic output
}

export interface GenerateImageOptions {
    prompt: string;
    width: number;
    height: number;
    seed?: number;
    characterProfile?: CharacterProfile;
}

export interface ImageProvider {
    name: string;
    generate(options: GenerateImageOptions): Promise<string>; // Returns Image URL
}
