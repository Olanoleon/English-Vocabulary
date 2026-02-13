import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// PATCH /api/admin/payments/:id — update learner payment settings (rate, nextPaymentDue)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.monthlyRate !== undefined) {
      updateData.monthlyRate = Number(body.monthlyRate);
    }
    if (body.nextPaymentDue !== undefined) {
      updateData.nextPaymentDue = body.nextPaymentDue
        ? new Date(body.nextPaymentDue)
        : null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        monthlyRate: true,
        nextPaymentDue: true,
        lastPaymentDate: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Update payment settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET /api/admin/payments/:userId — get payment history for a learner
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const payments = await prisma.payment.findMany({
      where: { userId: id },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        note: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    return NextResponse.json(payments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
