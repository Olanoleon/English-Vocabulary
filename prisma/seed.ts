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

  // Create a default Area of Knowledge
  const generalArea = await prisma.area.create({
    data: {
      name: "General English",
      nameEs: "Inglés General",
      description: "Everyday vocabulary for common situations",
      sortOrder: 1,
    },
  });
  console.log("Area created:", generalArea.name);

  // Create Section 1: Daily Life
  const section1 = await prisma.section.create({
    data: {
      title: "Daily Life",
      titleEs: "Vida Cotidiana",
      description: "Essential vocabulary for everyday situations",
      sortOrder: 1,
      areaId: generalArea.id,
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

  // Practice questions (definition-focused, not reading-focused)
  const practiceQuestions = [
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "commute"?',
      sortOrder: 1,
      options: [
        { optionText: "Viajar regularmente entre el hogar y el trabajo", isCorrect: true },
        { optionText: "Comunicarse con otras personas", isCorrect: false },
        { optionText: "Calcular una operación matemática", isCorrect: false },
        { optionText: "Compartir algo con alguien", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "tomar rápidamente, agarrar"?',
      sortOrder: 2,
      options: [
        { optionText: "grab", isCorrect: true },
        { optionText: "stroll", isCorrect: false },
        { optionText: "commute", isCorrect: false },
        { optionText: "routine", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "My morning ___ includes breakfast and a shower.",
      correctAnswer: "routine",
      sortOrder: 3,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "stroll"?',
      sortOrder: 4,
      options: [
        { optionText: "Pasear, caminar de forma relajada", isCorrect: true },
        { optionText: "Correr a toda velocidad", isCorrect: false },
        { optionText: "Tropezar y caerse", isCorrect: false },
        { optionText: "Conducir un vehículo", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "hecho en casa, casero"?',
      sortOrder: 5,
      options: [
        { optionText: "homemade", isCorrect: true },
        { optionText: "commute", isCorrect: false },
        { optionText: "grab", isCorrect: false },
        { optionText: "stroll", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "Could you ___ me a glass of water from the kitchen?",
      correctAnswer: "grab",
      sortOrder: 6,
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

  // Test questions (definition-focused + new phonetics styles)
  const testQuestions = [
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "routine"?',
      sortOrder: 1,
      options: [
        { optionText: "Rutina, secuencia regular de actividades", isCorrect: true },
        { optionText: "Una actividad peligrosa", isCorrect: false },
        { optionText: "Un viaje largo e inesperado", isCorrect: false },
        { optionText: "Un tipo de comida rápida", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "We ___ through the neighborhood every Sunday morning.",
      correctAnswer: "stroll",
      sortOrder: 2,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "tomar rápidamente, agarrar"?',
      sortOrder: 3,
      options: [
        { optionText: "grab", isCorrect: true },
        { optionText: "stroll", isCorrect: false },
        { optionText: "commute", isCorrect: false },
        { optionText: "homemade", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which word is pronounced /kəˈmjuːt/?',
      sortOrder: 4,
      options: [
        { optionText: "commute", isCorrect: true },
        { optionText: "compute", isCorrect: false },
        { optionText: "commune", isCorrect: false },
        { optionText: "compete", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: "Which word does NOT rhyme with the others?",
      sortOrder: 5,
      options: [
        { optionText: "roll", isCorrect: false },
        { optionText: "stroll", isCorrect: false },
        { optionText: "doll", isCorrect: true },
        { optionText: "goal", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which word has the same vowel sound as the "a" in "grab"?',
      sortOrder: 6,
      options: [
        { optionText: "cat", isCorrect: true },
        { optionText: "gate", isCorrect: false },
        { optionText: "car", isCorrect: false },
        { optionText: "saw", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "My grandmother makes the best ___ pasta.",
      correctAnswer: "homemade",
      sortOrder: 7,
      options: [],
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
      areaId: generalArea.id,
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
      prompt: 'What is the definition of "dine"?',
      sortOrder: 1,
      options: [
        { optionText: "Cenar, comer formalmente", isCorrect: true },
        { optionText: "Cocinar rápidamente", isCorrect: false },
        { optionText: "Pedir comida para llevar", isCorrect: false },
        { optionText: "Lavar los platos después de comer", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "aperitivo, entrada"?',
      sortOrder: 2,
      options: [
        { optionText: "appetizer", isCorrect: true },
        { optionText: "attentive", isCorrect: false },
        { optionText: "special", isCorrect: false },
        { optionText: "scrumptious", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "The food at that restaurant was absolutely ___.",
      correctAnswer: "scrumptious",
      sortOrder: 3,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "attentive"?',
      sortOrder: 4,
      options: [
        { optionText: "Atento, servicial", isCorrect: true },
        { optionText: "Distraído, ausente", isCorrect: false },
        { optionText: "Molesto, irritado", isCorrect: false },
        { optionText: "Cansado, agotado", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "especial del día, plato especial"?',
      sortOrder: 5,
      options: [
        { optionText: "special", isCorrect: true },
        { optionText: "dine", isCorrect: false },
        { optionText: "appetizer", isCorrect: false },
        { optionText: "scrumptious", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "We decided to ___ at the new Italian place downtown.",
      correctAnswer: "dine",
      sortOrder: 6,
      options: [],
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
      prompt: 'What is the definition of "appetizer"?',
      sortOrder: 1,
      options: [
        { optionText: "Aperitivo, entrada", isCorrect: true },
        { optionText: "Postre, dulce", isCorrect: false },
        { optionText: "Bebida alcohólica", isCorrect: false },
        { optionText: "Plato principal", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "We ___ at an elegant restaurant to celebrate her birthday.",
      correctAnswer: "dined",
      sortOrder: 2,
      options: [],
    },
    {
      type: "phonetics",
      prompt: 'Which word is pronounced /ˈæpɪˌtaɪzər/?',
      sortOrder: 3,
      options: [
        { optionText: "appetizer", isCorrect: true },
        { optionText: "advertiser", isCorrect: false },
        { optionText: "appetizing", isCorrect: false },
        { optionText: "apologize", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "delicioso, exquisito"?',
      sortOrder: 4,
      options: [
        { optionText: "scrumptious", isCorrect: true },
        { optionText: "attentive", isCorrect: false },
        { optionText: "special", isCorrect: false },
        { optionText: "appetizer", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: "Which word does NOT rhyme with the others?",
      sortOrder: 5,
      options: [
        { optionText: "fine", isCorrect: false },
        { optionText: "dine", isCorrect: false },
        { optionText: "den", isCorrect: true },
        { optionText: "wine", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: 'Which word has the same vowel sound as the "e" in "special"?',
      sortOrder: 6,
      options: [
        { optionText: "bed", isCorrect: true },
        { optionText: "bead", isCorrect: false },
        { optionText: "bird", isCorrect: false },
        { optionText: "bide", isCorrect: false },
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

  // Create second Area: Family & Relationships
  const familyArea = await prisma.area.create({
    data: {
      name: "Family & Relationships",
      nameEs: "Familia y Relaciones",
      description: "Vocabulary about family, friends, and social bonds",
      imageUrl: "👥",
      sortOrder: 2,
    },
  });
  console.log("Area created:", familyArea.name);

  // Create Section: Basic Family Members
  const familySection = await prisma.section.create({
    data: {
      title: "Basic Family Members",
      titleEs: "Miembros Básicos de la Familia",
      description: "Learn the names of close family members",
      imageUrl: "👨‍👩‍👧‍👦",
      sortOrder: 1,
      areaId: familyArea.id,
      modules: {
        create: [
          {
            type: "introduction",
            content: {
              readingTitle: "Meet the Johnsons",
              readingText:
                "The Johnson family is quite large. Mr. Johnson is the **father** of three children. His **wife**, Mrs. Johnson, works as a teacher. Their oldest **daughter**, Emily, is in college. Their **son**, Jake, plays soccer at school. The youngest is little Sophie, who loves her **grandmother** very much. Every Sunday, the whole family gathers at the **grandparents'** house for dinner.",
            },
          },
          { type: "practice" },
          { type: "test" },
        ],
      },
    },
    include: { modules: true },
  });

  const familyVocab = [
    {
      word: "father",
      partOfSpeech: "noun",
      definitionEs: "Padre, papá",
      exampleSentence: "My father taught me how to ride a bike.",
      phoneticIpa: "/ˈfɑːðər/",
      stressedSyllable: "fa",
    },
    {
      word: "wife",
      partOfSpeech: "noun",
      definitionEs: "Esposa",
      exampleSentence: "He introduced his wife to the guests.",
      phoneticIpa: "/waɪf/",
      stressedSyllable: "wife",
    },
    {
      word: "daughter",
      partOfSpeech: "noun",
      definitionEs: "Hija",
      exampleSentence: "Their daughter graduated with honors.",
      phoneticIpa: "/ˈdɔːtər/",
      stressedSyllable: "daugh",
    },
    {
      word: "son",
      partOfSpeech: "noun",
      definitionEs: "Hijo",
      exampleSentence: "Their son wants to become an engineer.",
      phoneticIpa: "/sʌn/",
      stressedSyllable: "son",
    },
    {
      word: "grandmother",
      partOfSpeech: "noun",
      definitionEs: "Abuela",
      exampleSentence: "My grandmother tells the best stories.",
      phoneticIpa: "/ˈɡrænˌmʌðər/",
      stressedSyllable: "grand",
    },
  ];

  for (let i = 0; i < familyVocab.length; i++) {
    const v = familyVocab[i];
    await prisma.vocabulary.create({
      data: {
        ...v,
        sectionVocabulary: {
          create: { sectionId: familySection.id, sortOrder: i + 1 },
        },
      },
    });
  }

  const familyPracticeModule = familySection.modules.find((m) => m.type === "practice")!;
  const familyTestModule = familySection.modules.find((m) => m.type === "test")!;

  const familyPracticeQuestions = [
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "father"?',
      sortOrder: 1,
      options: [
        { optionText: "Padre, papá", isCorrect: true },
        { optionText: "Hermano mayor", isCorrect: false },
        { optionText: "Tío paterno", isCorrect: false },
        { optionText: "Abuelo", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "esposa"?',
      sortOrder: 2,
      options: [
        { optionText: "wife", isCorrect: true },
        { optionText: "daughter", isCorrect: false },
        { optionText: "grandmother", isCorrect: false },
        { optionText: "son", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "Their ___ Emily is studying medicine at university.",
      correctAnswer: "daughter",
      sortOrder: 3,
      options: [],
    },
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "son"?',
      sortOrder: 4,
      options: [
        { optionText: "Hijo", isCorrect: true },
        { optionText: "Sobrino", isCorrect: false },
        { optionText: "Primo", isCorrect: false },
        { optionText: "Padre", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "abuela"?',
      sortOrder: 5,
      options: [
        { optionText: "grandmother", isCorrect: true },
        { optionText: "wife", isCorrect: false },
        { optionText: "daughter", isCorrect: false },
        { optionText: "father", isCorrect: false },
      ],
    },
  ];

  for (const q of familyPracticeQuestions) {
    await prisma.question.create({
      data: {
        moduleId: familyPracticeModule.id,
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

  const familyTestQuestions = [
    {
      type: "multiple_choice",
      prompt: 'What is the definition of "wife"?',
      sortOrder: 1,
      options: [
        { optionText: "Esposa", isCorrect: true },
        { optionText: "Hermana", isCorrect: false },
        { optionText: "Hija", isCorrect: false },
        { optionText: "Madre", isCorrect: false },
      ],
    },
    {
      type: "fill_blank",
      prompt: "My ___ always bakes cookies when we visit her.",
      correctAnswer: "grandmother",
      sortOrder: 2,
      options: [],
    },
    {
      type: "phonetics",
      prompt: 'Which word is pronounced /ˈdɔːtər/?',
      sortOrder: 3,
      options: [
        { optionText: "daughter", isCorrect: true },
        { optionText: "doctor", isCorrect: false },
        { optionText: "dollar", isCorrect: false },
        { optionText: "darker", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      prompt: 'Which English word means "hijo"?',
      sortOrder: 4,
      options: [
        { optionText: "son", isCorrect: true },
        { optionText: "father", isCorrect: false },
        { optionText: "wife", isCorrect: false },
        { optionText: "grandmother", isCorrect: false },
      ],
    },
    {
      type: "phonetics",
      prompt: "Which word does NOT rhyme with the others?",
      sortOrder: 5,
      options: [
        { optionText: "fun", isCorrect: false },
        { optionText: "son", isCorrect: false },
        { optionText: "run", isCorrect: false },
        { optionText: "soon", isCorrect: true },
      ],
    },
  ];

  for (const q of familyTestQuestions) {
    await prisma.question.create({
      data: {
        moduleId: familyTestModule.id,
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

  // Unlock family section for learner
  await prisma.learnerSectionProgress.upsert({
    where: {
      userId_sectionId: {
        userId: learner.id,
        sectionId: familySection.id,
      },
    },
    update: {},
    create: {
      userId: learner.id,
      sectionId: familySection.id,
      unlocked: true,
      unlockedAt: new Date(),
    },
  });

  // Seed recent completions to trigger "Hot Topic" on General English
  const recentDates = [
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  ];

  for (const date of recentDates) {
    await prisma.learnerAttempt.create({
      data: {
        userId: learner.id,
        moduleId: practiceModule1.id,
        score: 80 + Math.floor(Math.random() * 20),
        passed: true,
        startedAt: date,
        completedAt: date,
      },
    });
  }
  console.log("Seeded 4 recent completions for Hot Topic demo");

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
