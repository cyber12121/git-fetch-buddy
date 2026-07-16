import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import {
  GEMINI_FETCH_TIMEOUT_MS,
  MAX_RAW_TEXT_LENGTH,
  RATE_MAX,
  RATE_WINDOW_MS,
} from "./constants";

// Lightweight in-memory rate limiter. Buckets expire after the window; in a
// serverless environment this is per-instance rather than global, but it still
// catches rapid bursts from the same client.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

function cleanupBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(ip);
  }
}

setInterval(cleanupBuckets, RATE_WINDOW_MS);

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "goblin-flow-tools" },
      },
    });
  }
  return aiClient;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API timed out")), GEMINI_FETCH_TIMEOUT_MS)
    );
    return await Promise.race([fn(), timeout]);
  } catch (error: unknown) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

interface CompiledTask {
  title: string;
  priority: "low" | "medium" | "high";
  notes?: string;
}

const compileSchema = z.object({
  rawText: z.string().min(1).max(MAX_RAW_TEXT_LENGTH),
});

export const compileBrainDump = createServerFn({ method: "POST" })
  .inputValidator((data) => compileSchema.parse(data))
  .handler(async ({ data }) => {
    const ip = "anonymous";
    if (isRateLimited(ip)) {
      throw new Error("Whoa, too many requests! Take a cozy breath and try again in a moment.");
    }

    const ai = getGeminiClient();
    if (!ai) {
      return { tasks: heuristicCompile(data.rawText), isMock: true };
    }

    try {
      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `You are Sprig, a warm, cozy goblin companion who helps ADHD brains de-clutter their thoughts. 
Please organize and compile the following messy brain dump stream of thoughts into a list of separate, distinct, action-oriented, and manageable tasks.
For each task:
1. Suggest a 'priority' level: 'low' (low friction, quick, easy), 'medium' (takes some focus, mild dread), or 'high' (highly intimidating, big project, high friction/emotional weight).
2. Extract or summarize short, helpful context notes.

Raw brain dump text:
"${data.rawText}"`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description:
                          "An action-oriented task title (e.g., 'Draft email to boss' instead of 'work stuff'). Make it clean and approachable.",
                      },
                      priority: {
                        type: Type.STRING,
                        description:
                          "Suggested effort/dread/priority level. Must be 'low', 'medium', or 'high' only.",
                      },
                      notes: {
                        type: Type.STRING,
                        description:
                          "A short, sweet note or context extracted from the dump explaining why this task is listed or offering a tip.",
                      },
                    },
                    required: ["title", "priority"],
                  },
                },
              },
              required: ["tasks"],
            },
          },
        })
      );

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }
      const result = JSON.parse(text);
      return { tasks: (result.tasks || []) as CompiledTask[], isMock: false };
    } catch (error: unknown) {
      console.error("Gemini compilation error, switching to fallback:", error);
      return {
        tasks: heuristicCompile(data.rawText),
        isMock: true,
        fallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
  });

function heuristicCompile(rawText: string): CompiledTask[] {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.\s]+/, "").trim())
    .filter((line) => line.length > 5);

  if (lines.length === 0) {
    lines.push(rawText.trim().substring(0, 100));
  }

  const priorityOptions: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
  return lines.map((line, i) => ({
    title: line.length > 80 ? line.substring(0, 80) + "..." : line,
    priority: priorityOptions[Math.min(i % 3, 2)],
    notes: "De-cluttered from your brain dump. You got this!",
  }));
}

const breakdownSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const breakdownTask = createServerFn({ method: "POST" })
  .inputValidator((data) => breakdownSchema.parse(data))
  .handler(async ({ data }) => {
    const ip = "anonymous";
    if (isRateLimited(ip)) {
      throw new Error("Whoa, too many requests! Take a cozy breath and try again in a moment.");
    }

    const ai = getGeminiClient();
    if (!ai) {
      return { steps: fallbackSteps(data.title), isMock: true };
    }

    try {
      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `You are Sprig, a warm, loving goblin friend helping someone with ADHD who feels overwhelmed.
The user needs to break down this major task because it feels too heavy, is a high priority, or intimidating:
Task Title: "${data.title}"
Task Priority Level: "${data.priority}"

Provide exactly 4 to 6 micro-steps to accomplish it.
Rules for the micro-steps:
- Make them incredibly simple, tiny, and low-friction (e.g., 'Open the document', 'Write just one sentence', 'Close the tab and stretch').
- The first step MUST be a 'micro-start' (takes less than 30 seconds, basically zero cognitive load).
- Keep the tone sweet, understanding, and encouraging. No dry corporate list items!`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                    description: "A single ultra-approachable, small step.",
                  },
                },
              },
              required: ["steps"],
            },
          },
        })
      );

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }
      const result = JSON.parse(text);
      return { steps: (result.steps || []) as string[], isMock: false };
    } catch (error: unknown) {
      console.error("Gemini breakdown error, switching to fallback:", error);
      return {
        steps: fallbackSteps(data.title),
        isMock: true,
        fallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
  });

function fallbackSteps(title: string): string[] {
  return [
    `Take a deep breath. Let's look at "${title}" for just 10 seconds. No pressure to start!`,
    `Do the absolute smallest first movement related to "${title}" (e.g., open a blank page, set up your space, or grab tools).`,
    `Set a cozy timer for literally 5-10 minutes. Tell yourself you are allowed to stop once it rings.`,
    `Work on "${title}" at a gentle, steady pace. You are doing wonderfully!`,
    `Celebrate making progress on "${title}"! Grab a warm snack 🍪 or take a cozy stretch.`,
  ];
}
