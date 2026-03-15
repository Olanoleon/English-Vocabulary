import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { getUnitImageByTitle } from "../src/lib/unit-image";

type Scope = "areas" | "sections" | "both";

interface CliOptions {
  scope: Scope;
  dryRun: boolean;
  reportPath?: string;
}

interface RefreshSummary {
  scope: Scope;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  areas: { scanned: number; updated: number; unchanged: number; failed: number };
  sections: { scanned: number; updated: number; unchanged: number; failed: number };
  failures: Array<{ kind: "area" | "section"; id: string; title: string; error: string }>;
}

function parseArgs(argv: string[]): CliOptions {
  let scope: Scope = "both";
  let dryRun = false;
  let reportPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--areas-only") {
      scope = "areas";
      continue;
    }
    if (arg === "--sections-only") {
      scope = "sections";
      continue;
    }
    if (arg === "--report" && argv[i + 1]) {
      reportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--report=")) {
      reportPath = arg.slice("--report=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }
    printHelpAndExit(1, `Unknown argument: ${arg}`);
  }

  return { scope, dryRun, reportPath };
}

function printHelpAndExit(code: number, message?: string): never {
  if (message) {
    console.error(message);
    console.error("");
  }
  console.log(`Usage: npm run images:refresh -- [options]

Options:
  --dry-run            Resolve image URLs without writing to DB
  --areas-only         Refresh only Areas
  --sections-only      Refresh only Sections
  --report <file>      Write JSON report to a file path
  --report=<file>      Same as above
  -h, --help           Show this help
`);
  process.exit(code);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  const summary: RefreshSummary = {
    scope: options.scope,
    dryRun: options.dryRun,
    startedAt,
    finishedAt: startedAt,
    areas: { scanned: 0, updated: 0, unchanged: 0, failed: 0 },
    sections: { scanned: 0, updated: 0, unchanged: 0, failed: 0 },
    failures: [],
  };

  if (options.scope === "both" || options.scope === "areas") {
    const areas = await prisma.area.findMany({
      select: { id: true, name: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    });
    summary.areas.scanned = areas.length;

    for (const area of areas) {
      try {
        const resolved = await getUnitImageByTitle(area.name, { kind: "area" });
        if (!resolved || resolved === area.imageUrl) {
          summary.areas.unchanged += 1;
          continue;
        }
        if (!options.dryRun) {
          await prisma.area.update({
            where: { id: area.id },
            data: { imageUrl: resolved },
          });
        }
        summary.areas.updated += 1;
      } catch (error) {
        summary.areas.failed += 1;
        summary.failures.push({
          kind: "area",
          id: area.id,
          title: area.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (options.scope === "both" || options.scope === "sections") {
    const sections = await prisma.section.findMany({
      select: { id: true, title: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    });
    summary.sections.scanned = sections.length;

    for (const section of sections) {
      try {
        const resolved = await getUnitImageByTitle(section.title, { kind: "section" });
        if (!resolved || resolved === section.imageUrl) {
          summary.sections.unchanged += 1;
          continue;
        }
        if (!options.dryRun) {
          await prisma.section.update({
            where: { id: section.id },
            data: { imageUrl: resolved },
          });
        }
        summary.sections.updated += 1;
      } catch (error) {
        summary.sections.failed += 1;
        summary.failures.push({
          kind: "section",
          id: section.id,
          title: section.title,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  summary.finishedAt = new Date().toISOString();

  if (options.reportPath) {
    const absolute = path.isAbsolute(options.reportPath)
      ? options.reportPath
      : path.resolve(process.cwd(), options.reportPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(`Report written to: ${absolute}`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("Bulk image refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
