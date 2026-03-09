import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ScenePlan } from '@storycraft/core';
import { Communicate } from 'edge-tts-universal';
import ffmpegPath from 'ffmpeg-static';

if (!ffmpegPath) {
    throw new Error('FFmpeg binary could not be found.');
}

async function generateTTS(
    text: string,
    audioPath: string,
    timeOffset: number = 0,
    startingIndex: number = 1,
    gender: 'female' | 'male' = 'female',
    tone: 'normal' | 'korku' | 'eglenceli' | 'surukleyici' | 'ciddi' = 'normal'
): Promise<{ duration: number, wordCount: number, words: { start: number, end: number, text: string }[] }> {
    console.log(`Generating Word-Synced TTS for: "${text.substring(0, 30)}..." [Tone: ${tone}]`);
    const voiceName = gender === 'male' ? 'tr-TR-AhmetNeural' : 'tr-TR-EmelNeural';

    let rate = "+0%";
    let pitch = "+0Hz";

    switch (tone) {
        case 'korku': rate = "-15%"; pitch = "-15Hz"; break;
        case 'eglenceli': rate = "+10%"; pitch = "+10Hz"; break;
        case 'surukleyici': rate = "+15%"; pitch = "+5Hz"; break;
        case 'ciddi': rate = "-10%"; pitch = "-10Hz"; break;
    }

    const communicate = new Communicate(text, { voice: voiceName, rate, pitch });
    const fileStream = fs.createWriteStream(audioPath);
    const words: { start: number; end: number; text: string }[] = [];
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

    const actualVoiceEnd = words.length > 0 ? words[words.length - 1].end : 0;
    const duration = actualVoiceEnd > 0 ? actualVoiceEnd + 1.2 : 2.5;

    return { duration, wordCount: words.length, words };
}

function formatASSTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Generates viral-style ASS subtitles with karaoke highlight effect.
 * Grouping words for vertical video retention, RESPECTING scene boundaries.
 */
function generateASS(
    sceneWordGroups: { start: number; end: number; text: string }[][],
): string {
    const AUDIO_SYNC_SHIFT = -0.050; // Snappy

    // Header: Primary=White (&H00FFFFFF), Secondary(Highlight)=Yellow (&H0000FFFF)
    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Arial,85,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,6,2,2,10,10,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const groupSize = 6;

    for (const words of sceneWordGroups) {
        if (words.length === 0) continue;

        for (let i = 0; i < words.length; i += groupSize) {
            const group = words.slice(i, i + groupSize);
            if (group.length === 0) continue;

            const groupStart = Math.max(0, group[0].start + AUDIO_SYNC_SHIFT);
            const groupEnd = Math.max(0, group[group.length - 1].end + AUDIO_SYNC_SHIFT);

            let line = `Dialogue: 0,${formatASSTime(groupStart)},${formatASSTime(groupEnd)},Main,,0,0,0,,`;

            group.forEach((word, idx) => {
                const start = Math.max(0, word.start + AUDIO_SYNC_SHIFT);
                const end = Math.max(0, word.end + AUDIO_SYNC_SHIFT);
                const durationCS = Math.round((end - start) * 100);

                line += `{\\k${durationCS}}${word.text}${idx < group.length - 1 ? ' ' : ''}`;
            });

            ass += line + '\n';
        }
    }

    return ass;
}

async function renderPipeline(jobId: string) {
    const jobDir = path.join(process.cwd(), '..', 'storage', 'jobs', jobId);
    const planPath = path.join(jobDir, 'plan.json');
    const plan: ScenePlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

    const outputDir = path.join(jobDir, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. Generate Synchronized TTS and ASS PER SCENE
    const masterAudioWav = path.join(outputDir, 'voice.wav');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const assPath = path.join(outputDir, 'subtitles.ass');

    let allWords: { start: number; end: number; text: string }[][] = [];
    let currentOffset = 0;
    let tempAudioFiles: string[] = [];

    const voiceGender = plan.voiceGender || 'female';
    const voiceTone = plan.voiceTone || 'normal';

    for (let i = 0; i < plan.scenes.length; i++) {
        const rawAudio = path.join(outputDir, `voice_raw_${i}.mp3`);
        const { duration, words } = await generateTTS(plan.scenes[i].text, rawAudio, currentOffset, 1, voiceGender, voiceTone);

        // Map words to global timing for this scene's word group
        const offsetWords = words.map(w => ({ ...w, start: w.start + currentOffset, end: w.end + currentOffset }));
        allWords.push(offsetWords);

        plan.scenes[i].duration = duration;

        const paddedWav = path.join(outputDir, `voice_padded_${i}.wav`);
        execSync(`"${ffmpegPath}" -y -i "${rawAudio}" -af "apad,atrim=0:${duration}" -c:a pcm_s16le "${paddedWav}"`);

        currentOffset += duration;
        tempAudioFiles.push(paddedWav);
    }

    const globalAss = generateASS(allWords);
    fs.writeFileSync(assPath, globalAss);

    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const listText = tempAudioFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, listText);
    execSync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterAudioWav}"`);
    execSync(`"${ffmpegPath}" -y -i "${masterAudioWav}" -c:a libmp3lame "${audioPath}"`);

    // 2. FFmpeg Rendering
    console.log('Starting FFmpeg Render...');
    const finalVideoPath = path.join(outputDir, 'video_storycraft.mp4');
    const assPathSafe = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    const inputs: string[] = [];
    const filterParts: string[] = [];

    let hasLogo = false;
    const logoBase = path.join(process.cwd(), "..", "apps", "web", "public", "logo.png");
    const testPaths = [logoBase, path.join(process.cwd(), "..", "..", "apps", "web", "public", "logo.png")];
    let logoPath = "";
    for (const p of testPaths) { if (fs.existsSync(p)) { logoPath = p; hasLogo = true; break; } }

    const sfxDir = path.join(process.cwd(), '..', 'storage', 'assets', 'sfx');
    if (!fs.existsSync(sfxDir)) fs.mkdirSync(sfxDir, { recursive: true });
    const sfxUrls: Record<string, string> = {
        whoosh: "https://actions.google.com/sounds/v1/foley/swoosh.ogg",
        impact: "https://actions.google.com/sounds/v1/impacts/crash.ogg",
        glitch: "https://actions.google.com/sounds/v1/science_fiction/glitch_synth.ogg",
        riser: "https://actions.google.com/sounds/v1/science_fiction/whoosh_and_hum.ogg"
    };

    const sfxEvents: { file: string; delayMs: number }[] = [];
    let cumulativeTimeSecs = 0;

    let currentInputIndex = 0;
    for (let i = 0; i < plan.scenes.length; i++) {
        const scene = plan.scenes[i];
        if (scene.transitionSoundId && sfxUrls[scene.transitionSoundId] && i > 0) {
            const sfxFile = path.join(sfxDir, `${scene.transitionSoundId}.ogg`);
            if (!fs.existsSync(sfxFile)) {
                try {
                    const res = await fetch(sfxUrls[scene.transitionSoundId]);
                    if (res.ok) fs.writeFileSync(sfxFile, Buffer.from(await res.arrayBuffer()));
                } catch (e) { }
            }
            if (fs.existsSync(sfxFile)) {
                sfxEvents.push({ file: sfxFile, delayMs: Math.floor(cumulativeTimeSecs * 1000) });
            }
        }
        cumulativeTimeSecs += scene.duration;

        const frameCount = Math.ceil(scene.duration * 30) + (i === plan.scenes.length - 1 ? 30 : 0);
        const durationSecs = (frameCount / 30).toFixed(3);

        if (scene.videoPath) {
            const vidPath = path.join(jobDir, 'images', scene.videoPath);
            inputs.push("-stream_loop", "-1", "-i", `"${vidPath}"`);
            filterParts.push(`[${currentInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS,trim=duration=${durationSecs},fps=30,setsar=1[v${i}];`);
        } else {
            const imgPath = path.join(jobDir, 'images', scene.image);
            inputs.push("-i", `"${imgPath}"`);
            const effects = [`zoompan=z='min(zoom+0.001,1.5)':d=${frameCount}:s=1080x1920:fps=30`, `zoompan=z='1.5-0.001*on':d=${frameCount}:s=1080x1920:fps=30`, `zoompan=z=1.2:x='if(lte(on,-1),0,x+0.5)':d=${frameCount}:s=1080x1920:fps=30`, `zoompan=z=1.2:x='if(lte(on,-1),0,x-0.5)':d=${frameCount}:s=1080x1920:fps=30`];
            filterParts.push(`[${currentInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${effects[i % effects.length]},setsar=1[v${i}];`);
        }
        currentInputIndex++;
    }

    const watermarkIndex = currentInputIndex;
    if (hasLogo) {
        inputs.push("-i", `"${logoPath.replace(/\\/g, '/')}"`);
        currentInputIndex++;
    }

    const concatFilter = plan.scenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${plan.scenes.length}:v=1:a=0[outv];`;
    let watermarkFilter = "";
    if (hasLogo) {
        watermarkFilter += `[${watermarkIndex}:v]scale=150:-1[logo_scaled];[outv][logo_scaled]overlay=W-w-50:50[with_logo];`;
        watermarkFilter += `[with_logo]drawtext=text='@kisa.hikaye.evreni':fontcolor=white@0.8:fontsize=36:x=W-tw-50:y=210:shadowcolor=black@0.8:shadowx=3:shadowy=3:fontfile=/Windows/Fonts/arialbd.ttf[with_text];`;
    } else {
        watermarkFilter += `[outv]drawtext=text='@kisa.hikaye.evreni':fontcolor=white@0.8:fontsize=36:x=W-tw-50:y=50:shadowcolor=black@0.8:shadowx=3:shadowy=3:fontfile=/Windows/Fonts/arialbd.ttf[with_text];`;
    }

    const burnSubtitlesFilter = `[with_text]ass='${assPathSafe}'[finalv]`;

    // Audio setup
    const bgMusicPath = path.join(jobDir, 'bgMusic.mp3');
    let hasBgMusic = fs.existsSync(bgMusicPath);
    if (!hasBgMusic) {
        const moodTracks: Record<string, string[]> = { cinematic: ["https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Sails/Kai_Engel_-_02_-_Daedalus.mp3"], horror: ["https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Sustain/Kai_Engel_-_04_-_Slum_Canto.mp3"] };
        const urls = moodTracks[plan.musicMood || 'cinematic'] || moodTracks.cinematic;
        urls.push("https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3");
        for (const musicUrl of urls) {
            try {
                const res = await fetch(musicUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
                if (res.ok) { fs.writeFileSync(bgMusicPath, Buffer.from(await res.arrayBuffer())); hasBgMusic = true; break; }
            } catch (e) { }
        }
    }

    const audioIndex = currentInputIndex;
    inputs.push("-i", `"${audioPath}"`);
    currentInputIndex++;

    const totalDurationSecs = plan.scenes.reduce((s, sc) => s + sc.duration, 0);
    let audioFilterStr = "";
    const mixedAudioLabels: string[] = [];

    if (hasBgMusic) {
        const musicIndex = currentInputIndex;
        inputs.push("-stream_loop", "-1", "-i", `"${bgMusicPath}"`);
        currentInputIndex++;
        audioFilterStr += `[${audioIndex}:a]volume=1.0,apad=whole_dur=${totalDurationSecs + 1}[a_main];`;
        audioFilterStr += `[${musicIndex}:a]volume=0.45,atrim=0:${totalDurationSecs + 1}[a_bg];`;
        mixedAudioLabels.push("[a_main]", "[a_bg]");
    } else {
        audioFilterStr += `[${audioIndex}:a]volume=1.0,apad=whole_dur=${totalDurationSecs + 1}[a_main];`;
        mixedAudioLabels.push("[a_main]");
    }

    sfxEvents.forEach((sfx, idx) => {
        const sfxIndex = currentInputIndex;
        inputs.push("-i", `"${sfx.file}"`);
        currentInputIndex++;
        audioFilterStr += `[${sfxIndex}:a]volume=0.6,adelay=${sfx.delayMs}|${sfx.delayMs}[sfx_${idx}];`;
        mixedAudioLabels.push(`[sfx_${idx}]`);
    });

    if (mixedAudioLabels.length > 1) {
        audioFilterStr += `${mixedAudioLabels.join('')}amix=inputs=${mixedAudioLabels.length}:duration=first:dropout_transition=2[outa]`;
    } else {
        audioFilterStr += `${mixedAudioLabels[0]}anull[outa]`;
    }

    const finalFilterComplex = `${filterParts.join('')}${concatFilter}${watermarkFilter}${burnSubtitlesFilter};${audioFilterStr}`;
    const filterScriptPath = path.join(outputDir, 'filters.txt');
    fs.writeFileSync(filterScriptPath, finalFilterComplex);

    const ffmpegCmd = `"${ffmpegPath}" -y ${inputs.join(' ')} -filter_complex_script "${filterScriptPath.replace(/\\/g, '/')}" -map "[finalv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -r 30 -t ${totalDurationSecs + 0.8} "${finalVideoPath}"`;
    execSync(ffmpegCmd);

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
