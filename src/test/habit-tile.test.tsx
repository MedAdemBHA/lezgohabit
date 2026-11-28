import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/lib/i18n";
import { HabitTile } from "@/components/lezgo/today/habit-tile";
import type { UserHabit } from "@/lib/data";

const read = {
  id: "h1",
  kind: "count",
  target: 10,
  unit: "pages",
  custom_name: null,
  rule: {},
  what_counts: {},
  template: { key: "read", name: { en: "Read 10 pages" }, default_target: 10, icon: "read" },
} as unknown as UserHabit;

function tile(value: number, completion: number, earned: number | undefined) {
  return render(
    <HabitTile
      habit={read}
      value={value}
      completion={completion}
      points={earned === undefined ? undefined : { id: "h1", share: 67, earned }}
      pop={false}
      onTap={() => {}}
      onStepper={() => {}}
      disabled={false}
    />,
  );
}

describe("habit tile display", () => {
  it("over target shows the goal reached plus the amount logged", () => {
    tile(29, 1, 67);
    expect(screen.getByText(/29 logged/)).toBeInTheDocument();
    expect(screen.queryByText(/29 \/ 10/)).not.toBeInTheDocument();
  });
  it("a completed tile shows its points", () => {
    tile(10, 1, 67);
    expect(screen.getByText("+67")).toBeInTheDocument();
  });
  it("an unfinished tile shows no points, even with partial credit", () => {
    tile(5, 0.5, 33);
    expect(screen.queryByText("+33")).not.toBeInTheDocument();
    expect(screen.getByText("5 / 10")).toBeInTheDocument();
  });
});
