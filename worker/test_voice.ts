import { Communicate } from 'edge-tts-universal';
import fs from 'fs';

async function testVoices() {
    console.log("Testing tr-TR-EmelNeural with max expression (increased rate/pitch)...");

    // We can try to modify rate or pitch for more excitement
    const communicate = new Communicate("Bu efsanevi şehir altından parlıyordu!", {
        voice: 'tr-TR-EmelNeural',
        rate: '+15%',
        pitch: '+10Hz'
    });

    const fileStream = fs.createWriteStream("test_emel.mp3");

    for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
            fileStream.write(chunk.data);
        }
    }
    fileStream.end();
    console.log("Saved test_emel.mp3");
}

testVoices().catch(console.error);
