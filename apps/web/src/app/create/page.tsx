"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Scene {
    text: string;
    image: File | null;
    imagePreview?: string;
    videoFile?: File | null;
    videoPreview?: string;
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
    const [scenes, setScenes] = useState<Scene[]>([
        { text: "Bazen sadece durmak gerekir.", image: null },
        { text: "Dünyanın gürültüsünden uzaklaşmak için.", image: null }
    ]);
    const [bgMusic, setBgMusic] = useState<File | null>(null);
    const [musicMood, setMusicMood] = useState<string>("cinematic");
    const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
    const [voiceTone, setVoiceTone] = useState<"normal" | "korku" | "eglenceli" | "surukleyici" | "ciddi">("normal");
    const [imageStyle, setImageStyle] = useState<string>("Gerçekçi (Photorealistic)");
    const [customImageStyle, setCustomImageStyle] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [characterProfile, setCharacterProfile] = useState<any>(null);

    // Series Mode States
    const [seriesList, setSeriesList] = useState<any[]>([]);
    const [selectedSeriesId, setSelectedSeriesId] = useState<string>("none");
    const [newSeriesTitle, setNewSeriesTitle] = useState("");
    const [newSeriesContext, setNewSeriesContext] = useState("");
    const [isCreatingSeries, setIsCreatingSeries] = useState(false);

    useEffect(() => {
        fetch("/api/series").then(res => res.json()).then(data => {
            if (data.success && data.series) setSeriesList(data.series);
        }).catch(err => console.error("Series load error", err));
    }, []);

    const handleSplitStory = async () => {
        if (!fullStory) {
            alert("Lütfen önce bir hikaye yazın.");
            return;
        }
        setIsSplitting(true);
        try {
            const payload: any = { story: fullStory, language };
            if (selectedSeriesId !== "none") {
                const s = seriesList.find(x => x.id === selectedSeriesId);
                if (s) {
                    payload.seriesContext = s.globalContext;
                    payload.previousEpisodeSummary = s.previousEpisodeSummary;
                    payload.episodeNumber = s.currentEpisode;
                }
            }

            if (imageStyle) {
                payload.imageStyle = imageStyle === "Diğer (Özel)" ? "custom" : imageStyle;
                if (imageStyle === "Diğer (Özel)") {
                    payload.customImageStyle = customImageStyle;
                }
            }

            const res = await fetch("/api/split", {
                method: "POST",
                body: JSON.stringify(payload)
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
                if (data.characterProfile) {
                    setCharacterProfile(data.characterProfile);
                } else {
                    setCharacterProfile(null);
                }
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

    const [imageProgress, setImageProgress] = useState("");

    const handleGenerateImages = async () => {
        if (scenes.length === 0) return;
        setIsGeneratingImages(true);
        const newScenes = [...scenes];
        let successCount = 0;

        for (let i = 0; i < newScenes.length; i++) {
            const scene = newScenes[i];
            if (!scene.prompt) continue;

            setImageProgress(`Sahne ${i + 1}/${newScenes.length} üretiliyor... (AI Sunucusu)`);

            try {
                const res = await fetch("/api/generate-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: scene.prompt,
                        index: i,
                        characterProfile: characterProfile
                    })
                });

                const data = await res.json();

                if (data.success && data.url) {
                    const providerInfo = data.provider === 'pollinations' ? 'Pollinations' : 'AI Horde';
                    setImageProgress(`✅ Sahne ${i + 1} üretildi (${providerInfo})`);
                    newScenes[i] = {
                        ...scene,
                        imagePreview: data.url,
                        image: null
                    };
                    setScenes([...newScenes]);
                    successCount++;
                    // Short pause to show the checkmark
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    console.warn(`Sahne ${i + 1} üretilemedi:`, data.error);
                    setImageProgress(`⚠️ Sahne ${i + 1} atlandı: ${data.error}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (err: any) {
                console.error(`Sahne ${i + 1} hata:`, err);
                setImageProgress(`⚠️ Sahne ${i + 1} atlandı: Servise bağlanılamadı.`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        setImageProgress(successCount > 0 ? `✅ ${successCount} görsel başarıyla üretildi!` : "❌ Hiçbir görsel üretilemedi. Servisler şu an çok yoğun.");
        setIsGeneratingImages(false);

        setTimeout(() => setImageProgress(""), 5000);
    };

    const handleRegenerateImage = async (index: number) => {
        const scene = scenes[index];
        if (!scene.prompt) {
            alert("Bu sahne için resim metni (prompt) bulunmuyor. Önce hikayeyi sahneleri bölün.");
            return;
        }

        setImageProgress(`Sahne ${index + 1} yeniden üretiliyor...`);
        setIsGeneratingImages(true); // Reusing the same loading state block UI

        try {
            const res = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: scene.prompt,
                    index: index,
                    characterProfile: characterProfile,
                    seed: Math.floor(Math.random() * 10000000) // Force new seed for regeneration
                })
            });

            const data = await res.json();

            if (data.success && data.url) {
                const newScenes = [...scenes];
                newScenes[index] = {
                    ...scene,
                    imagePreview: data.url,
                    image: null
                };
                setScenes(newScenes);
                setImageProgress(`✅ Sahne ${index + 1} başarıyla yenilendi!`);
            } else {
                alert(`Hata: ${data.error}`);
                setImageProgress(`⚠️ Sahne ${index + 1} yenilenemedi.`);
            }
        } catch (err) {
            console.error(err);
            alert("Bağlantı hatası!");
            setImageProgress(`⚠️ Sahne ${index + 1} yenilenemedi.`);
        } finally {
            setIsGeneratingImages(false);
            setTimeout(() => setImageProgress(""), 4000);
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
        newScenes[index].videoFile = null;
        newScenes[index].videoPreview = undefined;
        setScenes(newScenes);
    };

    const handleVideoChange = (index: number, file: File | null) => {
        const newScenes = [...scenes];
        newScenes[index].videoFile = file;
        newScenes[index].image = null;
        newScenes[index].imagePreview = undefined;
        if (file) {
            newScenes[index].videoPreview = URL.createObjectURL(file);
        } else {
            newScenes[index].videoPreview = undefined;
        }
        setScenes(newScenes);
    };

    useEffect(() => {
        // Pre-fill form if jobId in URL for Editing Jobs
        const urlParams = new URLSearchParams(window.location.search);
        const editJobId = urlParams.get('jobId');
        if (editJobId) {
            fetch(`/api/jobs/${editJobId}/plan`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.plan) {
                        const p = data.plan;
                        setTitle(p.title || "Sükunet");
                        setMusicMood(p.musicMood || "cinematic");
                        if (p.voiceTone) setVoiceTone(p.voiceTone);
                        if (p.imageStyle) setImageStyle(p.imageStyle);
                        if (p.voiceGender) setVoiceGender(p.voiceGender);
                        if (p.characterProfile) setCharacterProfile(JSON.stringify(p.characterProfile, null, 2));

                        // Populate scenes with previous generated media
                        if (p.scenes && p.scenes.length > 0) {
                            const loadedScenes = p.scenes.map((s: any) => ({
                                text: s.text,
                                prompt: s.prompt,
                                duration: s.duration,
                                image: null,
                                videoFile: null,
                                imagePreview: s.image && s.image.endsWith('.png') ? `/api/jobs/${editJobId}/media/${s.image}` : undefined,
                                videoPreview: s.videoPath && s.videoPath.endsWith('.mp4') ? `/api/jobs/${editJobId}/media/${s.videoPath}` : undefined,
                            }));
                            setScenes(loadedScenes);
                        }
                    }
                })
                .catch(err => console.error("Edit Job Load Error", err));
        }
    }, []);

    const handleSubmit = async () => {
        if (scenes.some(s => (!s.image && !s.imagePreview && !s.videoFile && !s.videoPreview) || !s.text)) {
            alert("Lütfen tüm sahnelerin metinlerini ve görsellerini/videolarını doldurun.");
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
                imageUrl: s.videoPreview && !s.videoFile ? s.videoPreview : (s.imagePreview && !s.image ? s.imagePreview : undefined)
            }));
            formData.append("scenes", JSON.stringify(scenesMeta));

            // Append images and videos
            scenes.forEach((s, i) => {
                if (s.videoFile) {
                    formData.append(`video_${i}`, s.videoFile);
                } else if (s.image) {
                    formData.append(`image_${i}`, s.image);
                }
            });

            if (bgMusic) {
                formData.append("bgMusic", bgMusic);
            }
            formData.append("musicMood", musicMood);
            formData.append("voiceGender", voiceGender);
            formData.append("voiceTone", voiceTone);
            formData.append("imageStyle", imageStyle === "Diğer (Özel)" ? customImageStyle : imageStyle);

            if (characterProfile) {
                formData.append("characterProfile", JSON.stringify(characterProfile));
            }

            if (selectedSeriesId !== "none") {
                const s = seriesList.find(x => x.id === selectedSeriesId);
                if (s) {
                    formData.append("seriesId", s.id);
                    formData.append("episodeNumber", s.currentEpisode.toString());
                }
            }

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

                        <div className="bg-purple-900/20 p-4 border border-purple-500/30 rounded-2xl">
                            <label className="block text-xs font-bold uppercase tracking-widest text-purple-300 mb-2">🎬 Seri/Dizi Modu (Episodic Mode)</label>

                            {!isCreatingSeries ? (
                                <div className="space-y-3">
                                    <select
                                        value={selectedSeriesId}
                                        onChange={(e) => setSelectedSeriesId(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-purple-500/30 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                    >
                                        <option value="none">-- Tekil Video Çalışması (Seri Yok) --</option>
                                        {seriesList.map(s => (
                                            <option key={s.id} value={s.id}>{s.title} (Sıradaki: Bölüm {s.currentEpisode})</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setIsCreatingSeries(true)}
                                        className="text-xs text-purple-400 font-bold hover:text-purple-300 underline"
                                    >
                                        + Yeni Dizi Evreni Yarat
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Dizi Adı (Örn: Gece Vardiyası)"
                                        value={newSeriesTitle}
                                        onChange={(e) => setNewSeriesTitle(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-purple-500/50"
                                    />
                                    <textarea
                                        placeholder="Evrenin Bağlamı (Örn: Tüm hikayeler lanetli bir oteldeki gece vardiyasında geçer. Karanlık ve gerilimli bir tondur...)"
                                        value={newSeriesContext}
                                        onChange={(e) => setNewSeriesContext(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 h-20 text-sm resize-none focus:outline-none focus:border-purple-500/50"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!newSeriesTitle || !newSeriesContext) return alert("Başlık ve Evren Bağlamı zorunludur.");
                                                const res = await fetch("/api/series", {
                                                    method: "POST", body: JSON.stringify({ title: newSeriesTitle, globalContext: newSeriesContext })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    setSeriesList([...seriesList, data.series]);
                                                    setSelectedSeriesId(data.series.id);
                                                    setIsCreatingSeries(false);
                                                }
                                            }}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold transition-all text-white"
                                        >
                                            Evreni Kaydet
                                        </button>
                                        <button
                                            onClick={() => setIsCreatingSeries(false)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-white transition-all"
                                        >
                                            İptal
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedSeriesId !== "none" && !isCreatingSeries && (
                                <div className="mt-3 p-3 bg-purple-950/50 rounded-lg text-xs text-purple-300/90 border border-purple-500/20 leading-relaxed">
                                    <span className="text-lg mr-1 tracking-tighter">🧠</span> <b>Kalıcı Bellek Devrede:</b> Yapay zeka önceki bölümlerdeki olayları ({seriesList.find(s => s.id === selectedSeriesId)?.previousEpisodeSummary.substring(0, 30) || 'Hiç video üretilmedi'}...) hatırlayacak ve hikayeyi organik olarak devam ettirecektir.
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <div className="space-y-1 w-full md:w-auto">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-blue-400">Seslendirme (Dil & Ton)</label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                            <button onClick={() => setVoiceGender("female")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${voiceGender === "female" ? "bg-pink-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>KADIN</button>
                                            <button onClick={() => setVoiceGender("male")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${voiceGender === "male" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>ERKEK</button>
                                        </div>
                                        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                            <button onClick={() => setLanguage("tr")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${language === "tr" ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>TR</button>
                                            <button onClick={() => setLanguage("en")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>EN</button>
                                        </div>
                                        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                            <select
                                                value={voiceTone}
                                                onChange={(e) => setVoiceTone(e.target.value as any)}
                                                className="bg-transparent text-[10px] font-bold text-slate-300 outline-none cursor-pointer px-1 w-32"
                                            >
                                                <option value="normal">Normal Ton</option>
                                                <option value="surukleyici">Sürükleyici</option>
                                                <option value="korku">Korku / Gerilim</option>
                                                <option value="eglenceli">Eğlenceli</option>
                                                <option value="ciddi">Ciddi / Belgesel</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1 w-full md:w-auto flex-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-purple-400">Görsel Stili</label>
                                    <div className="flex flex-col gap-2">
                                        <select
                                            value={imageStyle}
                                            onChange={(e) => setImageStyle(e.target.value)}
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-2 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-purple-500/50 cursor-pointer"
                                        >
                                            <option value="Gerçekçi (Photorealistic)">Gerçekçi (Photorealistic)</option>
                                            <option value="Çizgi Film (Cartoon)">Çizgi Film (Cartoon)</option>
                                            <option value="Anime (Japon Tarzı)">Anime (Japon Tarzı)</option>
                                            <option value="Karanlık Fantezi (Dark Fantasy)">Karanlık Fantezi (Dark Fantasy)</option>
                                            <option value="3D Animasyon (Pixar Style)">3D Animasyon (Pixar Style)</option>
                                            <option value="Diğer (Özel)">Diğer (Özel Format)</option>
                                        </select>
                                        {imageStyle === "Diğer (Özel)" && (
                                            <input
                                                type="text"
                                                placeholder="İstediğiniz stili İngilizce yazın. Örn: cyberpunk coloring book style"
                                                value={customImageStyle}
                                                onChange={(e) => setCustomImageStyle(e.target.value)}
                                                className="w-full bg-slate-950/50 border border-purple-500/50 rounded-xl p-2 text-xs outline-none"
                                            />
                                        )}
                                    </div>
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

                            {characterProfile && (
                                <div className="mt-4 p-4 border border-blue-500/30 bg-blue-500/10 rounded-2xl">
                                    <div className="text-xs font-bold text-blue-400 mb-1">🎭 {characterProfile.name || "Ana Karakter Algılandı"}</div>
                                    <div className="text-sm text-slate-300 italic">{characterProfile.appearance}</div>
                                    <div className="text-[10px] text-blue-500/70 mt-2 font-mono">Tüm sahnelerde stil kilitlendi (Seed: {characterProfile.baseSeed})</div>
                                </div>
                            )}

                            {imageProgress && (
                                <div className="mt-3 px-4 py-3 bg-slate-950/70 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        {isGeneratingImages && (
                                            <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                                        )}
                                        <span className="text-sm text-slate-300">{imageProgress}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-pink-400">Arkaplan Müziği Seç (Opsiyonel)</label>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 bg-slate-950/50 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-pink-500/30 transition-all cursor-pointer relative">
                                <span className={`text-sm ${bgMusic ? 'text-pink-300 font-bold' : 'text-slate-500'}`}>
                                    {bgMusic ? `🎵 ${bgMusic.name}` : "🎧 Sahnene uygun telifsiz bir MP3 seç..."}
                                </span>
                                <input
                                    type="file"
                                    accept="audio/mpeg,audio/mp3"
                                    onChange={(e) => setBgMusic(e.target.files?.[0] || null)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                {bgMusic && (
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBgMusic(null); }}
                                        className="relative z-10 text-slate-500 hover:text-red-400 p-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500">Müzik yüklenirse ses düzeyi otomatik %12'ye kısılarak seslendirmeye eşlik edecek şekilde karıştırılacaktır.</p>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-pink-300 mb-3">Müziğin Duygusu</label>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { key: 'cinematic', label: '🎬 Sinematik', color: 'purple' },
                                    { key: 'sad', label: '😢 Hüzünlü', color: 'blue' },
                                    { key: 'happy', label: '😄 Mutlu', color: 'yellow' },
                                    { key: 'energetic', label: '⚡ Enerjik', color: 'orange' },
                                    { key: 'suspense', label: '😨 Gerilim', color: 'red' },
                                    { key: 'horror', label: '🦇 Korku', color: 'rose' },
                                ] as const).map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setMusicMood(key)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${musicMood === key
                                            ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-500/20'
                                            : 'bg-slate-950/50 border-white/10 text-slate-400 hover:border-pink-500/40 hover:text-pink-300'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">Müzik yüklenmezse seçilen duyguya uygun bir parça otomatik indirilecektir.</p>
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
                                        <div className="flex gap-2 mb-2">
                                            <label className="flex-1 text-center py-2 bg-slate-950/50 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-900 transition-all text-xs font-bold text-slate-400 hover:text-white">
                                                🖼️ Görsel
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleImageChange(index, e.target.files?.[0] || null)}
                                                    className="hidden"
                                                />
                                            </label>
                                            <label className="flex-1 text-center py-2 bg-slate-950/50 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-900 transition-all text-xs font-bold text-slate-400 hover:text-white">
                                                🎥 Video
                                                <input
                                                    type="file"
                                                    accept="video/mp4,video/webm"
                                                    onChange={(e) => handleVideoChange(index, e.target.files?.[0] || null)}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                        <div className="aspect-video bg-slate-950/50 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative group-hover:border-purple-500/30 transition-all">
                                            {scene.videoPreview ? (
                                                <video
                                                    src={scene.videoPreview}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    autoPlay
                                                    muted
                                                    loop
                                                />
                                            ) : scene.imagePreview || scene.image ? (
                                                <img
                                                    src={scene.imagePreview || (scene.image ? URL.createObjectURL(scene.image) : "")}
                                                    className="w-full h-full object-cover"
                                                    alt="Preview"
                                                />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <div className="text-2xl mb-1">⬇️</div>
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Medya Yükle veya Üret</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-[10px] text-slate-500 font-medium">Önerilen: 1080x1920 PNG</div>
                                            {(scene.imagePreview || scene.prompt) && (
                                                <button
                                                    onClick={() => handleRegenerateImage(index)}
                                                    disabled={isGeneratingImages}
                                                    title="Yapay zekadan bu sahne için yeni bir alternatif üretmesini isteyin"
                                                    className="p-1.5 bg-slate-800 hover:bg-purple-600/80 disabled:opacity-50 text-white rounded-lg transition-all text-xs flex items-center gap-1 group/btn"
                                                >
                                                    <span className="group-hover/btn:animate-spin">🔄</span> Yenile
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                                            <span className="text-lg">💡</span>
                                            <div>
                                                <b>Pro İpucu:</b> Daha hızlı ve kaliteli görseller için <code>.env.local</code> dosyasına kendi API anahtarlarınızı ekleyebilirsiniz.
                                                (Gemini & Pollinations)
                                            </div>
                                        </div>
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
        </div >
    );
}
