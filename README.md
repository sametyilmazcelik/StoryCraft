# StoryCraft

A local-first, zero-cost storytelling video generator.

## Özellikler
- 🎬 Sahne tabanlı hikaye anlatımı
- 🎙️ Edge TTS ile Türkçe seslendirme (tr-TR-EmelNeural)
- 🖼️ Görsel odaklı video üretimi
- ⚖️ FFmpeg render pipeline
- 📱 Instagram / TikTok / YouTube Shorts (1080x1920) uyumlu

## Proje Yapısı
- `apps/web`: Next.js frontend paneli
- `worker`: Video üretim pipeline (Node.js/TypeScript)
- `storage`: Job dosyaları ve çıktılar
- `assets`: Genel varlıklar
- `packages/core`: Paylaşılan tipler

## Kurulum

1. Depoyu klonlayın:
   ```bash
   git clone https://github.com/USERNAME/storycraft.git
   cd storycraft
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. Gereksinimler:
   - FFmpeg (Sisteminizde yüklü olmalı)
   - Edge TTS (`pip install edge-tts`)

## Kullanım

1. Frontend'i başlatın:
   ```bash
   npm run web
   ```

2. `/create` sayfasından hikayenizi oluşturun.

3. Worker'ı Manuel Tetikleyin:
   ```bash
   npm run worker -w worker job1
   ```

4. Çıktı: `storage/jobs/job1/output/final_video.mp4`
