/**
 * Icon matching for Areas and Units.
 * Legacy emoji matching is kept for backward compatibility, but now we
 * normalize most matches to curated in-app icon tokens.
 */

const EMOJI_MAP: [string[], string][] = [
  // Education & Learning
  [["education", "study", "learn", "academic", "university", "college", "exam", "student"], "🎓"],
  [["school", "classroom", "supply", "supplies", "item", "stationery", "pencil", "notebook", "backpack", "eraser"], "✏️"],
  [["book", "read", "literature", "library", "novel", "story"], "📚"],
  [["write", "writing", "essay", "pen", "author"], "✍️"],
  [["language", "linguistics", "grammar", "bilingual", "polyglot", "spanish", "french", "german"], "🗣️"],
  [["math", "mathematics", "calcul", "algebra", "geometry", "number"], "🔢"],
  [["science", "research", "experiment", "laboratory", "lab"], "🔬"],
  [["history", "ancient", "heritage", "past", "civilization"], "🏛️"],
  [["geography", "map", "world", "country", "continent"], "🌍"],
  [["art", "paint", "drawing", "creative", "gallery", "museum"], "🎨"],
  [["music", "song", "instrument", "melody", "concert", "band"], "🎵"],
  [["philosophy", "think", "ethics", "logic", "wisdom"], "🤔"],

  // Professional Fields
  [["mechanical engineering", "engineer", "mechanical", "gear", "machine", "manufacturing"], "⚙️"],
  [["software engineering", "software", "programming", "code", "developer", "computer", "tech", "digital"], "💻"],
  [["data", "analytics", "statistics", "database"], "📊"],
  [["architect", "blueprint", "building", "construct", "structure"], "🏗️"],
  [["electric", "electron", "circuit", "energy", "power", "voltage"], "⚡"],
  [["chemical", "chemistry", "molecule", "atom", "element"], "⚗️"],
  [["human body", "body", "anatomy", "body part", "physiology", "skeletal", "muscular"], "🫀"],
  [["extremit", "arm", "leg", "hand", "foot", "finger", "toe", "knee", "elbow", "wrist", "ankle", "shoulder", "limb"], "💪"],
  [["mouth", "lip", "lips", "tongue", "gum", "gums", "palate", "teeth", "tooth", "oral", "dental", "jaw", "saliva"], "👄"],
  [["head", "face", "eye", "ear", "nose", "chin", "forehead", "cheek", "skull", "brow", "eyelid", "nostril", "temple"], "🗣️"],
  [["sore", "pain", "ache", "headache", "stomachache", "fever", "cough", "cold", "flu", "injury", "wound", "bruise", "symptom", "illness", "sick"], "🤒"],
  [["organ", "heart", "lung", "liver", "kidney", "stomach", "intestin", "brain", "spleen", "pancrea", "bladder", "internal"], "🫁"],
  [["doctor", "medical", "health", "hospital", "patient", "clinic", "healthcare"], "🩺"],
  [["nurse", "nursing", "care", "caregiver"], "👩‍⚕️"],
  [["pharmacy", "medicine", "drug", "pill", "treatment"], "💊"],
  [["dentist", "dental", "tooth", "teeth"], "🦷"],
  [["psychology", "mental", "therapy", "counsel", "mind", "brain"], "🧠"],
  [["law", "legal", "court", "justice", "attorney", "lawyer", "judge"], "⚖️"],
  [["business", "corporate", "company", "enterprise", "management"], "💼"],
  [["finance", "bank", "money", "invest", "stock", "economy", "economic"], "💰"],
  [["account", "audit", "tax", "bookkeep", "fiscal"], "🧾"],
  [["market", "advertising", "brand", "promotion", "sales", "commerce"], "📈"],
  [["entrepreneur", "startup", "founder", "venture"], "🚀"],
  [["teach", "teacher", "instructor", "professor", "tutor", "pedagog"], "👩‍🏫"],
  [["journalist", "news", "media", "press", "report"], "📰"],
  [["design", "graphic", "visual", "ui", "ux", "interface"], "🎯"],
  [["photograph", "camera", "photo", "image", "picture"], "📷"],
  [["film", "movie", "cinema", "video", "direct"], "🎬"],

  // Science & Nature
  [["biology", "life", "organism", "cell", "genetic", "dna"], "🧬"],
  [["physics", "quantum", "relativity", "force", "gravity"], "🔭"],
  [["astronomy", "space", "star", "planet", "universe", "cosmos", "nasa"], "🌌"],
  [["environment", "ecology", "climate", "green", "sustain", "recycle"], "🌱"],
  [["bird", "parrot", "eagle", "owl", "penguin", "sparrow", "pigeon", "feather", "nest", "wing"], "🐦"],
  [["domestic", "dog", "cat", "horse", "cow", "pig", "sheep", "goat", "donkey", "rabbit", "hamster", "pet", "farm", "livestock", "barn"], "🐕"],
  [["wild", "lion", "tiger", "bear", "elephant", "giraffe", "zebra", "deer", "wolf", "fox", "jungle", "safari", "predator", "prey", "mammal", "creature"], "🦁"],
  [["animal", "wildlife", "zoo", "fauna", "species", "veterinar"], "🐾"],
  [["plant", "garden", "flower", "botan", "flora", "tree", "forest"], "🌿"],
  [["fish", "salmon", "tuna", "trout", "shark", "whale", "dolphin", "aquarium", "fishing", "angler"], "🐟"],
  [["ocean", "marine", "sea", "underwater", "aqua"], "🌊"],
  [["weather", "meteorolog", "storm", "rain", "forecast"], "🌤️"],
  [["geology", "rock", "mineral", "earthquake", "volcano"], "🪨"],

  // Daily Life & Culture
  [["vegetable", "veggie", "fruit", "meat", "chicken", "beef", "pork", "fish", "seafood", "dish", "ingredient", "grocery", "groceries", "produce"], "🥗"],
  [["food", "cook", "recipe", "kitchen", "meal", "chef", "culinar", "gastronom", "bake", "fry", "grill", "roast"], "🍳"],
  [["utensil", "spoon", "fork", "knife", "cutlery", "cuttlery", "plate", "cup", "glass", "bowl", "pot", "pan", "shaker", "kitchenware", "tableware", "napkin", "tray"], "🍽️"],
  [["restaurant", "dine", "dining", "eat", "menu", "waiter", "order", "reservation", "bistro", "cafe"], "🧑‍🍳"],
  [["travel", "trip", "tour", "vacation", "holiday", "journey", "adventure"], "✈️"],
  [["hotel", "accommodation", "lodging", "hostel", "resort"], "🏨"],
  [["airport", "flight", "airline", "boarding", "passport"], "🛫"],
  [["transport", "traffic", "commut", "bus", "train", "subway", "metro"], "🚆"],
  [["car", "drive", "automotive", "vehicle", "motor"], "🚗"],
  [["shop", "store", "retail", "buy", "purchase", "mall"], "🛍️"],
  [["fashion", "cloth", "wear", "dress", "style", "outfit", "apparel"], "👗"],
  [["home", "house", "domestic", "household", "family", "furniture"], "🏠"],
  [["daily", "routine", "everyday", "general", "common"], "📅"],
  [["sport", "exercise", "fitness", "gym", "athlet", "workout", "train"], "🏋️"],
  [["soccer", "football", "goal", "match", "league"], "⚽"],
  [["basketball", "court", "dunk", "nba"], "🏀"],
  [["swim", "pool", "water sport"], "🏊"],
  [["game", "play", "hobby", "recreation", "entertain", "leisure", "fun"], "🎮"],
  [["party", "celebrat", "festival", "event", "occasion"], "🎉"],
  [["friend", "social", "relationship", "people", "communit"], "👥"],
  [["love", "romance", "dating", "valentine", "heart"], "❤️"],
  [["pet", "dog", "cat", "puppy", "kitten"], "🐕"],
  [["movie", "theater", "show", "perform", "stage", "drama"], "🎭"],
  [["phone", "mobile", "call", "text", "message", "chat", "communication"], "📱"],
  [["internet", "web", "online", "social media", "network"], "🌐"],
  [["email", "mail", "letter", "correspond", "postal"], "📧"],

  // Work & Office
  [["work", "job", "career", "profession", "occupation", "employ"], "👔"],
  [["office", "desk", "workspace", "cubicle", "corporate"], "🏢"],
  [["meeting", "conference", "present", "seminar", "workshop"], "📋"],
  [["interview", "hire", "recruit", "resume", "cv", "application"], "🤝"],
  [["project", "plan", "manage", "organiz", "team", "lead"], "📌"],

  // Health & Wellness
  [["yoga", "meditat", "mindful", "relax", "zen", "calm"], "🧘"],
  [["nutrition", "diet", "vitamin", "supplement", "healthy eating"], "🥗"],
  [["sleep", "rest", "dream", "insomnia", "nap"], "😴"],

  // Places & Locations
  [["city", "urban", "downtown", "metropol"], "🏙️"],
  [["country", "rural", "village", "farm", "agricult"], "🌾"],
  [["beach", "coast", "shore", "island", "tropical"], "🏖️"],
  [["mountain", "hike", "climb", "trail", "outdoor"], "⛰️"],
  [["park", "garden", "nature", "picnic", "walk", "stroll"], "🌳"],

  // Emergency & Safety
  [["emergency", "ambulance", "fire", "rescue", "disaster", "safety"], "🚨"],
  [["police", "security", "crime", "protect", "guard"], "🚔"],

  // Miscellaneous
  [["time", "clock", "schedule", "calendar", "appointment", "deadline"], "⏰"],
  [["money", "currency", "price", "cost", "budget", "expense", "payment"], "💵"],
  [["contract", "agreement", "document", "paper", "form", "sign"], "📝"],
  [["tool", "repair", "fix", "maintain", "handyman", "diy"], "🔧"],
  [["test", "exam", "quiz", "assessment", "evaluation"], "📝"],
  [["success", "achievement", "goal", "win", "award", "trophy"], "🏆"],
  [["problem", "solution", "puzzle", "challenge", "difficult"], "🧩"],
  [["idea", "innovation", "invent", "discover", "creative", "inspiration"], "💡"],
];

const DEFAULT_EMOJI = "📘";

const EMOJI_TO_ICON_TOKEN: Record<string, string> = {
  "🎓": "icon:graduation-cap",
  "✏️": "icon:pencil",
  "📚": "icon:book-open",
  "✍️": "icon:pen",
  "🗣️": "icon:languages",
  "🔢": "icon:calculator",
  "🔬": "icon:flask-round",
  "🏛️": "icon:landmark",
  "🌍": "icon:globe",
  "🎨": "icon:palette",
  "🎵": "icon:music",
  "🤔": "icon:brain",
  "⚙️": "icon:settings",
  "💻": "icon:laptop",
  "📊": "icon:chart-column",
  "🏗️": "icon:hard-hat",
  "⚡": "icon:zap",
  "⚗️": "icon:beaker",
  "🫀": "icon:heart-pulse",
  "💪": "icon:armchair",
  "👄": "icon:smile",
  "🤒": "icon:cross",
  "🫁": "icon:heart-pulse",
  "🩺": "icon:stethoscope",
  "👩‍⚕️": "icon:stethoscope",
  "💊": "icon:pill",
  "🦷": "icon:cross",
  "🧠": "icon:brain",
  "⚖️": "icon:scale",
  "💼": "icon:briefcase",
  "💰": "icon:coins",
  "🧾": "icon:receipt",
  "📈": "icon:trending-up",
  "🚀": "icon:rocket",
  "👩‍🏫": "icon:graduation-cap",
  "📰": "icon:newspaper",
  "🎯": "icon:target",
  "📷": "icon:camera",
  "🎬": "icon:film",
  "🧬": "icon:dna",
  "🔭": "icon:telescope",
  "🌌": "icon:stars",
  "🌱": "icon:leaf",
  "🐦": "icon:bird",
  "🐕": "icon:paw-print",
  "🦁": "icon:shield",
  "🐾": "icon:paw-print",
  "🌿": "icon:leaf",
  "🐟": "icon:fish",
  "🌊": "icon:waves",
  "🌤️": "icon:sun",
  "🪨": "icon:mountain",
  "🥗": "icon:apple",
  "🍳": "icon:utensils",
  "🍽️": "icon:utensils",
  "🧑‍🍳": "icon:chef-hat",
  "✈️": "icon:plane",
  "🏨": "icon:building",
  "🛫": "icon:plane",
  "🚆": "icon:train",
  "🚗": "icon:car",
  "🛍️": "icon:shopping-bag",
  "👗": "icon:shirt",
  "🏠": "icon:house",
  "📅": "icon:calendar-days",
  "🏋️": "icon:dumbbell",
  "⚽": "icon:goal",
  "🏀": "icon:circle",
  "🏊": "icon:waves",
  "🎮": "icon:gamepad-2",
  "🎉": "icon:party-popper",
  "👥": "icon:users",
  "❤️": "icon:heart",
  "🎭": "icon:masks",
  "📱": "icon:smartphone",
  "🌐": "icon:globe",
  "📧": "icon:mail",
  "👔": "icon:briefcase",
  "🏢": "icon:building",
  "📋": "icon:clipboard-list",
  "🤝": "icon:handshake",
  "📌": "icon:folder-kanban",
  "🧘": "icon:flower-2",
  "😴": "icon:moon-star",
  "🏙️": "icon:building-2",
  "🌾": "icon:sprout",
  "🏖️": "icon:palmtree",
  "⛰️": "icon:mountain",
  "🌳": "icon:trees",
  "🚨": "icon:siren",
  "🚔": "icon:shield",
  "⏰": "icon:clock-3",
  "💵": "icon:banknote",
  "📝": "icon:file-pen-line",
  "🔧": "icon:wrench",
  "🏆": "icon:trophy",
  "🧩": "icon:puzzle",
  "💡": "icon:lightbulb",
  "📘": "icon:book-open",
};

/**
 * Match a name to the best emoji from the curated bank.
 * Searches for keyword matches in the name (case-insensitive).
 */
export function matchEmoji(name: string): string {
  const lower = name.toLowerCase();

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [keywords, emoji] of EMOJI_MAP) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches are weighted higher (more specific)
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = emoji;
    }
  }

  const matched = bestMatch || DEFAULT_EMOJI;
  return EMOJI_TO_ICON_TOKEN[matched] || matched;
}
