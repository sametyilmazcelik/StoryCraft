import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CharacterProfile } from "@storycraft/core";

export const maxDuration = 60;

const POLLINATIONS_TEXT_URL = "https://text.pollinations.ai/";

export async function POST(req: NextRequest) {
    try {
        const { story, language = "tr", seriesContext, previousEpisodeSummary, episodeNumber, imageStyle, customImageStyle } = await req.json();

        if (!story) {
            return NextResponse.json({ error: "Hikaye metni boş olamaz" }, { status: 400 });
        }

        const seriesInstruction = seriesContext ? `
ÖNEMLİ: Bu video, bir dizinin Bölüm ${episodeNumber || 2}'sidir.
Dizi Evreni (Global Context): ${seriesContext}
Önceki Bölüm Özeti: ${previousEpisodeSummary || 'Bilinmiyor'}
Görevin, hikayeyi bu bağlama (context) uygun olarak devam ettirmek ve görsel tutarlılığı korumaktır. Yeni bölüm de acımasız ve merak uyandırıcı bir "Hook" (Kanca) ile başlamalıdır.` : "";

        let styleInstruction = "";
        if (imageStyle) {
            if (imageStyle === "custom" && customImageStyle) {
                styleInstruction = `\nGÖRSEL STİLİ (ZORUNLU): ${customImageStyle}. Her sahne promptu kesinlikle bu görsel tarza (art style) göre yazılmalıdır.`;
            } else {
                styleInstruction = `\nGÖRSEL STİLİ (ZORUNLU): ${imageStyle}. Her sahne promptu kesinlikle bu görsel tarza (art style) göre yazılmalıdır. Örneğin eğer karikatürse 'cartoon, 2d vector art, illustration', animeyse 'makoto shinkai style, anime key visual', gerçekçiyse 'photorealistic, cinematic portrait 8k' gibi kelimeler kullan.`;
            }
        }

        const systemInstruction = `Sen üst düzey bir dijital hikaye anlatıcısı ve video yönetmenisin. 
Görevin: Hikayeleri sosyal medya (TikTok, Shorts) için görsel olarak etkileyici ve çok hızlı akan sahnelere bölmek.
KRİTİK TALİMATLAR:
1. Hikayede belirgin bir ana karakter varsa, "characterProfile" objesi oluştur ve fiziksel özelliklerini (göz rengi, saç, kıyafet, yaş, yüz özellikleri) ÇOK DETAYLI İNGİLİZCE olarak "appearance" alanına yaz.
2. HIZLI RİTİM (FAST PACING): Sosyal medya için sahneler çok kısa olmalıdır. Hikayeyi en az 6 en fazla 12 kısa sahneye böl. Metinleri kısa ve vurucu tut (her sahne metni 1-2 cümleyi geçmemeli).
3. KANCA (HOOK) KURALI (ÇOK ÖNEMLİ): Sahne 1, videonun ilk 3 saniyesini temsil eder. Bu sahnenin metni ("text") son derece ŞOK EDİCİ, MERAK UYANDIRICI veya DİKKAT ÇEKİCİ bir KISA CÜMLE olmalıdır. Orijinal hikayeden güçlü bir kanca yarat.${seriesContext ? seriesInstruction : ''}
4. GÖRSEL DİNAMİZM VE TUTARLILIK: Her sahnenin "imagePrompt" kısmına bir görüntü yönetmeni gibi detaylı İngilizce görsel tarifler yaz. Kamera açılarını çeşitlendir (Close-up, Wide shot, Dutch angle vs.). Eğer bir karakter tanımlarsan (characterProfile), karakterin ismini ve 'appearance' detaylarını HER BİR imagePrompt'un en başına birebir ekle. Böylece karakterin her sahnede aynı görünmesi garanti altına alınsın.${styleInstruction}
5. SES EFEKTİ (SFX): Her sahne geçişi (scene transition) için beyni uyaran bir ses efekti ID'si dönmelisin ("transitionSoundId"). Seçenekler: "whoosh", "impact", "glitch", "riser", veya istemiyorsan boş bırak "". Sahne 1 için boş bırak.
6. SADECE AŞAĞIDAKİ JSON FORMATINDA DÖNÜŞ YAP, BAŞKA METİN YAZMA:
{
  "characterProfile": {
    "name": "Karakter Adı",
    "appearance": "A 30-year-old man, rugged beard, deep green eyes, messy black hair, wearing a worn-out brown leather jacket"
  },
  "scenes": [
    {
      "text": "...", 
      "imagePrompt": "...", 
      "transitionSoundId": "whoosh"
    }
  ]
}`;

        const userPrompt = `Aşağıdaki hikayeyi sahnelere böl. 
Sahnelerin "text" kısımları ${language === "tr" ? "Türkçe" : "İngilizce"} olsun. 
"appearance" ve "imagePrompt" kısımları MUTLAKA İNGİLİZCE olsun. 

HİKAYE:
${story}`;

        let result = "";

        const splitWithPollinations = async () => {
            console.log("[split] Using free Pollinations Gemini proxy...");
            const response = await fetch(POLLINATIONS_TEXT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: userPrompt }
                    ],
                    model: "gemini",
                    seed: Math.floor(Math.random() * 1000000),
                    jsonMode: true
                })
            });
            return await response.text();
        };

        // Direct Gemini API Support (Higher quality/reliability)
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (geminiApiKey) {
            try {
                console.log("[split] Attempting direct Gemini API...");
                const genAI = new GoogleGenerativeAI(geminiApiKey);
                // Using gemini-2.5-flash as it is fast and high quality if available, falling back to gemini-2.0-flash
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const chatResponse = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
                result = chatResponse.response.text();
            } catch (geminiError: any) {
                console.error("[split] Direct Gemini-2.5-flash Error (Quota likely):", geminiError.message);
                try {
                    console.log("[split] Trying gemini-2.0-flash fallback...");
                    const genAI = new GoogleGenerativeAI(geminiApiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                    const chatResponse = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
                    result = chatResponse.response.text();
                } catch (e) {
                    result = await splitWithPollinations();
                }
            }
        } else {
            result = await splitWithPollinations();
        }

        let parsedData: any = {};
        try {
            const cleanResult = result.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(cleanResult);
        } catch (e) {
            // Find JSON object
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedData = JSON.parse(jsonMatch[0]);
                } catch (innerE) { }
            }
        }

        let scenes = parsedData.scenes || [];
        let characterProfile: CharacterProfile | undefined = parsedData.characterProfile;

        if (characterProfile && characterProfile.appearance) {
            // Assign a random deterministic seed for the character
            characterProfile.baseSeed = Math.floor(Math.random() * 100000000);
            characterProfile.id = "char_" + Date.now();
        } else {
            characterProfile = undefined; // Nullify if invalid
        }

        // Advanced Fallback: If AI fails, use the text itself as the base for prompt
        if (!Array.isArray(scenes) || scenes.length <= 1) {
            const sentences = story.split(/[.!?]/).map((s: string) => s.trim()).filter((s: string) => s.length > 10);
            if (sentences.length > 1) {
                scenes = sentences.map((s: string, idx: number) => ({
                    text: s + ".",
                    imagePrompt: `${s}, cinematic lighting, vertical 9:16 composition, photorealistic, 8k, highly detailed`,
                    transitionSoundId: idx > 0 ? "whoosh" : ""
                }));
            }
        }

        return NextResponse.json({ success: true, scenes, characterProfile });
    } catch (error: any) {
        console.error("Split Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
