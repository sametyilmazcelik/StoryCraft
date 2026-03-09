import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: jobId } = await params;
        const jobDir = path.join(process.cwd(), "..", "..", "storage", "jobs", jobId);
        const planPath = path.join(jobDir, "plan.json");

        if (!fs.existsSync(planPath)) {
            return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });
        }

        const planData = JSON.parse(fs.readFileSync(planPath, "utf-8"));

        return NextResponse.json({ success: true, plan: planData });
    } catch (error: any) {
        console.error("Fetch plan error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
