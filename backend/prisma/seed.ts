import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo session
  // Note: NodeId would typically come from a real node registration
  const demoNodeId = "demo-node-1";
  await prisma.node.upsert({
    where: { id: demoNodeId },
    update: {},
    create: {
      id: demoNodeId,
      hostname: "localhost",
      port: 5000,
      status: "active",
    },
  });

  await prisma.session.create({
    data: {
      clientId: "demo-client-alice",
      nodeId: demoNodeId,
      socketId: "demo-socket-123",
      active: true,
      metadata: {
        userAgent: "Seed Script",
      },
    },
  });

  console.log("Created demo session");
  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
