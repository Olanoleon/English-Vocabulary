import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId");

    // org_admin can only query learners in their own org.
    // super_admin/admin can query all learners, or a specific org via query param.
    const learnerWhere: {
      role: string;
      organizationId?: string;
    } = { role: "learner" };
    if (session.role === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      learnerWhere.organizationId = session.organizationId;
    } else if (requestedOrgId) {
      learnerWhere.organizationId = requestedOrgId;
    }

    const learners = await prisma.user.findMany({
      where: learnerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
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
    const { username, password, displayName, organizationId } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "Username, password, and display name are required" },
        { status: 400 }
      );
    }

    // Determine target org:
    // - org_admin: forced to own org
    // - super_admin/admin: can pass organizationId, else defaults to fallback "Independent" org
    let targetOrgId: string | null = null;
    if (session.role === "org_admin") {
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
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        passwordHash,
        role: "learner",
        displayName,
        organizationId: targetOrgId,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        organizationId: true,
        createdAt: true,
      },
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
      await prisma.learnerSectionProgress.create({
        data: {
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
