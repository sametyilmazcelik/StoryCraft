import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "URL parametresi gerekli" }, { status: 400 });
    }

    try {
        let response;
        let retries = 5; // Increase retries

        while (retries > 0) {
            try {
                // Cloudflare 530 often happens on direct rapid hits. Adding random delay and better headers.
                const headers: any = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Referer": "https://pollinations.ai/"
                };

                response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

                if (response.ok) break;

                console.warn(`Attempt failed with status ${response.status}. Retrying...`);
            } catch (e) {
                console.warn(`Retry ${6 - retries} error:`, e);
            }
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }

        if (!response || !response.ok) {
            // Fallback: If Pollinations is totally down, return a placeholder or 503
            return NextResponse.json({ error: "Görsel servisi şu an meşgul. Lütfen birazdan tekrar deneyin." }, { status: 503 });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "image/png";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (error: any) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
