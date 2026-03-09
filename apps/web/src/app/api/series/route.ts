import { NextRequest, NextResponse } from "next/server";
import { getAllSeries, saveSeries } from "../../../lib/series-db";
import { SeriesUniverse } from "@storycraft/core";

export async function GET() {
    try {
        const series = getAllSeries();
        return NextResponse.json({ success: true, series });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const data: Partial<SeriesUniverse> = await req.json();

        if (!data.title || !data.globalContext) {
            return NextResponse.json({ error: "Eksik parametreler" }, { status: 400 });
        }

        const newSeries: SeriesUniverse = {
            id: `sr_${Date.now()}`,
            title: data.title,
            currentEpisode: 1,
            globalContext: data.globalContext,
            previousEpisodeSummary: ""
        };

        saveSeries(newSeries);
        return NextResponse.json({ success: true, series: newSeries });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
