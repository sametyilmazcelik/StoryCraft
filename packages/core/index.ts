import { CharacterProfile } from './src/providers/ImageProvider';

export interface SeriesUniverse {
  id: string; // e.g. "series_abc123"
  title: string;
  currentEpisode: number;
  globalContext: string;
  previousEpisodeSummary?: string;
  characterProfile?: CharacterProfile;
}

export interface Scene {
  id: number;
  text: string;
  image: string;
  prompt: string;
  imageUrl?: string;
  videoFile?: File; // For frontend local video uploads
  videoPath?: string; // For backend worker absolute paths
  customImage?: File | string | null;
  duration: number;
  transitionSoundId?: string; // e.g. "whoosh", "glitch", "impact"
  cameraMotion?: string; // e.g. "zoom-in", "pan-right"
}

export interface ScenePlan {
  title: string;
  scenes: Scene[];
  musicMood?: 'cinematic' | 'sad' | 'happy' | 'energetic' | 'suspense' | 'horror';
  voiceGender?: 'female' | 'male';
  voiceTone?: 'normal' | 'korku' | 'eglenceli' | 'surukleyici' | 'ciddi';
  imageStyle?: string;
  characterProfile?: CharacterProfile;
  seriesId?: string;
  episodeNumber?: number;
}

export * from './src/providers/ImageProvider';
export * from './src/managers/ImageManager';
