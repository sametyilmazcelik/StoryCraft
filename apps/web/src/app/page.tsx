import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-24 text-white">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-extrabold tracking-tighter">
          Story<span className="text-purple-500">Craft</span>
        </h1>
        <p className="text-slate-400 text-xl max-w-md mx-auto">
          Yerel çalışan, 0 TL maliyetli hikayeden video üretme sistemi.
        </p>
        <div className="pt-8 flex gap-4">
          <Link
            href="/create"
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-full font-bold text-lg transition-all transform hover:scale-105"
          >
            Hemen Başla
          </Link>
          <Link
            href="/jobs"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-full font-bold text-lg transition-all border border-slate-700"
          >
            Videolarım
          </Link>
        </div>
      </div>
    </main>
  );
}
