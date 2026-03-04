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

1. Depoyu klonlayın ve klasöre girin.
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

## Kullanım

1. Sistemi başlatın:
   ```bash
   npm run web
   ```

2. `/create` sayfasından hikayenizi oluşturun. "Üret" dediğinizde yönlendirildiğiniz `/jobs` sayfasından süreci takip edebilirsiniz.

> [!IMPORTANT]
> Sistem artık tamamen taşınabilirdir. FFmpeg veya Python yüklemenize gerek yoktur; tüm araçlar proje bağımlılığı olarak otomatik gelir.

4. Çıktı: `storage/jobs/job1/output/final_video.mp4`
