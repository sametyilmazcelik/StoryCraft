"use client";

import { useState } from "react";

interface SceneInput {
    text: string;
    image: File | null;
}

export default function CreatePage() {
    const [title, setTitle] = useState("Yeni Hikaye");
    const [scenes, setScenes] = useState<SceneInput[]>([{ text: "", image: null }]);
    const [loading, setLoading] = useState(false);

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
        setLoading(true);
        // In a real local MVP, we would send this to an API route
        // that saves files to storage/jobs/
        console.log("Generating video for:", { title, scenes });

        // Simulating API call
        setTimeout(() => {
            alert("Job oluşturuldu! Worker'ı terminalden başlatabilirsiniz: npm run worker -w worker job1");
            setLoading(false);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    StoryCraft: Video Oluştur
                </h1>

                <div className="space-y-4 bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div>
                        <label className="block text-sm font-medium mb-1">Başlık</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    {scenes.map((scene, index) => (
                        <div key={index} className="p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
                            <h3 className="font-semibold text-purple-400">Sahne {index + 1}</h3>
                            <textarea
                                placeholder="Sahne metni..."
                                value={scene.text}
                                onChange={(e) => handleTextChange(index, e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 h-20 outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(index, e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                            />
                        </div>
                    ))}

                    <button
                        onClick={addScene}
                        className="w-full py-2 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-purple-500 hover:text-purple-400 transition-colors"
                    >
                        + Sahne Ekle
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {loading ? "Hazırlanıyor..." : "Videoyu Üret"}
                </button>
            </div>
        </div>
    );
}
