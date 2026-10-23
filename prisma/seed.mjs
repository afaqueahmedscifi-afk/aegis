import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const branches = [
    { code: "DEMO-341", name: "Demo Branch 341", city: "Demo City" },
    { code: "DEMO-256", name: "Demo Branch 256", city: "Demo City" },
    { code: "DEMO-1344", name: "Demo Branch 1344", city: "Demo City" },
  ];

  const branchIds = {};

  for (const branch of branches) {
    const saved = await prisma.branch.upsert({
      where: { code: branch.code },
      update: {
        name: branch.name,
        city: branch.city,
        isActive: true,
      },
      create: branch,
    });

    branchIds[branch.code] = saved.id;
  }

  const incidents = [
    {
      reference: "AEG-1001",
      title: "Day-close reconciliation mismatch",
      description: "Fictional demo record: expected 15 records, report shows 10.",
      category: "Finance / POS",
      severity: "High",
      status: "Open",
      owner: "Demo Operations",
      evidence: "10 records reported versus 15 expected",
      notes: "DEMO DATA ONLY. Verify reconciliation workflow.",
      branchCode: "DEMO-341",
    },
    {
      reference: "AEG-1002",
      title: "Zero-value delivery order",
      description: "Fictional demo record for order integration monitoring.",
      category: "Orders / Integration",
      severity: "Critical",
      status: "Investigating",
      owner: "Demo Support",
      evidence: "Sample zero-value order detected",
      notes: "DEMO DATA ONLY. Inspect the simulated order flow.",
      branchCode: "DEMO-256",
    },
    {
      reference: "AEG-1003",
      title: "Inventory variance above threshold",
      description: "Fictional demo record for inventory controls.",
      category: "Inventory",
      severity: "Medium",
      status: "Open",
      owner: "Demo Inventory",
      evidence: "Sample variance requires review",
      notes: "DEMO DATA ONLY. Review the simulated inventory balance.",
      branchCode: "DEMO-1344",
    },
  ];

  for (const incident of incidents) {
    const { branchCode, ...data } = incident;

    await prisma.incident.upsert({
      where: { reference: data.reference },
      update: {
        ...data,
        branchId: branchIds[branchCode],
      },
      create: {
        ...data,
        branchId: branchIds[branchCode],
      },
    });
  }

  console.log("AEGIS demo seed completed.");
  console.log(`Demo branches processed: ${branches.length}`);
  console.log(`Demo incidents processed: ${incidents.length}`);
}

main()
  .catch((error) => {
    console.error("AEGIS demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
