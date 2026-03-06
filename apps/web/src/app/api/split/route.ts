import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const POLLINATIONS_TEXT_URL = "https://text.pollinations.ai/";

export async function POST(req: NextRequest) {
    try {
        const { story, language = "tr" } = await req.json();

        if (!story) {
            return NextResponse.json({ error: "Hikaye metni boş olamaz" }, { status: 400 });
        }

        const systemInstruction = `Sen üst düzey bir dijital hikaye anlatıcısı ve video yönetmenisin. 
Görevin: Hikayeleri görsel olarak etkileyici sahnelere bölmek.
KRİTİK TALİMATLAR:
1. Her sahne için "imagePrompt" kısmına bir görüntü yönetmeni gibi (Cinematographer) detaylı İngilizce görsel tarifler yaz. 
2. Örn: "Cinematic medium shot of a weary jeweler's hands meticulously drilling a hole in a glowing golden gem, macro photography, dust motes dancing in sunbeams, workbench background".
3. Duyguyu, ışığı ve dokuyu tasvir et.
4. SADECE JSON DIZISI döndür: [{"text": "...", "imagePrompt": "...", "duration": 6}]`;

        const userPrompt = `Aşağıdaki hikayeyi en az 3-6 mantıklı sahneye böl. 
Sahneler ${language === "tr" ? "Türkçe" : "İngilizce"} olsun. 
Görsel promptlar MUTLAKA İngilizce olsun.

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
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const chatResponse = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
                result = chatResponse.response.text();
            } catch (geminiError: any) {
                console.error("[split] Direct Gemini Error (Quota likely):", geminiError.message);
                // Trigger fallback if direct API fails
                result = await splitWithPollinations();
            }
        } else {
            result = await splitWithPollinations();
        }

        let scenes: any[] = [];
        try {
            const cleanResult = result.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanResult);

            if (Array.isArray(parsed)) {
                scenes = parsed;
            } else if (parsed.scenes && Array.isArray(parsed.scenes)) {
                scenes = parsed.scenes;
            } else if (typeof parsed === 'object') {
                if (parsed.text && parsed.text.length > 50) {
                    // Single object breakdown
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

        // Advanced Fallback: If AI fails, use the text itself as the base for prompt
        if (!Array.isArray(scenes) || scenes.length <= 1) {
            const sentences = story.split(/[.!?]/).map((s: string) => s.trim()).filter((s: string) => s.length > 10);
            if (sentences.length > 1) {
                scenes = sentences.map((s: string) => ({
                    text: s + ".",
                    imagePrompt: `${s}, cinematic lighting, photorealistic, 8k, highly detailed`, // Simple fallback using the text itself
                    duration: 6
                }));
            }
        }

        return NextResponse.json({ success: true, scenes });
    } catch (error: any) {
        console.error("Split Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
