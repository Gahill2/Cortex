import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import {
  estimateNutrition,
  localDateTimeIso,
  saveNutritionEntry,
  type NutritionEstimate,
} from "../../api/nutrition";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";

type Props = {
  onSaved: () => void;
};

type Step = "log" | "review";

const emptyReview = (): NutritionEstimate & { consumedAt: string; aiProvider?: string; aiModel?: string } => ({
  originalDescription: "",
  normalizedDescription: "",
  mealType: "unknown",
  consumedAt: localDateTimeIso(),
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
  sugarG: null,
  sodiumMg: null,
  confidence: "medium",
  assumptions: [],
  sourceType: "",
});

export function NutritionQuickLog({ onSaved }: Props) {
  const speech = useSpeechRecognition();
  const [step, setStep] = useState<Step>("log");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(emptyReview());
  const baselineRef = useRef<NutritionEstimate | null>(null);

  useEffect(() => {
    if (speech.transcript) setDescription(speech.transcript);
  }, [speech.transcript]);

  const onEstimate = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = description.trim();
    if (!text) {
      setError("Describe your meal first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const consumedAt = localDateTimeIso();
      const estimate = await estimateNutrition(text, consumedAt);
      baselineRef.current = estimate;
      setReview({
        ...estimate,
        consumedAt,
        aiProvider: estimate.aiProvider,
        aiModel: estimate.aiModel,
      });
      setStep("review");
    } catch (err) {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      setError(ax.response?.data?.error?.message ?? "Could not estimate nutrition. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseline = baselineRef.current;
      const userEdited =
        baseline != null &&
        (review.calories !== baseline.calories ||
          review.proteinG !== baseline.proteinG ||
          review.carbsG !== baseline.carbsG ||
          review.fatG !== baseline.fatG ||
          (review.fiberG ?? 0) !== (baseline.fiberG ?? 0) ||
          review.normalizedDescription !== baseline.normalizedDescription);

      await saveNutritionEntry({
        ...review,
        userEdited,
      });
      setStep("log");
      setDescription("");
      speech.setTranscript("");
      baselineRef.current = null;
      setReview(emptyReview());
      onSaved();
    } catch {
      setError("Could not save entry.");
    } finally {
      setLoading(false);
    }
  };

  const onCancelReview = () => {
    setStep("log");
    setError(null);
  };

  if (step === "review") {
    return (
      <section className="nutrition-card">
        <h2 className="nutrition-card__title">Review estimate</h2>
        <p className="nutrition-muted">{review.normalizedDescription}</p>
        <div className={`nutrition-confidence nutrition-confidence--${review.confidence}`}>
          Confidence: <strong>{review.confidence}</strong>
        </div>
        <ul className="nutrition-assumptions">
          {review.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <div className="nutrition-review-grid">
          {([
            ["calories", "Calories", review.calories, (v: number) => setReview({ ...review, calories: v })],
            ["proteinG", "Protein (g)", review.proteinG, (v: number) => setReview({ ...review, proteinG: v })],
            ["carbsG", "Carbs (g)", review.carbsG, (v: number) => setReview({ ...review, carbsG: v })],
            ["fatG", "Fat (g)", review.fatG, (v: number) => setReview({ ...review, fatG: v })],
            ["fiberG", "Fiber (g)", review.fiberG ?? 0, (v: number) => setReview({ ...review, fiberG: v })],
          ] as const).map(([key, label, value, setter]) => (
            <label key={key} className="nutrition-field">
              <span>{label}</span>
              <input
                type="number"
                min={0}
                step={key === "calories" ? 1 : 0.1}
                value={value}
                onChange={(ev) => setter(Number(ev.target.value))}
              />
            </label>
          ))}
        </div>
        {error ? <p className="nutrition-error">{error}</p> : null}
        <div className="nutrition-actions">
          <button type="button" className="nutrition-btn nutrition-btn--ghost" onClick={onCancelReview} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="nutrition-btn nutrition-btn--primary" onClick={() => void onSave()} disabled={loading}>
            {loading ? <Loader2 className="nutrition-spin" size={16} /> : null}
            Save meal
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="nutrition-card">
      <h2 className="nutrition-card__title">Quick log</h2>
      <form onSubmit={(ev) => void onEstimate(ev)} className="nutrition-log-form">
        <div className="nutrition-mic-row">
          <button
            type="button"
            className={`nutrition-mic-btn${speech.listening ? " nutrition-mic-btn--active" : ""}`}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop listening" : "Start voice input"}
          >
            {speech.listening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          <div className="nutrition-mic-meta">
            <strong>{speech.listening ? "Listening…" : "Tap to speak"}</strong>
            <span className="nutrition-muted">
              {speech.supported
                ? "Works in Safari on iPhone after you allow the microphone."
                : "Speech recognition unavailable — type your meal below."}
            </span>
          </div>
        </div>
        <textarea
          className="nutrition-textarea"
          rows={4}
          placeholder="I had a Raising Cane's three-finger combo with fries, Texas toast, Cane's sauce, and a Diet Coke."
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
        />
        {(error || speech.error) && <p className="nutrition-error">{error ?? speech.error}</p>}
        <button type="submit" className="nutrition-btn nutrition-btn--primary" disabled={loading}>
          {loading ? <Loader2 className="nutrition-spin" size={16} /> : null}
          Estimate nutrition
        </button>
      </form>
    </section>
  );
}
