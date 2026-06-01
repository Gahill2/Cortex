import type { PlannerTask } from "../../components/tasks-calendar/types";

export const PROGRESS_STEPS = [
  { value: 0, label: "Not started", status: "TODO" as const },
  { value: 25, label: "Started", status: "IN_PROGRESS" as const },
  { value: 50, label: "Halfway", status: "IN_PROGRESS" as const },
  { value: 75, label: "Almost", status: "IN_PROGRESS" as const },
  { value: 100, label: "Done", status: "DONE" as const },
];

function nearestStep(percent: number): number {
  return PROGRESS_STEPS.reduce((best, step) =>
    Math.abs(step.value - percent) < Math.abs(best - percent) ? step.value : best,
  PROGRESS_STEPS[0].value);
}

interface Props {
  progressPercent: number;
  status?: PlannerTask["status"];
  disabled?: boolean;
  onChange: (progress: number, status: PlannerTask["status"]) => void;
}

export function TaskProgressControl({ progressPercent, status, disabled, onChange }: Props) {
  const active = nearestStep(progressPercent);

  return (
    <div className="pd-progress">
      <div className="pd-progress__bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <span className="pd-progress__fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="pd-progress__steps" role="group" aria-label="Task progress">
        {PROGRESS_STEPS.map((step) => (
          <button
            key={step.value}
            type="button"
            className={`pd-progress__step${active === step.value ? " pd-progress__step--active" : ""}${progressPercent >= step.value && step.value > 0 ? " pd-progress__step--passed" : ""}`}
            disabled={disabled}
            aria-pressed={active === step.value}
            onClick={() => onChange(step.value, step.status)}
          >
            <span className="pd-progress__step-dot" />
            <span className="pd-progress__step-label">{step.label}</span>
          </button>
        ))}
      </div>
      {status ? (
        <p className="pd-progress__hint">
          Status: <strong>{status === "IN_PROGRESS" ? "In progress" : status === "DONE" ? "Done" : "To do"}</strong>
          {" · "}
          {progressPercent}%
        </p>
      ) : null}
    </div>
  );
}
