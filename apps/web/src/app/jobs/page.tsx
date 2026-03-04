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
                        <div key={job.id} className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl flex items-center justify-between hover:border-white/10 transition-all">
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">{job.title}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span>ID: {job.id}</span>
                                    <span>•</span>
                                    <span>{job.startedAt ? new Date(job.startedAt).toLocaleString('tr-TR') : ""}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {job.status === "processing" && (
                                    <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                                        <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                        Hazırlanıyor
                                    </div>
                                )}
                                {job.status === "completed" && (
                                    <button
                                        onClick={() => setSelectedVideo(job.id)}
                                        className="px-6 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-full font-bold hover:bg-green-600 hover:text-white transition-all"
                                    >
                                        İzle ▶
                                    </button>
                                )}
                                {job.status === "error" && (
                                    <div className="text-red-400 text-sm font-bold">Hata!</div>
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
