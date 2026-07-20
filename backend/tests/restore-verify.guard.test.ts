import { PrismaClient } from "@prisma/client";

/**
 * Unit-level guard for restore:verify script behaviour (allow flag).
 * Full DB checks run only when RESTORE_VERIFY_ALLOW=true against an isolated URL.
 */
describe("restore verify guard", () => {
  it("documents required env gate", () => {
    expect(process.env.RESTORE_VERIFY_ALLOW === "true").toBe(false);
  });

  it("Prisma client exposes tables used by restore smoke", () => {
    const prisma = new PrismaClient();
    expect(typeof prisma.organisation.count).toBe("function");
    expect(typeof prisma.user.count).toBe("function");
    expect(typeof prisma.edgeNode.count).toBe("function");
    expect(typeof prisma.sensorReading.count).toBe("function");
    expect(typeof prisma.telemetryReading.count).toBe("function");
  });
});
