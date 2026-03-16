import { prisma } from "@/lib/db";

type TxLike = any;

const TEMPLATE_MODULE_TYPES = ["introduction", "practice", "test"] as const;
const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;
const orgBootstrapReplicationInFlight = new Map<string, Promise<void>>();
const orgTemplateSectionEnsureInFlight = new Map<string, Promise<string | null>>();

function isTemplateArea(area: {
  isTemplate?: boolean;
  scopeType: string;
  organizationId: string | null;
}) {
  return Boolean(area.isTemplate) || (area.scopeType === "global" && !area.organizationId);
}

async function loadTemplateSection(tx: TxLike, templateSectionId: string) {
  return tx.section.findUnique({
    where: { id: templateSectionId },
    include: {
      area: {
        select: {
          id: true,
          name: true,
          nameEs: true,
          description: true,
          imageUrl: true,
          sortOrder: true,
          isActive: true,
          isTemplate: true,
          scopeType: true,
          organizationId: true,
          sourceVersion: true,
        },
      },
      modules: {
        orderBy: { id: "asc" },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
      sectionVocabulary: {
        orderBy: { sortOrder: "asc" },
        include: {
          vocabulary: true,
        },
      },
    },
  });
}

async function upsertOrgAreaFromTemplate(
  tx: TxLike,
  templateArea: {
    id: string;
    name: string;
    nameEs: string;
    description: string | null;
    imageUrl: string | null;
    sortOrder: number;
    isTemplate: boolean;
    scopeType: string;
    organizationId: string | null;
    sourceVersion: number;
  },
  orgId: string
) {
  const existing = await tx.area.findFirst({
    where: {
      sourceTemplateId: templateArea.id,
      organizationId: orgId,
      scopeType: "org",
    },
    select: {
      id: true,
      isCustomized: true,
      isActive: true,
    },
  });

  if (existing?.isCustomized) {
    return { areaId: existing.id, skipped: true };
  }

  const area =
    existing
      ? await tx.area.update({
          where: { id: existing.id },
          data: {
            name: templateArea.name,
            nameEs: templateArea.nameEs,
            description: templateArea.description,
            imageUrl: templateArea.imageUrl,
            sortOrder: templateArea.sortOrder,
            sourceVersion: templateArea.sourceVersion,
            isTemplate: false,
            scopeType: "org",
            organizationId: orgId,
            sourceTemplateId: templateArea.id,
            // Preserve org-controlled visibility state unless an org admin customizes.
            isActive: existing.isActive,
            isCustomized: false,
          },
          select: { id: true },
        })
      : await tx.area.create({
          data: {
            name: templateArea.name,
            nameEs: templateArea.nameEs,
            description: templateArea.description,
            imageUrl: templateArea.imageUrl,
            sortOrder: templateArea.sortOrder,
            isTemplate: false,
            scopeType: "org",
            organizationId: orgId,
            sourceTemplateId: templateArea.id,
            sourceVersion: templateArea.sourceVersion,
            isCustomized: false,
            // New template rollouts start disabled for orgs by default.
            isActive: false,
          },
          select: { id: true },
        });

  await tx.organizationAreaConfig.upsert({
    where: {
      organizationId_areaId: {
        organizationId: orgId,
        areaId: area.id,
      },
    },
    update: {
      sortOrder: templateArea.sortOrder,
    },
    create: {
      organizationId: orgId,
      areaId: area.id,
      sortOrder: templateArea.sortOrder,
      isVisible: true,
    },
  });

  return { areaId: area.id, skipped: false };
}

async function overwriteSectionContentFromTemplate(
  tx: TxLike,
  sectionId: string,
  templateSection: NonNullable<Awaited<ReturnType<typeof loadTemplateSection>>>
) {
  const existing = await tx.section.findUnique({
    where: { id: sectionId },
    include: {
      modules: {
        select: { id: true },
      },
      sectionVocabulary: {
        include: { vocabulary: { select: { id: true } } },
      },
    },
  });
  if (!existing) return;

  const moduleIds = existing.modules.map((m: { id: string }) => m.id);
  if (moduleIds.length > 0) {
    await tx.learnerAttempt.deleteMany({
      where: { moduleId: { in: moduleIds } },
    });
    await tx.question.deleteMany({
      where: { moduleId: { in: moduleIds } },
    });
    await tx.module.deleteMany({
      where: { id: { in: moduleIds } },
    });
  }

  await tx.learnerSectionProgress.updateMany({
    where: { sectionId },
    data: {
      introCompleted: false,
      practiceCompleted: false,
      testPassed: false,
      testScore: null,
    },
  });

  await tx.sectionVocabulary.deleteMany({ where: { sectionId } });
  const oldVocabularyIds = existing.sectionVocabulary.map(
    (sv: { vocabulary: { id: string } }) => sv.vocabulary.id
  );
  if (oldVocabularyIds.length > 0) {
    await tx.vocabulary.deleteMany({
      where: { id: { in: oldVocabularyIds } },
    });
  }

  const createdModules = await Promise.all(
    TEMPLATE_MODULE_TYPES.map((type) =>
      tx.module.create({
        data: {
          sectionId,
          type,
          content:
            templateSection.modules.find((m: any) => m.type === type)?.content ??
            null,
        },
      })
    )
  );
  const createdModuleByType = new Map(
    createdModules.map((m: { id: string; type: string }) => [m.type, m])
  );

  for (let i = 0; i < templateSection.sectionVocabulary.length; i++) {
    const source = templateSection.sectionVocabulary[i];
    await tx.vocabulary.create({
      data: {
        word: source.vocabulary.word,
        partOfSpeech: source.vocabulary.partOfSpeech,
        definitionEs: source.vocabulary.definitionEs,
        exampleSentence: source.vocabulary.exampleSentence,
        phoneticIpa: source.vocabulary.phoneticIpa,
        stressedSyllable: source.vocabulary.stressedSyllable,
        audioUrl: source.vocabulary.audioUrl,
        sectionVocabulary: {
          create: {
            sectionId,
            sortOrder: i + 1,
          },
        },
      },
    });
  }

  for (const templateModule of templateSection.modules) {
    const targetModule = createdModuleByType.get(templateModule.type);
    if (!targetModule) continue;
    for (const q of templateModule.questions) {
      await tx.question.create({
        data: {
          moduleId: targetModule.id,
          type: q.type,
          prompt: q.prompt,
          correctAnswer: q.correctAnswer,
          sortOrder: q.sortOrder,
          options: q.options.length
            ? {
                create: q.options.map((opt: any) => ({
                  optionText: opt.optionText,
                  isCorrect: opt.isCorrect,
                  sortOrder: opt.sortOrder,
                })),
              }
            : undefined,
        },
      });
    }
  }
}

async function upsertOrgSectionFromTemplate(
  tx: TxLike,
  templateSection: NonNullable<Awaited<ReturnType<typeof loadTemplateSection>>>,
  orgAreaId: string,
  orgId: string
) {
  const existing = await tx.section.findFirst({
    where: {
      sourceTemplateId: templateSection.id,
      organizationId: orgId,
      areaId: orgAreaId,
    },
    select: {
      id: true,
      isCustomized: true,
      isActive: true,
    },
  });

  if (existing?.isCustomized) {
    return { sectionId: existing.id, skipped: true };
  }

  const section =
    existing
      ? await tx.section.update({
          where: { id: existing.id },
          data: {
            title: templateSection.title,
            titleEs: templateSection.titleEs,
            description: templateSection.description,
            imageUrl: templateSection.imageUrl,
            sortOrder: templateSection.sortOrder,
            areaId: orgAreaId,
            organizationId: orgId,
            isTemplate: false,
            sourceTemplateId: templateSection.id,
            sourceVersion: templateSection.sourceVersion,
            isCustomized: false,
            // Keep org-level visibility unless customized.
            isActive: existing.isActive,
          },
          select: { id: true },
        })
      : await tx.section.create({
          data: {
            title: templateSection.title,
            titleEs: templateSection.titleEs,
            description: templateSection.description,
            imageUrl: templateSection.imageUrl,
            sortOrder: templateSection.sortOrder,
            areaId: orgAreaId,
            organizationId: orgId,
            isTemplate: false,
            sourceTemplateId: templateSection.id,
            sourceVersion: templateSection.sourceVersion,
            isCustomized: false,
            isActive: templateSection.isActive,
          },
          select: { id: true },
        });

  await overwriteSectionContentFromTemplate(tx, section.id, templateSection);

  await tx.organizationSectionConfig.upsert({
    where: {
      organizationId_sectionId: {
        organizationId: orgId,
        sectionId: section.id,
      },
    },
    update: {
      sortOrder: templateSection.sortOrder,
    },
    create: {
      organizationId: orgId,
      sectionId: section.id,
      isVisible: true,
      sortOrder: templateSection.sortOrder,
    },
  });

  return { sectionId: section.id, skipped: false };
}

export async function ensureOrgSectionFromTemplateForOrg(
  templateSectionId: string,
  orgId: string
) {
  const key = `${orgId}:${templateSectionId}`;
  const existing = orgTemplateSectionEnsureInFlight.get(key);
  if (existing) return existing;

  const task = prisma.$transaction(async (tx) => {
    const templateSection = await loadTemplateSection(tx, templateSectionId);
    if (!templateSection || !isTemplateArea(templateSection.area)) {
      return null;
    }

    const { areaId } = await upsertOrgAreaFromTemplate(tx, templateSection.area, orgId);
    const result = await upsertOrgSectionFromTemplate(
      tx,
      templateSection,
      areaId,
      orgId
    );
    return result.sectionId;
  }, TRANSACTION_OPTIONS);

  orgTemplateSectionEnsureInFlight.set(key, task);
  try {
    return await task;
  } finally {
    if (orgTemplateSectionEnsureInFlight.get(key) === task) {
      orgTemplateSectionEnsureInFlight.delete(key);
    }
  }
}

export async function replicateTemplateAreaToAllOrgs(templateAreaId: string) {
  const templateArea = await prisma.area.findUnique({
    where: { id: templateAreaId },
    include: {
      sections: {
        select: { id: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!templateArea || !isTemplateArea(templateArea)) return;

  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const org of organizations) {
    await prisma.$transaction(async (tx) => {
      const { areaId } = await upsertOrgAreaFromTemplate(tx, templateArea, org.id);
      for (const sectionRef of templateArea.sections) {
        const templateSection = await loadTemplateSection(tx, sectionRef.id);
        if (!templateSection) continue;
        await upsertOrgSectionFromTemplate(tx, templateSection, areaId, org.id);
      }
    }, TRANSACTION_OPTIONS);
  }
}

export async function replicateTemplateSectionToAllOrgs(templateSectionId: string) {
  const templateSection = await prisma.section.findUnique({
    where: { id: templateSectionId },
    include: {
      area: true,
    },
  });
  if (!templateSection || !isTemplateArea(templateSection.area)) return;

  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const org of organizations) {
    await prisma.$transaction(async (tx) => {
      const reloadedTemplate = await loadTemplateSection(tx, templateSectionId);
      if (!reloadedTemplate) return;
      const { areaId } = await upsertOrgAreaFromTemplate(
        tx,
        reloadedTemplate.area,
        org.id
      );
      await upsertOrgSectionFromTemplate(tx, reloadedTemplate, areaId, org.id);
    }, TRANSACTION_OPTIONS);
  }
}

export async function replicateTemplatesToOrg(orgId: string) {
  const existing = orgBootstrapReplicationInFlight.get(orgId);
  if (existing) return existing;

  const task = (async () => {
    const templateAreas = await prisma.area.findMany({
      where: {
        OR: [{ isTemplate: true }, { scopeType: "global", organizationId: null }],
      },
      orderBy: { sortOrder: "asc" },
      include: {
        sections: {
          select: { id: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const templateArea of templateAreas) {
        if (!isTemplateArea(templateArea)) continue;
        const { areaId } = await upsertOrgAreaFromTemplate(tx, templateArea, orgId);
        for (const sectionRef of templateArea.sections) {
          const templateSection = await loadTemplateSection(tx, sectionRef.id);
          if (!templateSection) continue;
          await upsertOrgSectionFromTemplate(tx, templateSection, areaId, orgId);
        }
      }
    }, TRANSACTION_OPTIONS);
  })();

  orgBootstrapReplicationInFlight.set(orgId, task);
  try {
    await task;
  } finally {
    if (orgBootstrapReplicationInFlight.get(orgId) === task) {
      orgBootstrapReplicationInFlight.delete(orgId);
    }
  }
}

