import { useState } from "react";
import type { WidgetRenderProps } from "../types";
import { mockHabits } from "../mockData";
import { PdProgressRing } from "../../components/ui/PdProgressRing";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

export function HabitsWidget(_props: WidgetRenderProps) {
  const [habits, setHabits] = useState(mockHabits);
  const done = habits.filter((h) => h.doneToday).length;
  const pct = Math.round((done / habits.length) * 100);

  return (
    <div className="pd-widget pd-widget--habits">
      <PdSectionHeader title="Habits" action={<PdProgressRing value={pct} />} />
      <ul className="pd-habit-list">
        {habits.map((h) => (
          <li key={h.id}>
            <label className="pd-habit-row">
              <input
                type="checkbox"
                checked={h.doneToday}
                onChange={() =>
                  setHabits((list) =>
                    list.map((x) => (x.id === h.id ? { ...x, doneToday: !x.doneToday } : x)),
                  )
                }
              />
              <span className="pd-habit-row__label">{h.label}</span>
              <span className="pd-streak-pill">{h.streak} day streak</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
