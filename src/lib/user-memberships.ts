import { prisma } from "@/lib/db";

export type MembershipRole = "super_admin" | "admin" | "org_admin" | "learner";

export interface UserMembershipView {
  id: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
}

export async function getUserMemberships(userId: string): Promise<UserMembershipView[]> {
  const memberships = await prisma.userRoleMembership.findMany({
    where: { userId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: {
        select: { name: true },
      },
    },
  });
  return memberships.map((m) => ({
    id: m.id,
    role: m.role,
    organizationId: m.organizationId,
    organizationName: m.organization?.name ?? null,
  }));
}

