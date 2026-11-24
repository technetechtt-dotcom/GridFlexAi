import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/prisma.js";

const email = process.env.RESTORE_SMOKE_EMAIL ?? "admin@gridflex.ai";
const password = process.env.RESTORE_SMOKE_PASSWORD;

const main = async () => {
  if (!password) {
    throw new Error("RESTORE_SMOKE_PASSWORD is required");
  }

  const prisma = createPrismaClient();
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { email },
      data: { password: hash },
      select: { email: true, role: true }
    });
    process.stdout.write(`${JSON.stringify({ updated: user.email, role: user.role })}\n`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
