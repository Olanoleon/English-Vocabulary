import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SeedVocab = {
  word: string;
  partOfSpeech: string;
  definitionEs: string;
  exampleSentence: string;
  phoneticIpa?: string;
  stressedSyllable?: string;
};

async function clearSeedData() {
  await prisma.$transaction([
    prisma.learnerAnswer.deleteMany(),
    prisma.learnerAttempt.deleteMany(),
    prisma.learnerSectionProgress.deleteMany(),
    prisma.questionOption.deleteMany(),
    prisma.question.deleteMany(),
    prisma.module.deleteMany(),
    prisma.sectionVocabulary.deleteMany(),
    prisma.vocabulary.deleteMany(),
    prisma.section.deleteMany(),
    prisma.area.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.userRoleMembership.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function setGlobalAreaVisibilityForAllOrgs(
  areaId: string,
  sortOrder: number,
  isVisible: boolean
) {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });
  if (orgs.length === 0) return;

  await prisma.organizationAreaConfig.createMany({
    data: orgs.map((org) => ({
      organizationId: org.id,
      areaId,
      isVisible,
      sortOrder,
    })),
    skipDuplicates: true,
  });
}

async function seedSectionData(
  sectionId: string,
  vocabulary: SeedVocab[],
  practiceModuleId: string,
  testModuleId: string
) {
  for (let i = 0; i < vocabulary.length; i++) {
    const v = vocabulary[i];
    await prisma.vocabulary.create({
      data: {
        word: v.word,
        partOfSpeech: v.partOfSpeech,
        definitionEs: v.definitionEs,
        exampleSentence: v.exampleSentence,
        phoneticIpa: v.phoneticIpa || null,
        stressedSyllable: v.stressedSyllable || null,
        sectionVocabulary: {
          create: {
            sectionId,
            sortOrder: i + 1,
          },
        },
      },
    });
  }

  // Simple practice questions
  await prisma.question.create({
    data: {
      moduleId: practiceModuleId,
      type: "multiple_choice",
      prompt: `What is the meaning of "${vocabulary[0].word}"?`,
      sortOrder: 1,
      options: {
        create: [
          { optionText: vocabulary[0].definitionEs, isCorrect: true, sortOrder: 1 },
          { optionText: vocabulary[1].definitionEs, isCorrect: false, sortOrder: 2 },
          { optionText: vocabulary[2].definitionEs, isCorrect: false, sortOrder: 3 },
          { optionText: vocabulary[3].definitionEs, isCorrect: false, sortOrder: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      moduleId: practiceModuleId,
      type: "fill_blank",
      prompt: vocabulary[1].exampleSentence.replace(vocabulary[1].word, "___"),
      correctAnswer: vocabulary[1].word,
      sortOrder: 2,
    },
  });

  // Simple test questions
  await prisma.question.create({
    data: {
      moduleId: testModuleId,
      type: "multiple_choice",
      prompt: `Which word means "${vocabulary[2].definitionEs}"?`,
      sortOrder: 1,
      options: {
        create: [
          { optionText: vocabulary[2].word, isCorrect: true, sortOrder: 1 },
          { optionText: vocabulary[0].word, isCorrect: false, sortOrder: 2 },
          { optionText: vocabulary[1].word, isCorrect: false, sortOrder: 3 },
          { optionText: vocabulary[4].word, isCorrect: false, sortOrder: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      moduleId: testModuleId,
      type: "fill_blank",
      prompt: vocabulary[4].exampleSentence.replace(vocabulary[4].word, "___"),
      correctAnswer: vocabulary[4].word,
      sortOrder: 2,
    },
  });
}

async function main() {
  console.log("Seeding database...");
  await clearSeedData();

  const SUPER_ADMIN_EMAIL = "olanoleon@gmail.com";

  const defaultOrg = await prisma.organization.upsert({
    where: { slug: "default-organization" },
    update: { name: "Default Organization", isActive: true },
    create: {
      name: "Default Organization",
      slug: "default-organization",
      isActive: true,
    },
  });

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      username: SUPER_ADMIN_EMAIL,
      email: SUPER_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "super_admin",
      displayName: "Administrator",
    },
  });
  await prisma.userRoleMembership.create({
    data: {
      userId: admin.id,
      role: "super_admin",
      organizationId: null,
    },
  });
  console.log("Admin user created:", admin.email);

  const learnerPasswordHash = await bcrypt.hash("learner123", 10);
  const learner = await prisma.user.create({
    data: {
      username: "maria@vocabpath.local",
      email: "maria@vocabpath.local",
      passwordHash: learnerPasswordHash,
      role: "learner",
      displayName: "Maria Garcia",
      organizationId: defaultOrg.id,
    },
  });
  await prisma.userRoleMembership.create({
    data: {
      userId: learner.id,
      role: "learner",
      organizationId: defaultOrg.id,
    },
  });
  console.log("Learner user created:", learner.email);

  const animalsArea = await prisma.area.create({
    data: {
      name: "Animals",
      nameEs: "Animales",
      description: "Vocabulary focused on animal groups and habitats",
      imageUrl: "/images/library/animals_lion.png",
      sortOrder: 1,
      isActive: true,
    },
  });
  console.log("Area created:", animalsArea.name);

  const domesticSection = await prisma.section.create({
    data: {
      title: "Domestic animals",
      titleEs: "Animales domesticos",
      description: "Common animals we see at home or farms",
      imageUrl: "/images/library/animals_dog.png",
      sortOrder: 1,
      areaId: animalsArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "Life with Domestic Animals",
              readingText:
                "A friendly **dog** can guard the house, while a **cat** often sleeps near the window. Farmers also care for a **cow**, a **horse**, and a **sheep** every day.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const seaSection = await prisma.section.create({
    data: {
      title: "Sea animals",
      titleEs: "Animales marinos",
      description: "Vocabulary for creatures living in oceans",
      imageUrl: "/images/library/animals_whale.png",
      sortOrder: 2,
      areaId: animalsArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "A Day Under the Sea",
              readingText:
                "In the ocean, a **dolphin** swims quickly, a **shark** hunts for food, and a **whale** sings low sounds. A **turtle** moves calmly, while an **octopus** hides between rocks.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const birdsSection = await prisma.section.create({
    data: {
      title: "Birds",
      titleEs: "Aves",
      description: "Vocabulary about common birds and their behavior",
      imageUrl: "/images/library/animals_bird.png",
      sortOrder: 3,
      areaId: animalsArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "Birds Around Us",
              readingText:
                "A small **sparrow** sits on a branch, a **parrot** repeats words, and an **eagle** flies high. Near lakes, a **duck** and a **seagull** look for food.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const domesticPracticeModule = domesticSection.modules.find((m) => m.type === "practice");
  const domesticTestModule = domesticSection.modules.find((m) => m.type === "test");
  const seaPracticeModule = seaSection.modules.find((m) => m.type === "practice");
  const seaTestModule = seaSection.modules.find((m) => m.type === "test");
  const birdsPracticeModule = birdsSection.modules.find((m) => m.type === "practice");
  const birdsTestModule = birdsSection.modules.find((m) => m.type === "test");

  if (
    !domesticPracticeModule ||
    !domesticTestModule ||
    !seaPracticeModule ||
    !seaTestModule ||
    !birdsPracticeModule ||
    !birdsTestModule
  ) {
    throw new Error("Failed to create required modules for seeded sections.");
  }

  await seedSectionData(
    domesticSection.id,
    [
      {
        word: "dog",
        partOfSpeech: "noun",
        definitionEs: "Perro",
        exampleSentence: "The dog waits by the door.",
      },
      {
        word: "cat",
        partOfSpeech: "noun",
        definitionEs: "Gato",
        exampleSentence: "Our cat loves warm places.",
      },
      {
        word: "cow",
        partOfSpeech: "noun",
        definitionEs: "Vaca",
        exampleSentence: "A cow gives milk every day.",
      },
      {
        word: "horse",
        partOfSpeech: "noun",
        definitionEs: "Caballo",
        exampleSentence: "The horse runs fast in the field.",
      },
      {
        word: "sheep",
        partOfSpeech: "noun",
        definitionEs: "Oveja",
        exampleSentence: "A sheep has thick wool.",
      },
    ],
    domesticPracticeModule.id,
    domesticTestModule.id
  );

  await seedSectionData(
    seaSection.id,
    [
      {
        word: "dolphin",
        partOfSpeech: "noun",
        definitionEs: "Delfin",
        exampleSentence: "A dolphin jumps above the waves.",
      },
      {
        word: "shark",
        partOfSpeech: "noun",
        definitionEs: "Tiburon",
        exampleSentence: "A shark has sharp teeth.",
      },
      {
        word: "whale",
        partOfSpeech: "noun",
        definitionEs: "Ballena",
        exampleSentence: "The whale is the largest sea animal.",
      },
      {
        word: "turtle",
        partOfSpeech: "noun",
        definitionEs: "Tortuga",
        exampleSentence: "A turtle swims slowly near coral.",
      },
      {
        word: "octopus",
        partOfSpeech: "noun",
        definitionEs: "Pulpo",
        exampleSentence: "An octopus has eight arms.",
      },
    ],
    seaPracticeModule.id,
    seaTestModule.id
  );

  await seedSectionData(
    birdsSection.id,
    [
      {
        word: "sparrow",
        partOfSpeech: "noun",
        definitionEs: "Gorrion",
        exampleSentence: "A sparrow sings in the morning.",
      },
      {
        word: "parrot",
        partOfSpeech: "noun",
        definitionEs: "Loro",
        exampleSentence: "The parrot can repeat short phrases.",
      },
      {
        word: "eagle",
        partOfSpeech: "noun",
        definitionEs: "Aguila",
        exampleSentence: "An eagle can see far away.",
      },
      {
        word: "duck",
        partOfSpeech: "noun",
        definitionEs: "Pato",
        exampleSentence: "A duck swims across the pond.",
      },
      {
        word: "seagull",
        partOfSpeech: "noun",
        definitionEs: "Gaviota",
        exampleSentence: "A seagull flies over the beach.",
      },
    ],
    birdsPracticeModule.id,
    birdsTestModule.id
  );

  const familyArea = await prisma.area.create({
    data: {
      name: "Family & Relationships",
      nameEs: "Familia y relaciones",
      description: "Vocabulary about family members and social connections",
      imageUrl: "/images/library/family_relationships.png",
      sortOrder: 2,
      isActive: true,
    },
  });
  console.log("Area created:", familyArea.name);
  // Match admin-created global area behavior: disabled for orgs by default.
  await setGlobalAreaVisibilityForAllOrgs(familyArea.id, familyArea.sortOrder, false);

  const familyMembersSection = await prisma.section.create({
    data: {
      title: "Family members",
      titleEs: "Miembros de la familia",
      description: "Core words for immediate and extended family",
      imageUrl: "/images/library/family_members.png",
      sortOrder: 1,
      areaId: familyArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "A Family Reunion",
              readingText:
                "At the reunion, my **mother** greeted my **brother**, and my **sister** played with our **cousin** while our **grandfather** told stories.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const relationshipsSection = await prisma.section.create({
    data: {
      title: "Relationships",
      titleEs: "Relaciones",
      description: "Vocabulary for friendship and personal bonds",
      imageUrl: "/images/library/family_relationships.png",
      sortOrder: 2,
      areaId: familyArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "Strong Connections",
              readingText:
                "A good **friend** earns your **trust**, offers **support**, and shows **respect**. Healthy relationships need open **communication** every day.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const homeLifeSection = await prisma.section.create({
    data: {
      title: "Home life",
      titleEs: "Vida en casa",
      description: "Vocabulary for routines and family life at home",
      imageUrl: "/images/library/house_home.png",
      sortOrder: 3,
      areaId: familyArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "Life at Home",
              readingText:
                "At home we share **chores**, cook **dinner**, keep a daily **routine**, and spend **weekends** together in a calm **household**.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const familyMembersPracticeModule = familyMembersSection.modules.find((m) => m.type === "practice");
  const familyMembersTestModule = familyMembersSection.modules.find((m) => m.type === "test");
  const relationshipsPracticeModule = relationshipsSection.modules.find((m) => m.type === "practice");
  const relationshipsTestModule = relationshipsSection.modules.find((m) => m.type === "test");
  const homeLifePracticeModule = homeLifeSection.modules.find((m) => m.type === "practice");
  const homeLifeTestModule = homeLifeSection.modules.find((m) => m.type === "test");

  if (
    !familyMembersPracticeModule ||
    !familyMembersTestModule ||
    !relationshipsPracticeModule ||
    !relationshipsTestModule ||
    !homeLifePracticeModule ||
    !homeLifeTestModule
  ) {
    throw new Error("Failed to create required modules for Family & Relationships sections.");
  }

  await seedSectionData(
    familyMembersSection.id,
    [
      { word: "mother", partOfSpeech: "noun", definitionEs: "Madre", exampleSentence: "My mother makes breakfast every morning." },
      { word: "brother", partOfSpeech: "noun", definitionEs: "Hermano", exampleSentence: "My brother plays basketball on weekends." },
      { word: "sister", partOfSpeech: "noun", definitionEs: "Hermana", exampleSentence: "My sister studies at university." },
      { word: "cousin", partOfSpeech: "noun", definitionEs: "Primo", exampleSentence: "My cousin visits us in summer." },
      { word: "grandfather", partOfSpeech: "noun", definitionEs: "Abuelo", exampleSentence: "My grandfather tells funny stories." },
    ],
    familyMembersPracticeModule.id,
    familyMembersTestModule.id
  );

  await seedSectionData(
    relationshipsSection.id,
    [
      { word: "friend", partOfSpeech: "noun", definitionEs: "Amigo", exampleSentence: "A true friend always listens." },
      { word: "trust", partOfSpeech: "noun", definitionEs: "Confianza", exampleSentence: "Trust takes time to build." },
      { word: "support", partOfSpeech: "noun", definitionEs: "Apoyo", exampleSentence: "Family support helps during hard times." },
      { word: "respect", partOfSpeech: "noun", definitionEs: "Respeto", exampleSentence: "Respect is important in every relationship." },
      { word: "communication", partOfSpeech: "noun", definitionEs: "Comunicacion", exampleSentence: "Good communication prevents misunderstandings." },
    ],
    relationshipsPracticeModule.id,
    relationshipsTestModule.id
  );

  await seedSectionData(
    homeLifeSection.id,
    [
      { word: "chores", partOfSpeech: "noun", definitionEs: "Quehaceres", exampleSentence: "We finish chores before dinner." },
      { word: "dinner", partOfSpeech: "noun", definitionEs: "Cena", exampleSentence: "Dinner starts at seven o'clock." },
      { word: "routine", partOfSpeech: "noun", definitionEs: "Rutina", exampleSentence: "A routine helps children feel calm." },
      { word: "weekends", partOfSpeech: "noun", definitionEs: "Fines de semana", exampleSentence: "We visit our grandparents on weekends." },
      { word: "household", partOfSpeech: "noun", definitionEs: "Hogar", exampleSentence: "Everyone helps in the household." },
    ],
    homeLifePracticeModule.id,
    homeLifeTestModule.id
  );

  await prisma.learnerSectionProgress.create({
    data: {
      userId: learner.id,
      sectionId: domesticSection.id,
      unlocked: true,
      unlockedAt: new Date(),
    },
  });
  await prisma.learnerSectionProgress.create({
    data: {
      userId: learner.id,
      sectionId: familyMembersSection.id,
      unlocked: true,
      unlockedAt: new Date(),
    },
  });

  console.log("Seed complete!");
  console.log("---");
  console.log(`Admin login:   ${SUPER_ADMIN_EMAIL} / admin123`);
  console.log("Learner login: maria@vocabpath.local / learner123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
