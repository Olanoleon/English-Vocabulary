/**
 * AI Logo Generation using OpenAI DALL-E
 * Generates minimal flat icons and returns them as base64 data URLs.
 */

function getOpenAIKey(): string {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(
      /^OPENAI_API_KEY=["']?([^"'\r\n]+)["']?/m
    );
    if (match?.[1]) return match[1];
  } catch {
    /* fallback */
  }
  return process.env.OPENAI_API_KEY || "";
}

/**
 * Generate a minimal flat icon for a given name using DALL-E.
 * Returns a data:image/png;base64,... string, or null on failure.
 */
export async function generateLogo(name: string): Promise<string | null> {
  const https = require("https");
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    console.warn("No OpenAI API key — skipping logo generation");
    return null;
  }

  const prompt = `A minimal flat vector icon representing "${name}" for an educational app. White background, simple geometric shapes, clean lines, single centered symbol, app icon style. No text, no letters, no words.`;

  const payload = JSON.stringify({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
    quality: "standard",
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/images/generations",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res: import("http").IncomingMessage) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode !== 200) {
              console.warn(
                "DALL-E error:",
                data?.error?.message || res.statusCode
              );
              resolve(null);
              return;
            }
            const b64 = data?.data?.[0]?.b64_json;
            if (b64) {
              resolve(`data:image/png;base64,${b64}`);
            } else {
              resolve(null);
            }
          } catch {
            console.warn("Failed to parse DALL-E response");
            resolve(null);
          }
        });
      }
    );
    req.on("error", (e: Error) => {
      console.warn("DALL-E network error:", e.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}
