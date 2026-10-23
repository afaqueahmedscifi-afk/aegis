import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  correlateIncidents,
  generateHypotheses,
  type InvestigationRecord,
} from "@/lib/investigation-engine";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference")?.trim();

    if (!reference || reference.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide a valid incident reference.",
        },
        { status: 400 },
      );
    }
    try {
    const records = await prisma.incident.findMany({
      include: {
        branch: {
          select: {
            code: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const target = records.find(
      (incident) => incident.reference === reference,
    );

    if (!target) {
      return NextResponse.json(
        {
          success: false,
          error: "Incident not found in the available investigation records.",
        },
        { status: 404 },
      );
    }

    const candidates: InvestigationRecord[] = records.map(
      (incident) => ({
        id: incident.id,
        reference: incident.reference,
        title: incident.title,
        description: incident.description,
        category: incident.category,
        severity: incident.severity,
        status: incident.status,
        evidence: incident.evidence,
        notes: incident.notes,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        branch: incident.branch,
      }),
    );

    const analyzedTarget = candidates.find(
      (incident) => incident.id === target.id,
    );

    if (!analyzedTarget) {
      throw new Error("The selected incident could not be prepared for analysis.");
    }

    const relatedIncidents = correlateIncidents(
      analyzedTarget,
      candidates,
    );

    const hypotheses = generateHypotheses(
      analyzedTarget,
      relatedIncidents,
    );

    return NextResponse.json({
      success: true,
      report: {
        engine: "AEGIS Deterministic Correlation Engine",
        engineVersion: "0.1.0",
        analyzedAt: new Date().toISOString(),
        target: {
          reference: analyzedTarget.reference,
          title: analyzedTarget.title,
          branch: analyzedTarget.branch.name,
          category: analyzedTarget.category,
          severity: analyzedTarget.severity,
          status: analyzedTarget.status,
        },
        relatedIncidents,
        hypotheses,
        evidenceSummary: {
          candidateCount: Math.max(candidates.length - 1, 0),
          relatedCount: relatedIncidents.length,
          method: [
            "Branch match",
            "Category match",
            "Shared descriptive terms",
            "Creation-time proximity",
            "Severity match",
          ],
          warning:
            "Correlation scores are rule-based ranking scores, not probabilities or proof of causation.",
        },
      },
    });
  } catch (error) {
    console.error("AEGIS investigation analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to analyze the selected investigation.",
      },
      { status: 500 },
    );
  }
}
