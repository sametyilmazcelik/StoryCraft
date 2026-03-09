"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Job {
    id: string;
    title: string;
    status: "processing" | "completed" | "error";
    startedAt?: string;
    error?: string;
}

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

    const fetchJobs = async () => {
        try {
            const res = await fetch("/api/jobs");
            const data = await res.json();
            setJobs(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, []);

    const handleRetry = async (jobId: string) => {
        if (!confirm("Videonun render işlemini baştan başlatmak istediğinize emin misiniz? (Görseller ve senaryo aynı kalır, sadece kurgu tekrar hesaplanır.)")) return;

        try {
            const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                fetchJobs();
            } else {
                alert("Hata: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Bağlantı hatası");
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-8">
            <div className="max-w-4xl mx-auto space-y-12">
                <header className="flex justify-between items-center">
                    <h1 className="text-4xl font-black text-white italic">
                        Story<span className="text-purple-500">Jobs</span>
                    </h1>
                    <Link href="/create" className="px-6 py-2 bg-purple-600 rounded-full font-bold hover:bg-purple-700 transition-all">
                        + Yeni Oluştur
                    </Link>
                </header>

                <div className="grid gap-4">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className={`group relative bg-slate-900/50 border ${job.status === "completed"
                                ? "border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                                : "border-white/5"
                                } p-6 rounded-3xl flex items-center justify-between hover:border-white/20 transition-all overflow-hidden`}
                        >
                            {/* Success background glow */}
                            {job.status === "completed" && (
                                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent pointer-events-none" />
                            )}

                            <div className="space-y-2 relative z-10">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold">{job.title || "Adsız Hikaye"}</h3>
                                    {job.status === "completed" && (
                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-wider rounded-md border border-green-500/30">
                                            Tamamlandı
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <span className="opacity-50">#</span>
                                        <span>{job.id.replace("job_", "")}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-600">📅</span>
                                        <span>
                                            {job.startedAt
                                                ? new Date(job.startedAt).toLocaleString("tr-TR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })
                                                : "---"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 relative z-10">
                                {job.status === "processing" && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 font-bold text-sm rounded-full border border-purple-500/20">
                                            <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            Hazırlanıyor...
                                        </div>
                                        <button
                                            onClick={() => handleRetry(job.id)}
                                            className="w-10 h-10 bg-slate-800 text-slate-400 border border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all text-xs"
                                            title="İşlem takıldıysa tekrar dene"
                                        >
                                            🔄
                                        </button>
                                    </div>
                                )}

                                {(job.status === "completed" || job.status === "error") && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleRetry(job.id)}
                                            className="w-10 h-10 bg-slate-800 text-slate-300 border border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all"
                                            title="Yeniden Oluştur (Render)"
                                        >
                                            🔄
                                        </button>
                                        <a
                                            href={`/create?jobId=${job.id}`}
                                            className="w-10 h-10 bg-blue-900/30 text-blue-400 border border-blue-800/30 rounded-full flex items-center justify-center hover:bg-blue-800/50 hover:text-white transition-all"
                                            title="Senaryoyu Düzenle"
                                        >
                                            ✏️
                                        </a>
                                    </div>
                                )}

                                {job.status === "completed" && (
                                    <button
                                        onClick={() => setSelectedVideo(job.id)}
                                        className="px-6 py-2 bg-green-600 text-white rounded-full font-bold hover:bg-green-500 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse-subtle flex items-center gap-2"
                                    >
                                        İzle ▶
                                    </button>
                                )}

                                {job.status === "error" && (
                                    <div className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-sm font-bold flex items-center gap-2">
                                        ⚠️ Hata!
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {jobs.length === 0 && (
                        <div className="text-center py-20 text-slate-500 italic">
                            Henüz bir video kaydı bulunamadı.
                        </div>
                    )}
                </div>
            </div>

            {/* Video Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <button
                            onClick={() => setSelectedVideo(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10 text-white font-bold"
                        >
                            ✕
                        </button>
                        <video
                            src={`/api/video/${selectedVideo}`}
                            controls
                            autoPlay
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
