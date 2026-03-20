import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { isValidEmail, normalizeEmail } from "@/lib/roles";

type RowResultStatus = "created" | "skipped" | "error";

type RowResult = {
  rowNumber: number;
  email: string;
  displayName: string;
  status: RowResultStatus;
  reason: string;
};

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

const DISPLAY_NAME_ALIASES = new Set([
  "displayname",
  "display_name",
  "name",
  "fullname",
  "full_name",
]);
const EMAIL_ALIASES = new Set(["email", "e-mail", "mail"]);
const GENDER_ALIASES = new Set(["gender", "avatargender", "avatar_gender", "sex"]);

function normalizeHeader(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

function resolveHeaderIndex(headers: unknown[], aliases: Set<string>): number {
  for (let i = 0; i < headers.length; i++) {
    if (aliases.has(normalizeHeader(headers[i]))) return i;
  }
  return -1;
}

function parseGender(raw: unknown): "male" | "female" {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "female";

  const maleValues = new Set(["male", "m", "man", "boy", "masculino", "hombre"]);
  const femaleValues = new Set(["female", "f", "woman", "girl", "femenino", "mujer"]);

  if (maleValues.has(value)) return "male";
  if (femaleValues.has(value)) return "female";
  return "female";
}

function readCell(row: unknown[], index: number): string {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Import file is required." }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Import file is empty." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV, XLS, or XLSX." },
        { status: 400 }
      );
    }

    let targetOrgId: string | null = null;
    if (activeRole === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      targetOrgId = session.organizationId;
    } else {
      const requestedOrgId = String(formData.get("organizationId") || "").trim();
      targetOrgId = requestedOrgId || null;
      if (!targetOrgId) {
        const defaultOrg = await prisma.organization.findUnique({
          where: { slug: "default-organization" },
          select: { id: true },
        });
        if (!defaultOrg) {
          return NextResponse.json(
            { error: "No target organization provided and default organization not found" },
            { status: 400 }
          );
        }
        targetOrgId = defaultOrg.id;
      }
    }

    const org = await prisma.organization.findUnique({
      where: { id: targetOrgId },
      select: { id: true, isActive: true },
    });
    if (!org || !org.isActive) {
      return NextResponse.json({ error: "Invalid or inactive organization" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(bytes), {
      type: "buffer",
      raw: false,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "File has no sheets to import." }, { status: 400 });
    }
    const firstSheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (matrix.length === 0) {
      return NextResponse.json({ error: "File has no rows to import." }, { status: 400 });
    }

    const headers = matrix[0];
    const displayNameIdx = resolveHeaderIndex(headers, DISPLAY_NAME_ALIASES);
    const emailIdx = resolveHeaderIndex(headers, EMAIL_ALIASES);
    const genderIdx = resolveHeaderIndex(headers, GENDER_ALIASES);

    if (displayNameIdx < 0 || emailIdx < 0) {
      return NextResponse.json(
        {
          error:
            "Missing required columns. Include Display Name and Email headers.",
        },
        { status: 400 }
      );
    }

    const firstSection = await prisma.section.findFirst({
      where: {
        isActive: true,
        area: {
          isActive: true,
          OR: [{ scopeType: "global" }, { scopeType: "org", organizationId: targetOrgId }],
        },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    const results: RowResult[] = [];
    const seenEmailsInFile = new Set<string>();
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i] || [];
      const rowNumber = i + 1;
      const displayName = readCell(row, displayNameIdx);
      const normalizedEmail = normalizeEmail(readCell(row, emailIdx));
      const rowEmail = normalizedEmail || readCell(row, emailIdx);

      if (!displayName && !rowEmail && !readCell(row, genderIdx)) {
        continue;
      }

      if (!displayName) {
        errorCount += 1;
        results.push({
          rowNumber,
          email: rowEmail,
          displayName,
          status: "error",
          reason: "Display Name is required.",
        });
        continue;
      }
      if (!normalizedEmail) {
        errorCount += 1;
        results.push({
          rowNumber,
          email: rowEmail,
          displayName,
          status: "error",
          reason: "Email is required.",
        });
        continue;
      }
      if (!isValidEmail(normalizedEmail)) {
        errorCount += 1;
        results.push({
          rowNumber,
          email: normalizedEmail,
          displayName,
          status: "error",
          reason: "Invalid email format.",
        });
        continue;
      }
      if (seenEmailsInFile.has(normalizedEmail)) {
        skippedCount += 1;
        results.push({
          rowNumber,
          email: normalizedEmail,
          displayName,
          status: "skipped",
          reason: "Duplicate email in import file.",
        });
        continue;
      }
      seenEmailsInFile.add(normalizedEmail);

      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing) {
        skippedCount += 1;
        results.push({
          rowNumber,
          email: normalizedEmail,
          displayName,
          status: "skipped",
          reason: "Email already exists.",
        });
        continue;
      }

      const avatarGender = parseGender(readCell(row, genderIdx));
      try {
        const passwordHash = await bcrypt.hash(normalizedEmail, 10);
        const createdUser = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              username: normalizedEmail,
              email: normalizedEmail,
              passwordHash,
              role: "learner",
              displayName,
              avatarGender,
              organizationId: targetOrgId,
            },
            select: { id: true },
          });
          await tx.userRoleMembership.create({
            data: {
              userId: user.id,
              role: "learner",
              organizationId: targetOrgId,
            },
          });
          await tx.user.update({
            where: { id: user.id },
            data: { role: "learner" },
          });
          return user;
        });

        if (firstSection) {
          await prisma.learnerSectionProgress.upsert({
            where: {
              userId_sectionId: {
                userId: createdUser.id,
                sectionId: firstSection.id,
              },
            },
            update: {
              unlocked: true,
              unlockedAt: new Date(),
            },
            create: {
              userId: createdUser.id,
              sectionId: firstSection.id,
              unlocked: true,
              unlockedAt: new Date(),
            },
          });
        }

        createdCount += 1;
        results.push({
          rowNumber,
          email: normalizedEmail,
          displayName,
          status: "created",
          reason: "Learner created.",
        });
      } catch (error: unknown) {
        errorCount += 1;
        const message = error instanceof Error ? error.message : "Unexpected server error.";
        results.push({
          rowNumber,
          email: normalizedEmail,
          displayName,
          status: "error",
          reason: message,
        });
      }
    }

    return NextResponse.json({
      createdCount,
      skippedCount,
      errorCount,
      totalProcessed: createdCount + skippedCount + errorCount,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to import learners." }, { status: 500 });
  }
}

