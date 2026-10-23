import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const incidents = await prisma.incident.findMany({
      include: {
        branch: {
          select: {
            code: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error("AEGIS investigations API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load investigations.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { success: false, error: "Invalid incident data." },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const title =
      typeof input.title === "string" ? input.title.trim() : "";
    const branchName =
      typeof input.branch === "string" ? input.branch.trim() : "";
    const category =
      typeof input.category === "string" ? input.category.trim() : "";
    const severity =
      typeof input.severity === "string" ? input.severity : "Medium";
    const owner =
      typeof input.owner === "string" ? input.owner.trim() : "";
    const evidence =
      typeof input.evidence === "string" ? input.evidence.trim() : "";
    const notes =
      typeof input.notes === "string" ? input.notes.trim() : "";

    if (
      !title ||
      title.length > 120 ||
      !branchName ||
      branchName.length > 100 ||
      !category ||
      category.length > 100
    ) {
      return Response.json(
        { success: false, error: "Valid title, branch, and category are required." },
        { status: 400 },
      );
    }

    if (!["Critical", "High", "Medium", "Low"].includes(severity)) {
      return Response.json(
        { success: false, error: "Invalid severity." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let branch = await tx.branch.findFirst({
        where: {
          name: { equals: branchName, mode: "insensitive" },
        },
      });

      if (!branch) {
        branch = await tx.branch.create({
          data: {
            code: `CUSTOM-${crypto.randomUUID()}`,
            name: branchName,
          },
        });
      }

      const reference = `AEG-${crypto.randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase()}`;

      const incident = await tx.incident.create({
        data: {
          reference,
          title,
          category,
          severity,
          status: "Open",
          owner: owner || "Unassigned",
          evidence: evidence || "No evidence recorded yet.",
          notes: notes || "Investigation not started.",
          branchId: branch.id,
        },
        include: {
          branch: {
            select: { code: true, name: true, city: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "INCIDENT_CREATED",
          entityType: "Incident",
          entityId: incident.id,
          details: {
            reference: incident.reference,
            branch: branch.name,
          },
        },
      });

      return incident;
    });

    return Response.json(
      { success: true, incident: result },
      { status: 201 },
    );
  } catch (error) {
    console.error("AEGIS incident creation error:", error);

    return Response.json(
      { success: false, error: "Unable to create the incident." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { success: false, error: "Invalid incident update." },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const reference =
      typeof input.reference === "string" ? input.reference.trim() : "";

    if (!reference || reference.length > 50) {
      return Response.json(
        { success: false, error: "A valid incident reference is required." },
        { status: 400 },
      );
    }

    const allowedFields = ["status", "owner", "evidence", "notes"] as const;
    const data: {
      status?: string;
      owner?: string;
      evidence?: string;
      notes?: string;
      resolvedAt?: Date | null;
    } = {};

    if (Object.keys(input).some(
      (key) => key !== "reference" && !allowedFields.includes(
        key as (typeof allowedFields)[number],
      ),
    )) {
      return Response.json(
        { success: false, error: "Unsupported incident field." },
        { status: 400 },
      );
    }

    if (Object.keys(input).every((key) => key === "reference")) {
      return Response.json(
        { success: false, error: "No fields supplied to update." },
        { status: 400 },
      );
    }

    if ("status" in input) {
      if (
        typeof input.status !== "string" ||
        !["Open", "Investigating", "Resolved"].includes(input.status)
      ) {
        return Response.json(
          { success: false, error: "Invalid workflow status." },
          { status: 400 },
        );
      }

      data.status = input.status;
      data.resolvedAt =
        input.status === "Resolved" ? new Date() : null;
    }

    if ("owner" in input) {
      if (typeof input.owner !== "string" || input.owner.length > 120) {
        return Response.json(
          { success: false, error: "Owner must be 120 characters or fewer." },
          { status: 400 },
        );
      }
      data.owner = input.owner.trim() || "Unassigned";
    }

    if ("evidence" in input) {
      if (typeof input.evidence !== "string" || input.evidence.length > 3000) {
        return Response.json(
          { success: false, error: "Evidence must be 3000 characters or fewer." },
          { status: 400 },
        );
      }
      data.evidence = input.evidence;
    }

    if ("notes" in input) {
      if (typeof input.notes !== "string" || input.notes.length > 5000) {
        return Response.json(
          { success: false, error: "Notes must be 5000 characters or fewer." },
          { status: 400 },
        );
      }
      data.notes = input.notes;
    }

    const existing = await prisma.incident.findUnique({
      where: { reference },
      select: { id: true, reference: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: "Incident not found." },
        { status: 404 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: { reference },
        data,
        include: {
          branch: {
            select: { code: true, name: true, city: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "INCIDENT_UPDATED",
          entityType: "Incident",
          entityId: incident.id,
          details: {
            reference: incident.reference,
            changedFields: Object.keys(data).filter(
              (key) => key !== "resolvedAt",
            ),
          },
        },
      });

      return incident;
    });

    return Response.json({ success: true, incident: updated });
  } catch (error) {
    console.error("AEGIS incident update error:", error);

    return Response.json(
      { success: false, error: "Unable to update the incident." },
      { status: 500 },
    );
  }
}
