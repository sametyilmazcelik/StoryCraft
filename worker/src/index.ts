import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ScenePlan } from '@storycraft/core';
import { Communicate } from 'edge-tts-universal';
import ffmpegPath from 'ffmpeg-static';

if (!ffmpegPath) {
    throw new Error('FFmpeg binary could not be found.');
}

async function generateTTS(text: string, audioPath: string): Promise<string> {
    console.log(`Generating Word-Synced TTS for: "${text.substring(0, 30)}..."`);
    const communicate = new Communicate(text, { voice: 'tr-TR-EmelNeural' });
    const fileStream = fs.createWriteStream(audioPath);
    const words: { start: number; end: number; text: string }[] = [];

    // 1 unit = 100ns = 0.0000001s
    const UNIT_TO_SEC = 0.0000001;

    for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
            fileStream.write(chunk.data);
        } else if (chunk.type === 'WordBoundary' && chunk.text) {
            words.push({
                text: chunk.text,
                start: (chunk.offset || 0) * UNIT_TO_SEC,
                end: ((chunk.offset || 0) + (chunk.duration || 0)) * UNIT_TO_SEC
            });
        }
    }

    await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
        fileStream.end();
    });

    // Generate SRT from words
    let srt = '';
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        srt += `${i + 1}\n${formatSRTTime(word.start)} --> ${formatSRTTime(word.end)}\n${word.text}\n\n`;
    }
    return srt;
}

function formatSRTTime(seconds: number): string {
    const hh = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

async function renderPipeline(jobId: string) {
    const jobDir = path.join(process.cwd(), '..', 'storage', 'jobs', jobId);
    const planPath = path.join(jobDir, 'plan.json');
    const plan: ScenePlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

    const outputDir = path.join(jobDir, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. Generate Synchronized TTS and SRT
    const fullText = plan.scenes.map(s => s.text).join(' ');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const srtPath = path.join(outputDir, 'subtitles.srt');

    const srtContent = await generateTTS(fullText, audioPath);
    fs.writeFileSync(srtPath, srtContent);

    // 2. FFmpeg Rendering (Enhanced Animations)
    console.log('Starting Enhanced Render (Dynamic Camera + Synced Subtitles)...');
    const finalVideoPath = path.join(outputDir, 'video_storycraft.mp4');
    const srtPathSafe = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    // Impactful Subtitle Style: Bold, Yellow, Center-aligned
    const subtitleStyle = "FontSize=24,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1,Alignment=2,MarginV=60,FontName=Arial,Bold=1";

    const inputs: string[] = [];
    const filterParts: string[] = [];

    plan.scenes.forEach((scene, i) => {
        const imgPath = path.join(jobDir, 'images', scene.image);
        inputs.push(`-loop 1 -t ${scene.duration} -i "${imgPath}"`);

        // Dynamic Camera Movements (Randomized per scene)
        const effects = [
            `zoompan=z='min(zoom+0.001,1.5)':d=${scene.duration * 30}:s=1080x1920:fps=30`, // Zoom In
            `zoompan=z='1.5-0.001*on':d=${scene.duration * 30}:s=1080x1920:fps=30`,        // Zoom Out
            `zoompan=z=1.2:x='if(lte(on,-1),0,x+0.5)':d=${scene.duration * 30}:s=1080x1920:fps=30`, // Pan Right
            `zoompan=z=1.2:x='if(lte(on,-1),0,x-0.5)':d=${scene.duration * 30}:s=1080x1920:fps=30`  // Pan Left
        ];
        const effect = effects[i % effects.length];

        filterParts.push(`[${i}:v]scale=2160:3840,${effect},setsar=1[v${i}];`);
    });

    const concatFilter = plan.scenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${plan.scenes.length}:v=1:a=0[outv]`;
    const burnSubtitlesFilter = `[outv]subtitles='${srtPathSafe}':force_style='${subtitleStyle}'[finalv]`;

    const ffmpegCmd = `"${ffmpegPath}" -y ${inputs.join(' ')} -i "${audioPath}" -filter_complex "${filterParts.join('')}${concatFilter};${burnSubtitlesFilter}" -map "[finalv]" -map ${plan.scenes.length}:a -c:v libx264 -pix_fmt yuv420p -r 30 -shortest "${finalVideoPath}"`;

    console.log('Executing FFmpeg V2...');
    execSync(ffmpegCmd);

    console.log(`Video ready for Instagram: ${finalVideoPath}`);

    // 4. Update status
    fs.writeFileSync(path.join(jobDir, "status.json"), JSON.stringify({
        status: "completed",
        completedAt: new Date().toISOString(),
        videoPath: `/api/video/${jobId}`,
        fileName: 'video_storycraft.mp4'
    }));
}

const jobId = process.argv[2] || 'job1';
renderPipeline(jobId).catch(err => {
    console.error(err);
    const jobDir = path.join(process.cwd(), '..', 'storage', 'jobs', jobId);
    fs.writeFileSync(path.join(jobDir, "status.json"), JSON.stringify({
        status: "error",
        error: err.message
    }));
});
