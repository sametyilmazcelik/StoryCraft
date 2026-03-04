import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_TEXT_URL = "https://text.pollinations.ai/";

export async function POST(req: NextRequest) {
    try {
        const { story, language = "tr" } = await req.json();

        if (!story) {
            return NextResponse.json({ error: "Hikaye metni boş olamaz" }, { status: 400 });
        }

        // Force a more granular output by asking for specific indices
        const prompt = `
        Aşağıdaki hikayeyi en az 3-5 mantıklı sahneye böl. 
        Her bir sahne için seslendirme metni (${language === "tr" ? "Türkçe" : "İngilizce"}) ve detaylı bir görsel promptu (İngilizce) oluştur.
        Süreler 4-8 saniye arası olsun.
        
        SADECE JSON DIZISI DÖNDÜR:
        [
          {"text": "...", "imagePrompt": "...", "duration": 5},
          ...
        ]

        HİKAYE:
        ${story}
        `;

        const response = await fetch(POLLINATIONS_TEXT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "Sen bir video yapım asistanısın. Görevin hikayeleri mantıklı parçalara bölmek ve sadece JSON döndürmektir." },
                    { role: "user", content: prompt }
                ],
                seed: Math.floor(Math.random() * 1000000),
                jsonMode: true
            })
        });

        const result = await response.text();

        let scenes: any[] = [];
        try {
            const cleanResult = result.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanResult);

            if (Array.isArray(parsed)) {
                scenes = parsed;
            } else if (parsed.scenes && Array.isArray(parsed.scenes)) {
                scenes = parsed.scenes;
            } else if (typeof parsed === 'object') {
                // If it returns a single object but it's long, try to split the text
                if (parsed.text && parsed.text.length > 100) {
                    const parts = parsed.text.split(/[.!?]/).filter((s: string) => s.trim().length > 10);
                    scenes = parts.map((p: string) => ({
                        text: p.trim() + ".",
                        imagePrompt: parsed.imagePrompt || "Cinematic atmosphere",
                        duration: 5
                    }));
                } else {
                    scenes = [parsed];
                }
            }
        } catch (e) {
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    scenes = JSON.parse(jsonMatch[0]);
                } catch (innerE) { }
            }
        }

        // Advanced Fallback: If AI fails or returns 1 scene for a long text, manually split by sentences
        if (!Array.isArray(scenes) || scenes.length <= 1) {
            const sentences = story.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 5);
            if (sentences.length > 1) {
                scenes = sentences.map(s => ({
                    text: s + ".",
                    imagePrompt: "Cinematic, high detail, artistic style",
                    duration: 5
                }));
            }
        }

        return NextResponse.json({ success: true, scenes });
    } catch (error: any) {
        console.error("Split Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
