import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("FlowForge ERP API could not connect to MySQL. Check DATABASE_URL in backend/.env.");
    console.error(error?.message || error);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`FlowForge ERP API running on http://localhost:${env.port}/api`);
  });
}

start();
