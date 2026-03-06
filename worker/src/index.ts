import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ScenePlan } from '@storycraft/core';
import { Communicate } from 'edge-tts-universal';
import ffmpegPath from 'ffmpeg-static';

if (!ffmpegPath) {
    throw new Error('FFmpeg binary could not be found.');
}

async function generateTTS(text: string, audioPath: string, timeOffset: number = 0, startingIndex: number = 1): Promise<{ srt: string, duration: number, wordCount: number }> {
    console.log(`Generating Word-Synced TTS for: "${text.substring(0, 30)}..."`);
    // Reverted pitch/rate to keep natural voice
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

    // Generate SRT from words with offset
    let srt = '';
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        srt += `${startingIndex + i}\n${formatSRTTime(word.start + timeOffset)} --> ${formatSRTTime(word.end + timeOffset)}\n${word.text}\n\n`;
    }

    // Add a natural 1.5s pause after each sentence to prevent word clipping and give breathing room.
    // Fallback if no words array returned.
    const duration = words.length > 0 ? words[words.length - 1].end + 1.5 : 2.5;

    return { srt, duration, wordCount: words.length };
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

    // 1. Generate Synchronized TTS and SRT PER SCENE
    const audioPath = path.join(outputDir, 'voice.mp3');
    const srtPath = path.join(outputDir, 'subtitles.srt');

    let globalSrt = '';
    let currentOffset = 0;
    let srtIndex = 1;
    let tempAudioFiles: string[] = [];

    console.log("Generating audio tracks locally to calculate exact scene durations...");
    for (let i = 0; i < plan.scenes.length; i++) {
        const sceneAudio = path.join(outputDir, `voice_${i}.mp3`);
        const { srt, duration, wordCount } = await generateTTS(plan.scenes[i].text, sceneAudio, currentOffset, srtIndex);

        globalSrt += srt;
        plan.scenes[i].duration = duration; // Sync the video exact scene length!
        currentOffset += duration;
        srtIndex += wordCount;
        tempAudioFiles.push(sceneAudio);
    }
    fs.writeFileSync(srtPath, globalSrt);

    // Concat all intermediate MP3s into one master voice.mp3 via FFmpeg cleanly
    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const listText = tempAudioFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, listText);
    execSync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${audioPath}"`);

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
        inputs.push(`-i "${imgPath}"`);

        // Dynamic Camera Movements
        // Add a 1s safety buffer to the LAST scene to ensure it covers any audio overflow
        const buffer = (i === plan.scenes.length - 1) ? 30 : 0;
        const frameCount = Math.ceil(scene.duration * 30) + buffer;
        const effects = [
            `zoompan=z='min(zoom+0.001,1.5)':d=${frameCount}:s=1080x1920:fps=30`, // Zoom In
            `zoompan=z='1.5-0.001*on':d=${frameCount}:s=1080x1920:fps=30`,        // Zoom Out
            `zoompan=z=1.2:x='if(lte(on,-1),0,x+0.5)':d=${frameCount}:s=1080x1920:fps=30`, // Pan Right
            `zoompan=z=1.2:x='if(lte(on,-1),0,x-0.5)':d=${frameCount}:s=1080x1920:fps=30`  // Pan Left
        ];
        const effect = effects[i % effects.length];

        // Ensure input is properly scaled matching 1080x1920 before zoompan to avoid zoompan aspect ratio glitches
        filterParts.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${effect},setsar=1[v${i}];`);
    });

    const concatFilter = plan.scenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${plan.scenes.length}:v=1:a=0[outv];`;
    const burnSubtitlesFilter = `[outv]subtitles='${srtPathSafe}':force_style='${subtitleStyle}'[finalv]`;

    // Audio setup
    const bgMusicPath = path.join(jobDir, 'bgMusic.mp3');
    let hasBgMusic = fs.existsSync(bgMusicPath);

    if (!hasBgMusic) {
        const mood = plan.musicMood || 'cinematic';
        console.log(`No background music found. Downloading "${mood}" track automatically...`);

        const moodTracks: Record<string, string[]> = {
            cinematic: [
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dramatic%20Score%202.mp3",
                "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3"
            ],
            sad: [
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Darkness%20Speaks.mp3",
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lost%20Frontier.mp3"
            ],
            happy: [
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3",
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Life%20of%20Riley.mp3"
            ],
            energetic: [
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher.mp3"
            ],
            suspense: [
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3",
                "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3"
            ]
        };

        const urls = moodTracks[mood] || moodTracks.cinematic;
        const randomUrl = urls[Math.floor(Math.random() * urls.length)];
        try {
            const res = await fetch(randomUrl, { signal: AbortSignal.timeout(15000) });
            if (res.ok) {
                fs.writeFileSync(bgMusicPath, Buffer.from(await res.arrayBuffer()));
                hasBgMusic = true;
                console.log(`Downloaded "${mood}" cinematic track.`);
            }
        } catch (e) {
            console.warn("Failed to download fallback background music:", (e as Error).message);
        }
    }

    // Total duration = sum of all scenes (set from actual TTS audio length)
    const audioIndex = plan.scenes.length; // Voice TTS index
    const totalDurationSecs = plan.scenes.reduce((s, sc) => s + sc.duration, 0);

    let audioOpts = `-i "${audioPath}"`;
    let audioMapArgs = `-map ${audioIndex}:a`;
    let audioFilter = "";

    if (hasBgMusic) {
        const musicIndex = audioIndex + 1;
        audioOpts += ` -stream_loop -1 -i "${bgMusicPath}"`;
        // Increased bg volume to 0.18 for better presence, lowered voice volume to 0.8 instead of 1.5 to prevent clipping
        audioFilter = `[${audioIndex}:a]volume=1.0,apad=whole_dur=${totalDurationSecs + 1}[a_main];[${musicIndex}:a]volume=0.18,atrim=0:${totalDurationSecs + 1}[a_bg];[a_main][a_bg]amix=inputs=2:duration=first:dropout_transition=2[outa]`;
        audioMapArgs = `-map "[outa]"`;
    } else {
        // Even without music, pad voice to full duration to avoid early cut
        audioFilter = `[${audioIndex}:a]volume=1.0,apad=whole_dur=${totalDurationSecs + 1}[outa]`;
        audioMapArgs = `-map "[outa]"`;
    }

    // Combine all filters
    const finalFilterComplex = `${filterParts.join('')}${concatFilter}${burnSubtitlesFilter};${audioFilter}`;
    const filterScriptPath = path.join(outputDir, 'filters.txt');
    fs.writeFileSync(filterScriptPath, finalFilterComplex);

    // Use +1.0s safety margin on -t to ENSURE audio is not cut. 
    // amix with duration=first on the padded audio stream will lead.
    // Use -filter_complex_script to avoid Windows command line length limits
    const ffmpegCmd = `"${ffmpegPath}" -y ${inputs.join(' ')} ${audioOpts} -filter_complex_script "${filterScriptPath.replace(/\\/g, '/')}" -map "[finalv]" ${audioMapArgs} -c:v libx264 -pix_fmt yuv420p -r 30 -t ${totalDurationSecs + 0.8} "${finalVideoPath}"`;

    console.log('Executing FFmpeg V2 (using filter script)...');
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
