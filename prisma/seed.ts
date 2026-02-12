import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      role: "admin",
      displayName: "Administrator",
    },
  });
  console.log("Admin user created:", admin.username);

  // Create a demo learner
  const learnerPasswordHash = await bcrypt.hash("learner123", 10);
  const learner = await prisma.user.upsert({
    where: { username: "maria" },
    update: {},
    create: {
      username: "maria",
      passwordHash: learnerPasswordHash,
      role: "learner",
      displayName: "María García",
    },
  });
  console.log("Learner user created:", learner.username);

  // Create Section 1: Daily Life
  const section1 = await prisma.section.create({
    data: {
      title: "Daily Life",
      titleEs: "Vida Cotidiana",
      description: "Essential vocabulary for everyday situations",
      sortOrder: 1,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "A Typical Day",
              readingText:
                "Every morning, Sarah likes to **commute** to her office by train. She usually **grabs** a quick coffee from the café near the station. Her daily **routine** includes checking emails and attending team meetings. During lunch, she prefers to **stroll** through the park nearby. In the evening, she enjoys cooking **homemade** meals and reading before bed.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  // Add vocabulary for Section 1
  const vocabData1 = [
    {
      word: "commute",
      partOfSpeech: "verb",
      definitionEs: "Viajar regularmente entre el hogar y el trabajo",
      exampleSentence: "She commutes to work by train every day.",
      phoneticIpa: "/kəˈmjuːt/",
      stressedSyllable: "mute",
    },
    {
      word: "grab",
      partOfSpeech: "verb",
      definitionEs: "Tomar rápidamente, agarrar",
      exampleSentence: "Let me grab a coffee before the meeting.",
      phoneticIpa: "/ɡræb/",
      stressedSyllable: "grab",
    },
    {
      word: "routine",
      partOfSpeech: "noun",
      definitionEs: "Rutina, secuencia regular de actividades",
      exampleSentence: "Exercise is part of my daily routine.",
      phoneticIpa: "/ruːˈtiːn/",
      stressedSyllable: "tine",
    },
    {
      word: "stroll",
      partOfSpeech: "verb",
      definitionEs: "Pasear, caminar de forma relajada",
      exampleSentence: "They strolled through the park after dinner.",
      phoneticIpa: "/stroʊl/",
      stressedSyllable: "stroll",
    },
    {
      word: "homemade",
      partOfSpeech: "adjective",
      definitionEs: "Hecho en casa, casero",
      exampleSentence: "Nothing beats homemade bread.",
      phoneticIpa: "/ˌhoʊmˈmeɪd/",
      stressedSyllable: "made",
    },
  ];

  for (let i = 0; i < vocabData1.length; i++) {
    const v = vocabData1[i];
    await prisma.vocabulary.create({
      data: {
        ...v,
        sectionVocabulary: {
          create: { sectionId: section1.id, sortOrder: i + 1 },
        },
      },
    });
  }

  // Add practice questions for Section 1
  const practiceModule1 = section1.modules.find((m) => m.type === "practice")!;
  const testModule1 = section1.modules.find((m) => m.type === "test")!;

  // Practice questions
  const practiceQuestions = [
    {
      type: "multiple_choice",
      prompt: 'What does "commute" mean?',
      sortOrder: 1,
      options: [
        { optionText: "Viajar regularmente al trabajo", isCorrect: true },
        { optionText: "Cocinar en casa", isCorrect: false },
        { optionText: "Dormir temprano", isCorrect: false },
        { optionText: "Hacer ejercicio", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: 'She likes to ___ a quick coffee before work.',
      correctAnswer: "grab",
      sortOrder: 2,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'Which word means "hecho en casa"?',
      sortOrder: 3,
      options: [
        { optionText: "commute", isCorrect: false },
        { optionText: "stroll", isCorrect: false },
        { optionText: "homemade", isCorrect: true },
        { optionText: "routine", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'What is the meaning of "stroll"?',
      sortOrder: 4,
      options: [
        { optionText: "Correr rápido", isCorrect: false },
        { optionText: "Pasear, caminar relajadamente", isCorrect: true },
        { optionText: "Trabajar duro", isCorrect: false },
        { optionText: "Estudiar intensamente", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "Exercise is part of my daily ___.",
      correctAnswer: "routine",
      sortOrder: 5,
      options: [],
    },
  ];

  for (const q of practiceQuestions) {
    await prisma.question.create({
      data: {
        moduleId: practiceModule1.id,
        type: q.type,
        prompt: q.prompt,
        correctAnswer: q.correctAnswer || null,
        sortOrder: q.sortOrder,
        options:
          q.options.length > 0
            ? {
                create: q.options.map((o, idx) => ({
                  optionText: o.optionText,
                  isCorrect: o.isCorrect,
                  sortOrder: idx + 1,
                })),
              }
            : undefined,
      },
    });
  }

  // Test questions (vocab + phonetics)
  const testQuestions = [
    {
      type: "multiple_choice",
      prompt: 'Select the correct definition for "routine":',
      sortOrder: 1,
      options: [
        { optionText: "Una actividad peligrosa", isCorrect: false },
        { optionText: "Un viaje largo", isCorrect: false },
        { optionText: "Secuencia regular de actividades", isCorrect: true },
        { optionText: "Un tipo de comida", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "They ___ through the park after dinner.",
      correctAnswer: "strolled",
      sortOrder: 2,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'Which word means "tomar rápidamente"?',
      sortOrder: 3,
      options: [
        { optionText: "stroll", isCorrect: false },
        { optionText: "grab", isCorrect: true },
        { optionText: "commute", isCorrect: false },
        { optionText: "homemade", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which syllable is stressed in "commute"?',
      sortOrder: 4,
      options: [
        { optionText: "COM-mute", isCorrect: false },
        { optionText: "com-MUTE", isCorrect: true },
        { optionText: "Both equally", isCorrect: false },
        { optionText: "Neither", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which word rhymes with "stroll"?',
      sortOrder: 5,
      options: [
        { optionText: "doll", isCorrect: false },
        { optionText: "roll", isCorrect: true },
        { optionText: "bull", isCorrect: false },
        { optionText: "still", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: "Nothing beats ___ bread.",
      sortOrder: 6,
      options: [
        { optionText: "commuted", isCorrect: false },
        { optionText: "grabbed", isCorrect: false },
        { optionText: "homemade", isCorrect: true },
        { optionText: "strolled", isCorrect: false },
      ],
    },
  ];

  for (const q of testQuestions) {
    await prisma.question.create({
      data: {
        moduleId: testModule1.id,
        type: q.type,
        prompt: q.prompt,
        correctAnswer: q.correctAnswer || null,
        sortOrder: q.sortOrder,
        options:
          q.options.length > 0
            ? {
                create: q.options.map((o, idx) => ({
                  optionText: o.optionText,
                  isCorrect: o.isCorrect,
                  sortOrder: idx + 1,
                })),
              }
            : undefined,
      },
    });
  }

  // Create Section 2: Dining Out
  const section2 = await prisma.section.create({
    data: {
      title: "Dining Out",
      titleEs: "Comer Fuera",
      description: "Vocabulary for restaurants and food",
      sortOrder: 2,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "A Night Out",
              readingText:
                "Last weekend, we decided to **dine** at a new Italian restaurant. The **appetizer** was a delicious bruschetta. The waiter was very **attentive** and recommended the daily **special**. For dessert, we shared a **scrumptious** tiramisu.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const vocabData2 = [
    {
      word: "dine",
      partOfSpeech: "verb",
      definitionEs: "Cenar, comer formalmente",
      exampleSentence: "We dined at an elegant restaurant.",
      phoneticIpa: "/daɪn/",
      stressedSyllable: "dine",
    },
    {
      word: "appetizer",
      partOfSpeech: "noun",
      definitionEs: "Aperitivo, entrada",
      exampleSentence: "The shrimp appetizer was excellent.",
      phoneticIpa: "/ˈæpɪˌtaɪzər/",
      stressedSyllable: "ap",
    },
    {
      word: "attentive",
      partOfSpeech: "adjective",
      definitionEs: "Atento, servicial",
      exampleSentence: "The attentive waiter made our experience great.",
      phoneticIpa: "/əˈtentɪv/",
      stressedSyllable: "ten",
    },
    {
      word: "special",
      partOfSpeech: "noun",
      definitionEs: "Especial del día, plato especial",
      exampleSentence: "Today's special is grilled salmon.",
      phoneticIpa: "/ˈspɛʃəl/",
      stressedSyllable: "spe",
    },
    {
      word: "scrumptious",
      partOfSpeech: "adjective",
      definitionEs: "Delicioso, exquisito",
      exampleSentence: "The chocolate cake was absolutely scrumptious.",
      phoneticIpa: "/ˈskrʌmpʃəs/",
      stressedSyllable: "scrump",
    },
  ];

  for (let i = 0; i < vocabData2.length; i++) {
    const v = vocabData2[i];
    await prisma.vocabulary.create({
      data: {
        ...v,
        sectionVocabulary: {
          create: { sectionId: section2.id, sortOrder: i + 1 },
        },
      },
    });
  }

  // Practice questions for Section 2
  const practiceModule2 = section2.modules.find((m) => m.type === "practice")!;
  const testModule2 = section2.modules.find((m) => m.type === "test")!;

  const practiceQuestions2 = [
    {
      type: "multiple_choice",
      prompt: 'What does "dine" mean?',
      sortOrder: 1,
      options: [
        { optionText: "Cocinar rápido", isCorrect: false },
        { optionText: "Cenar, comer formalmente", isCorrect: true },
        { optionText: "Pedir comida para llevar", isCorrect: false },
        { optionText: "Lavar los platos", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "The shrimp ___ was excellent.",
      correctAnswer: "appetizer",
      sortOrder: 2,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'Which word means "delicioso, exquisito"?',
      sortOrder: 3,
      options: [
        { optionText: "attentive", isCorrect: false },
        { optionText: "special", isCorrect: false },
        { optionText: "dine", isCorrect: false },
        { optionText: "scrumptious", isCorrect: true },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'What is the meaning of "attentive"?',
      sortOrder: 4,
      options: [
        { optionText: "Distraído", isCorrect: false },
        { optionText: "Atento, servicial", isCorrect: true },
        { optionText: "Molesto", isCorrect: false },
        { optionText: "Cansado", isCorrect: false },
      ],
    },
  ];

  for (const q of practiceQuestions2) {
    await prisma.question.create({
      data: {
        moduleId: practiceModule2.id,
        type: q.type,
        prompt: q.prompt,
        correctAnswer: q.correctAnswer || null,
        sortOrder: q.sortOrder,
        options:
          q.options.length > 0
            ? {
                create: q.options.map((o, idx) => ({
                  optionText: o.optionText,
                  isCorrect: o.isCorrect,
                  sortOrder: idx + 1,
                })),
              }
            : undefined,
      },
    });
  }

  const testQuestions2 = [
    {
      type: "multiple_choice",
      prompt: 'Select the correct definition for "appetizer":',
      sortOrder: 1,
      options: [
        { optionText: "Postre", isCorrect: false },
        { optionText: "Aperitivo, entrada", isCorrect: true },
        { optionText: "Bebida", isCorrect: false },
        { optionText: "Plato principal", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "We ___ at an elegant restaurant last night.",
      correctAnswer: "dined",
      sortOrder: 2,
      options: [],
    },
    {
      type: "phonetics",
      prompt: 'Which syllable is stressed in "appetizer"?',
      sortOrder: 3,
      options: [
        { optionText: "AP-pe-ti-zer", isCorrect: true },
        { optionText: "ap-PE-ti-zer", isCorrect: false },
        { optionText: "ap-pe-TI-zer", isCorrect: false },
        { optionText: "ap-pe-ti-ZER", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'The chocolate cake was absolutely ___.',
      sortOrder: 4,
      options: [
        { optionText: "attentive", isCorrect: false },
        { optionText: "special", isCorrect: false },
        { optionText: "scrumptious", isCorrect: true },
        { optionText: "dine", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which word rhymes with "dine"?',
      sortOrder: 5,
      options: [
        { optionText: "done", isCorrect: false },
        { optionText: "fine", isCorrect: true },
        { optionText: "den", isCorrect: false },
        { optionText: "din", isCorrect: false },
      ],
    },
  ];

  for (const q of testQuestions2) {
    await prisma.question.create({
      data: {
        moduleId: testModule2.id,
        type: q.type,
        prompt: q.prompt,
        correctAnswer: q.correctAnswer || null,
        sortOrder: q.sortOrder,
        options:
          q.options.length > 0
            ? {
                create: q.options.map((o, idx) => ({
                  optionText: o.optionText,
                  isCorrect: o.isCorrect,
                  sortOrder: idx + 1,
                })),
              }
            : undefined,
      },
    });
  }

  // Unlock first section for learner
  await prisma.learnerSectionProgress.upsert({
    where: {
      userId_sectionId: {
        userId: learner.id,
        sectionId: section1.id,
      },
    },
    update: {},
    create: {
      userId: learner.id,
      sectionId: section1.id,
      unlocked: true,
      unlockedAt: new Date(),
    },
  });

  console.log("Seed complete!");
  console.log("---");
  console.log("Admin login:   admin / admin123");
  console.log("Learner login: maria / learner123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
