import { z } from "zod";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "unknown"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const estimateRequestSchema = z.object({
  mealDescription: z.string().min(1).max(2_000).transform((s) => s.trim()),
  consumedAt: z.string().datetime({ offset: true }).optional(),
});

/** Strict schema for AI JSON output — reject malformed responses. */
export const nutritionEstimateSchema = z.object({
  originalDescription: z.string().min(1).max(2_000),
  normalizedDescription: z.string().min(1).max(2_000),
  mealType: z.enum(MEAL_TYPES),
  calories: z.number().int().min(0).max(20_000),
  proteinG: z.number().min(0).max(2_000),
  carbsG: z.number().min(0).max(2_000),
  fatG: z.number().min(0).max(2_000),
  fiberG: z.number().min(0).max(500).nullable().optional(),
  sugarG: z.number().min(0).max(500).nullable().optional(),
  sodiumMg: z.number().int().min(0).max(50_000).nullable().optional(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  assumptions: z.array(z.string().min(1).max(500)).min(1).max(20),
  sourceType: z.string().min(1).max(120),
});

export type NutritionEstimate = z.infer<typeof nutritionEstimateSchema>;

export const saveEntrySchema = z.object({
  originalDescription: z.string().min(1).max(2_000),
  normalizedDescription: z.string().min(1).max(2_000),
  mealType: z.enum(MEAL_TYPES),
  consumedAt: z.string().datetime({ offset: true }),
  calories: z.number().int().min(0).max(20_000),
  proteinG: z.number().min(0).max(2_000),
  carbsG: z.number().min(0).max(2_000),
  fatG: z.number().min(0).max(2_000),
  fiberG: z.number().min(0).max(500).nullable().optional(),
  sugarG: z.number().min(0).max(500).nullable().optional(),
  sodiumMg: z.number().int().min(0).max(50_000).nullable().optional(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  assumptions: z.array(z.string().min(1).max(500)).min(1).max(20),
  sourceType: z.string().min(1).max(120),
  aiProvider: z.string().max(40).nullable().optional(),
  aiModel: z.string().max(80).nullable().optional(),
  userEdited: z.boolean().optional().default(false),
});

export const updateEntrySchema = saveEntrySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field required" }
);

export const nutritionTargetsSchema = z.object({
  calorieTarget: z.number().int().min(500).max(10_000).optional(),
  proteinTargetG: z.number().min(0).max(1_000).optional(),
  carbsTargetG: z.number().min(0).max(2_000).optional(),
  fatTargetG: z.number().min(0).max(500).optional(),
  fiberTargetG: z.number().min(0).max(200).optional(),
});

export type NutritionTargets = {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
};

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calorieTarget: 2200,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 70,
  fiberTargetG: 30,
};

export const dateRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Extract first JSON object from model text (handles markdown fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return JSON.parse(objMatch[0]);
  }
  throw new Error("No JSON object found in AI response");
}

export const NUTRITION_SYSTEM_PROMPT = `You are a nutrition-estimation assistant. Estimate calories and macronutrients from a user's natural-language meal description. Prefer official restaurant nutrition information when a recognizable restaurant and menu item are provided. For generic foods, use conventional serving sizes and reputable nutritional reference values. Never pretend an estimate is exact. Clearly identify assumptions and uncertainty. Return only valid JSON matching the supplied schema. All calorie and macro totals must represent the entire described meal, not an individual ingredient.

Do not provide medical advice, diagnose eating disorders, or recommend extreme calorie restriction.

Return ONLY a JSON object with these exact keys:
{
  "originalDescription": string,
  "normalizedDescription": string,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"unknown",
  "calories": integer,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number|null,
  "sugarG": number|null,
  "sodiumMg": integer|null,
  "confidence": "low"|"medium"|"high",
  "assumptions": string[],
  "sourceType": string
}`;
