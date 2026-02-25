import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const DEFAULT_ORG_SLUG = "default-organization";
const DEFAULT_ORG_NAME = "Independent";

async function main() {
  console.log("Starting org backfill...");

  // 1) Ensure the fallback organization exists and is consistently named.
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG_SLUG },
    update: {
      name: DEFAULT_ORG_NAME,
      isActive: true,
    },
    create: {
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      isActive: true,
    },
  });
  console.log("Fallback org:", defaultOrg.id, `(${DEFAULT_ORG_NAME})`);

  // 2) Assign org to non-super-admin users that don't have one yet.
  // Keep super_admin users org-null so they can operate globally.
  const usersUpdated = await prisma.user.updateMany({
    where: {
      organizationId: null,
      NOT: { role: "super_admin" },
    },
    data: { organizationId: defaultOrg.id },
  });
  console.log("Users assigned to fallback org:", usersUpdated.count);

  // 3) Normalize content scope defaults:
  // Existing areas become global if scope wasn't set yet.
  const areasScopeUpdated = await prisma.area.updateMany({
    where: { scopeType: { not: "global" } },
    data: { scopeType: "global" },
  });
  console.log("Areas normalized to global scope:", areasScopeUpdated.count);

  // 4) Ensure section.organizationId mirrors area.organizationId where available.
  // Global areas keep section.organizationId null.
  const allSections = await prisma.section.findMany({
    select: {
      id: true,
      organizationId: true,
      area: { select: { organizationId: true } },
    },
  });

  let sectionOrgUpdates = 0;
  for (const section of allSections) {
    const targetOrgId = section.area.organizationId ?? null;
    if (section.organizationId !== targetOrgId) {
      await prisma.section.update({
        where: { id: section.id },
        data: { organizationId: targetOrgId },
      });
      sectionOrgUpdates++;
    }
  }
  console.log("Sections org synced from areas:", sectionOrgUpdates);

  // 5) Seed default org display configs for all existing areas/sections.
  const areas = await prisma.area.findMany({
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  const sections = await prisma.section.findMany({
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  await prisma.organizationAreaConfig.createMany({
    data: areas.map((a) => ({
      organizationId: defaultOrg.id,
      areaId: a.id,
      isVisible: true,
      sortOrder: a.sortOrder,
    })),
    skipDuplicates: true,
  });

  await prisma.organizationSectionConfig.createMany({
    data: sections.map((s) => ({
      organizationId: defaultOrg.id,
      sectionId: s.id,
      isVisible: true,
      sortOrder: s.sortOrder,
    })),
    skipDuplicates: true,
  });

  console.log("Created missing default-org area/section configs.");
  console.log("Org backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
