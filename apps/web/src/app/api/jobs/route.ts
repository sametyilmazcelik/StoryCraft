import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const jobsDir = path.join(process.cwd(), "..", "..", "storage", "jobs");
        if (!fs.existsSync(jobsDir)) return NextResponse.json([]);

        const folders = fs.readdirSync(jobsDir);
        const jobs = folders
            .filter(folder => fs.statSync(path.join(jobsDir, folder)).isDirectory())
            .map(folder => {
                const statusPath = path.join(jobsDir, folder, "status.json");
                const planPath = path.join(jobsDir, folder, "plan.json");

                let status = { status: "unknown" };
                let plan = { title: "Adsız" };

                if (fs.existsSync(statusPath)) {
                    status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
                }
                if (fs.existsSync(planPath)) {
                    plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
                }

                return {
                    id: folder,
                    title: plan.title,
                    ...status
                };
            });

        // Sort by Date (newest first)
        jobs.sort((a: any, b: any) => {
            const dateA = a.startedAt || "";
            const dateB = b.startedAt || "";
            return dateB.localeCompare(dateA);
        });

        return NextResponse.json(jobs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
