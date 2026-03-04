import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ScenePlan } from '@storycraft/core';

async function generateTTS(text: string, outputPath: string) {
    console.log(`Generating TTS for: "${text.substring(0, 30)}..."`);
    // Using edge-tts CLI as requested
    const command = `edge-tts --voice tr-TR-EmelNeural --text "${text.replace(/"/g, '\\"')}" --write-media "${outputPath}"`;
    execSync(command);
}

function generateSRT(plan: ScenePlan, outputPath: string) {
    let srtContent = '';
    let currentTime = 0;

    plan.scenes.forEach((scene, index) => {
        const startTime = formatSRTTime(currentTime);
        currentTime += scene.duration;
        const endTime = formatSRTTime(currentTime);

        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${scene.text}\n\n`;
    });

    fs.writeFileSync(outputPath, srtContent);
}

function formatSRTTime(seconds: number): string {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = (seconds % 1).toFixed(3).substring(2).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

async function renderPipeline(jobId: string) {
    const jobDir = path.join(process.cwd(), '..', 'storage', 'jobs', jobId);
    const planPath = path.join(jobDir, 'plan.json');
    const plan: ScenePlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

    const outputDir = path.join(jobDir, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. Generate full audio and SRT
    const fullText = plan.scenes.map(s => s.text).join(' ');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const srtPath = path.join(outputDir, 'subtitles.srt');

    await generateTTS(fullText, audioPath);
    generateSRT(plan, srtPath);

    // 2. FFmpeg Rendering
    console.log('Starting FFmpeg render...');
    const videoOutputPath = path.join(outputDir, 'video.mp4');

    // Build FFmpeg complex filter for image sequence with durations
    // For simplicity in MVP, we create a concat script for pictures or use a simpler approach
    const inputs: string[] = [];
    const filterComplex: string[] = [];

    let totalDuration = 0;
    plan.scenes.forEach((scene, i) => {
        const imgPath = path.join(jobDir, 'images', scene.image);
        inputs.push(`-loop 1 -t ${scene.duration} -i "${imgPath}"`);
        filterComplex.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v${i}];`);
        totalDuration += scene.duration;
    });

    const concatFilter = plan.scenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${plan.scenes.length}:v=1:a=0[outv]`;

    const ffmpegCmd = `ffmpeg -y ${inputs.join(' ')} -i "${audioPath}" -filter_complex "${filterComplex.join('')}${concatFilter}" -map "[outv]" -map ${plan.scenes.length}:a -c:v libx264 -pix_fmt yuv420p -r 30 -shortest "${videoOutputPath}"`;

    execSync(ffmpegCmd);

    // 3. Add Subtitles (Optional second pass or combined - doing second pass for simplicity)
    const finalVideoPath = path.join(outputDir, 'final_video.mp4');
    const subtitleCmd = `ffmpeg -y -i "${videoOutputPath}" -vf "subtitles='${srtPath.replace(/\\/g, '/')}'" -c:a copy "${finalVideoPath}"`;
    execSync(subtitleCmd);

    console.log(`Render complete: ${finalVideoPath}`);
}

const jobId = process.argv[2] || 'job1';
renderPipeline(jobId).catch(console.error);
