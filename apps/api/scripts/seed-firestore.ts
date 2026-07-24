import { prisma } from "../src/fsdb.js";
import { seedDemo } from "../src/seed-demo.js";

seedDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
