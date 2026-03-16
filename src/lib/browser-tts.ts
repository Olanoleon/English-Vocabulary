let cachedVoice: SpeechSynthesisVoice | null = null;
let voicePromise: Promise<SpeechSynthesisVoice | null> | null = null;

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();

  let score = 0;
  if (lang.startsWith("en-us")) score += 60;
  else if (lang.startsWith("en-gb")) score += 45;
  else if (lang.startsWith("en-")) score += 30;

  if (name.includes("neural")) score += 50;
  if (name.includes("siri")) score += 40;
  if (name.includes("aria")) score += 35;
  if (name.includes("jenny")) score += 30;
  if (name.includes("google")) score += 28;
  if (name.includes("gemini")) score += 28;
  if (name.includes("gpt")) score += 28;
  if (name.includes("enhanced")) score += 20;
  if (name.includes("premium")) score += 20;
  if (voice.localService) score += 8;

  return score;
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const ranked = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));

  return ranked[0] || null;
}

async function getBestVoice(): Promise<SpeechSynthesisVoice | null> {
  if (!("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;
  if (voicePromise) return voicePromise;

  const immediate = pickBestVoice();
  if (immediate) {
    cachedVoice = immediate;
    return immediate;
  }

  voicePromise = new Promise((resolve) => {
    const synthesis = window.speechSynthesis;
    const onVoicesChanged = () => {
      const candidate = pickBestVoice();
      if (candidate) {
        cachedVoice = candidate;
      }
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(candidate);
    };
    synthesis.addEventListener("voiceschanged", onVoicesChanged);
    window.setTimeout(() => {
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      const fallback = pickBestVoice();
      if (fallback) {
        cachedVoice = fallback;
      }
      resolve(fallback);
    }, 1000);
  });

  const resolved = await voicePromise;
  voicePromise = null;
  return resolved;
}

export function cancelSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function stripMarkdownForTts(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_]+)_/g, "$1$2")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function speakSmart(text: string) {
  if (!("speechSynthesis" in window)) return;
  const clean = stripMarkdownForTts(text);
  if (!clean) return;

  const voice = await getBestVoice();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}
