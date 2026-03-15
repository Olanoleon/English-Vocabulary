import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { isValidEmail, normalizeEmail } from "@/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");

    const learnerWhere: {
      roleMemberships: {
        some: {
          role: string;
          organizationId?: string;
        };
      };
    } = { roleMemberships: { some: { role: "learner" } } };
    if (activeRole === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      learnerWhere.roleMemberships.some.organizationId = session.organizationId;
    } else if (requestedOrgId) {
      learnerWhere.roleMemberships.some.organizationId = requestedOrgId;
    }

    const learners = await prisma.user.findMany({
      where: learnerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarGender: true,
        organizationId: true,
        createdAt: true,
        monthlyRate: true,
        nextPaymentDue: true,
        accessOverride: true,
        sectionProgress: {
          select: {
            sectionId: true,
            introCompleted: true,
            practiceCompleted: true,
            testPassed: true,
            testScore: true,
          },
        },
      },
    });

    // Compute effective access status for each learner
    const now = new Date();
    const result = learners.map((learner) => {
      let paymentStatus: "free_trial" | "settled" | "past_due";
      if (learner.monthlyRate === 0) {
        paymentStatus = "free_trial";
      } else if (learner.nextPaymentDue && new Date(learner.nextPaymentDue) >= now) {
        paymentStatus = "settled";
      } else {
        paymentStatus = "past_due";
      }

      let hasAccess: boolean;
      let accessReason: string;
      if (learner.accessOverride === "disabled") {
        hasAccess = false;
        accessReason = "Disabled by admin";
      } else if (learner.accessOverride === "enabled") {
        hasAccess = true;
        accessReason = "Enabled by admin";
      } else if (paymentStatus === "past_due") {
        hasAccess = false;
        accessReason = "Payment overdue";
      } else {
        hasAccess = true;
        accessReason = paymentStatus === "free_trial" ? "Free trial" : "Payment up to date";
      }

      return { ...learner, paymentStatus, hasAccess, accessReason };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { email, password, displayName, organizationId, avatarGender } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password || !displayName) {
      return NextResponse.json(
        { error: "E-mail, password, and display name are required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "A valid e-mail is required" }, { status: 400 });
    }

    // Determine target org:
    // - org_admin: forced to own org
    // - super_admin/admin: can pass organizationId, else defaults to fallback "Independent" org
    let targetOrgId: string | null = null;
    if (activeRole === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      targetOrgId = session.organizationId;
    } else {
      targetOrgId = organizationId || null;
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

    // Check existing
    const normalizedAvatarGender =
      avatarGender === "male" || avatarGender === "female" ? avatarGender : "female";
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true },
      });
      const passwordHash = await bcrypt.hash(String(password), 10);
      const targetUser = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              username: normalizedEmail,
              email: normalizedEmail,
              passwordHash,
              displayName: String(displayName).trim(),
              avatarGender: normalizedAvatarGender,
              organizationId: targetOrgId,
            },
            select: { id: true, username: true, displayName: true, avatarGender: true, organizationId: true, createdAt: true },
          })
        : await tx.user.create({
            data: {
              username: normalizedEmail,
              email: normalizedEmail,
              passwordHash,
              role: "learner",
              displayName: String(displayName).trim(),
              avatarGender: normalizedAvatarGender,
              organizationId: targetOrgId,
            },
            select: { id: true, username: true, displayName: true, avatarGender: true, organizationId: true, createdAt: true },
          });
      const existingLearnerMembership = await tx.userRoleMembership.findFirst({
        where: { userId: targetUser.id, role: "learner", organizationId: targetOrgId },
        select: { id: true },
      });
      if (!existingLearnerMembership) {
        await tx.userRoleMembership.create({
          data: {
            userId: targetUser.id,
            role: "learner",
            organizationId: targetOrgId,
          },
        });
      }
      await tx.user.update({
        where: { id: targetUser.id },
        data: { role: "learner" },
      });
      return targetUser;
    });

    // Auto-unlock first section visible to the learner's org
    const firstSection = await prisma.section.findFirst({
      where: {
        isActive: true,
        area: {
          isActive: true,
          OR: [
            { scopeType: "global" },
            { scopeType: "org", organizationId: targetOrgId },
          ],
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    if (firstSection) {
      await prisma.learnerSectionProgress.upsert({
        where: {
          userId_sectionId: {
            userId: user.id,
            sectionId: firstSection.id,
          },
        },
        update: {
          unlocked: true,
          unlockedAt: new Date(),
        },
        create: {
          userId: user.id,
          sectionId: firstSection.id,
          unlocked: true,
          unlockedAt: new Date(),
        },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create learner error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
