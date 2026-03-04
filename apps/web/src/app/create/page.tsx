"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SceneInput {
    text: string;
    image: File | null;
    imagePreview?: string;
    prompt?: string;
    duration?: number;
}

export default function CreatePage() {
    const router = useRouter();
    const [title, setTitle] = useState("Sükunet");
    const [fullStory, setFullStory] = useState("");
    const [language, setLanguage] = useState<"tr" | "en">("tr");
    const [isSplitting, setIsSplitting] = useState(false);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [scenes, setScenes] = useState<SceneInput[]>([
        { text: "Bazen sadece durmak gerekir.", image: null },
        { text: "Dünyanın gürültüsünden uzaklaşmak için.", image: null }
    ]);
    const [loading, setLoading] = useState(false);

    const handleSplitStory = async () => {
        if (!fullStory) {
            alert("Lütfen önce bir hikaye yazın.");
            return;
        }
        setIsSplitting(true);
        try {
            const res = await fetch("/api/split", {
                method: "POST",
                body: JSON.stringify({ story: fullStory, language })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.scenes)) {
                const newScenes = data.scenes.map((s: any) => ({
                    text: s.text,
                    image: null,
                    imagePreview: "",
                    prompt: s.imagePrompt,
                    duration: s.duration || 5
                }));
                setScenes(newScenes);
                if (newScenes.length > 0 && (!title || title === "Sükunet")) {
                    setTitle("Yapay Zeka Hikayesi");
                }
            } else {
                alert("Hikaye bölünemedi veya geçersiz format: " + (data.error || "Sunucu hatası"));
            }
        } catch (err) {
            console.error(err);
            alert("Bağlantı hatası!");
        } finally {
            setIsSplitting(false);
        }
    };

    const handleGenerateImages = async () => {
        if (scenes.length === 0) return;
        setIsGeneratingImages(true);
        try {
            const newScenes = [...scenes];
            for (let i = 0; i < newScenes.length; i++) {
                const scene = newScenes[i];
                if (scene.prompt) {
                    const pollinationUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(scene.prompt)}?width=1080&height=1920&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

                    newScenes[i] = {
                        ...scene,
                        imagePreview: pollinationUrl,
                        image: null
                    };
                    setScenes([...newScenes]);
                    // Add a small delay between requests to avoid rate limits
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGeneratingImages(false);
        }
    };

    const addScene = () => {
        setScenes([...scenes, { text: "", image: null }]);
    };

    const handleTextChange = (index: number, text: string) => {
        const newScenes = [...scenes];
        newScenes[index].text = text;
        setScenes(newScenes);
    };

    const handleImageChange = (index: number, file: File | null) => {
        const newScenes = [...scenes];
        newScenes[index].image = file;
        setScenes(newScenes);
    };

    const handleSubmit = async () => {
        if (scenes.some(s => (!s.image && !s.imagePreview) || !s.text)) {
            alert("Lütfen tüm sahnelerin metinlerini ve görsellerini doldurun.");
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("title", title);

            // Map scenes for the API
            const scenesMeta = scenes.map((s, i) => ({
                text: s.text,
                imageIndex: i,
                duration: s.duration || 5,
                imageUrl: s.imagePreview && !s.image ? s.imagePreview : undefined
            }));
            formData.append("scenes", JSON.stringify(scenesMeta));

            // Append images
            scenes.forEach((s, i) => {
                if (s.image) {
                    formData.append(`image_${i}`, s.image);
                }
            });

            const response = await fetch("/api/render", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                router.push("/jobs");
            } else {
                alert("Hata oluştu: " + result.error);
            }
        } catch (error) {
            console.error(error);
            alert("Bağlantı hatası!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-purple-500/30">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
            </div>

            <div className="relative max-w-3xl mx-auto py-16 px-6 space-y-12">
                <header className="space-y-4">
                    <h1 className="text-5xl font-black tracking-tight text-white italic">
                        Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Craft</span>
                    </h1>
                    <p className="text-slate-400 text-lg">Hikayeni kurgula, görsellerini yükle ve videonu saniyeler içinde oluştur.</p>
                </header>

                <main className="space-y-8">
                    <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Proje Başlığı</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-xl font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                placeholder="Hikayene bir isim ver..."
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-blue-400">Yapay Zeka Hikaye Girişi</label>
                                <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => setLanguage("tr")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "tr" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                                    >
                                        TÜRKÇE
                                    </button>
                                    <button
                                        onClick={() => setLanguage("en")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                                    >
                                        ENGLISH
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={fullStory}
                                onChange={(e) => setFullStory(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 h-40 text-slate-300 placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                                placeholder="Buraya uzun bir hikaye yapıştır, yapay zeka senin için sahneleri bölsün..."
                            />
                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={handleSplitStory}
                                    disabled={isSplitting || !fullStory}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    {isSplitting ? "Bölünüyor..." : "🤖 Hikayeyi Sahneler Böl"}
                                </button>
                                <button
                                    onClick={handleGenerateImages}
                                    disabled={isGeneratingImages || scenes.length === 0}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    {isGeneratingImages ? "Üretiliyor..." : "🎨 Görselleri Otomatik Üret"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <div className="space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 px-2">
                            <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm">✨</span>
                            Sahneler
                        </h2>

                        {scenes.map((scene, index) => (
                            <div key={index} className="group relative bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:border-white/10 p-6 rounded-3xl transition-all hover:translate-x-1">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Sahne #{index + 1}</span>
                                        </div>
                                        <textarea
                                            placeholder="Bu sahnede ne anlatılıyor?"
                                            value={scene.text}
                                            onChange={(e) => handleTextChange(index, e.target.value)}
                                            className="w-full bg-slate-950/30 border border-white/5 rounded-2xl p-4 h-32 text-slate-300 placeholder:text-slate-600 focus:border-purple-500/30 outline-none transition-all resize-none"
                                        />
                                    </div>
                                    <div className="md:w-64 space-y-4">
                                        <div className="aspect-video bg-slate-950/50 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative group-hover:border-purple-500/30 transition-all">
                                            {scene.imagePreview || scene.image ? (
                                                <img
                                                    src={scene.imagePreview || (scene.image ? URL.createObjectURL(scene.image) : "")}
                                                    className="w-full h-full object-cover"
                                                    alt="Preview"
                                                />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <div className="text-2xl mb-1">🖼️</div>
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Görsel Yükle</div>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleImageChange(index, e.target.files?.[0] || null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <div className="text-[10px] text-center text-slate-500 font-medium">Önerilen: 1080x1920 PNG</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={addScene}
                        className="w-full py-4 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all font-semibold"
                    >
                        + Yeni Sahne Ekle
                    </button>
                </main>

                <footer className="pt-8">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl font-black text-white text-xl shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)] hover:shadow-[0_0_50px_-5px_rgba(168,85,247,0.6)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-3">
                                <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                Hazırlanıyor...
                            </span>
                        ) : "Videonun Renderını Başlat"}
                    </button>
                </footer>
            </div>
        </div>
    );
}
