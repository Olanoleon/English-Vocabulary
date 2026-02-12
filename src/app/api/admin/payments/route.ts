import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/admin/payments — list all learners with payment info
export async function GET() {
  try {
    await requireAdmin();

    const learners = await prisma.user.findMany({
      where: { role: "learner" },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        monthlyRate: true,
        nextPaymentDue: true,
        lastPaymentDate: true,
        createdAt: true,
        payments: {
          orderBy: { paidAt: "desc" },
          take: 5,
          select: {
            id: true,
            amount: true,
            paidAt: true,
            note: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    });

    // Compute payment status for each learner
    const now = new Date();
    const result = learners.map((learner) => {
      let paymentStatus: "free_trial" | "settled" | "past_due";

      if (learner.monthlyRate === 0) {
        paymentStatus = "free_trial";
      } else if (
        learner.nextPaymentDue &&
        new Date(learner.nextPaymentDue) >= now
      ) {
        paymentStatus = "settled";
      } else {
        paymentStatus = "past_due";
      }

      return { ...learner, paymentStatus };
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

// POST /api/admin/payments — record a payment for a learner
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { userId, amount, note } = await request.json();

    if (!userId || amount === undefined) {
      return NextResponse.json(
        { error: "userId and amount are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "learner") {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }

    const now = new Date();

    // Calculate the period this payment covers
    // If they have a nextPaymentDue in the future, extend from there
    // Otherwise, start from today
    const periodStart = user.nextPaymentDue && new Date(user.nextPaymentDue) > now
      ? new Date(user.nextPaymentDue)
      : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create payment record and update user in a transaction
    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          amount: Number(amount),
          note: note || null,
          periodStart,
          periodEnd,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          lastPaymentDate: now,
          nextPaymentDue: periodEnd,
        },
      }),
    ]);

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Record payment error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
