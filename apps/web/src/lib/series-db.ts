import fs from 'fs';
import path from 'path';
import { SeriesUniverse, CharacterProfile } from '@storycraft/core';

const dbDir = path.join(process.cwd(), '..', '..', 'storage', 'db');
const seriesDbFile = path.join(dbDir, 'series.json');

function ensureDb() {
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (!fs.existsSync(seriesDbFile)) fs.writeFileSync(seriesDbFile, JSON.stringify([]));
}

export function getAllSeries(): SeriesUniverse[] {
    ensureDb();
    const data = fs.readFileSync(seriesDbFile, 'utf8');
    return JSON.parse(data);
}

export function getSeriesById(id: string): SeriesUniverse | null {
    const all = getAllSeries();
    return all.find(s => s.id === id) || null;
}

export function saveSeries(series: SeriesUniverse) {
    const all = getAllSeries();
    const idx = all.findIndex(s => s.id === series.id);
    if (idx >= 0) {
        all[idx] = series;
    } else {
        all.push(series);
    }
    fs.writeFileSync(seriesDbFile, JSON.stringify(all, null, 2));
}

export function incrementSeriesEpisode(id: string, newSummary: string, charProfile?: CharacterProfile) {
    const series = getSeriesById(id);
    if (!series) throw new Error("Series not found");
    series.currentEpisode += 1;
    series.previousEpisodeSummary = newSummary;
    if (charProfile) series.characterProfile = charProfile;
    saveSeries(series);
}
