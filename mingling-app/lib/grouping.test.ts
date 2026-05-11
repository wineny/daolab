import { describe, it, expect } from "vitest";
import { formGroups, type Participant } from "./grouping";

function make(team: number, idx: number): Participant {
  return { id: `${team}-${idx}`, name: `T${team}P${idx}`, original_team: team };
}

function balancedThirty(): Participant[] {
  const out: Participant[] = [];
  for (let team = 1; team <= 6; team++) {
    for (let i = 1; i <= 5; i++) out.push(make(team, i));
  }
  return out;
}

describe("formGroups", () => {
  it("empty input → empty groups", () => {
    const r = formGroups([]);
    expect(r.groups).toEqual([]);
    expect(r.totalViolations).toBe(0);
  });

  it("1 person → single group of 1", () => {
    const r = formGroups([make(1, 1)]);
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].members.length).toBe(1);
  });

  it("2 people → single group of 2", () => {
    const r = formGroups([make(1, 1), make(2, 1)]);
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].members.length).toBe(2);
  });

  it("balanced 30 (5 per team × 6 teams) → 0 violations", () => {
    const r = formGroups(balancedThirty(), { trials: 200 });
    expect(r.groups.length).toBe(10);
    expect(r.groups.every((g) => g.members.length === 3)).toBe(true);
    expect(r.totalViolations).toBe(0);
  });

  it("7 people across 4 teams → 2 groups (3+4)", () => {
    const ppl = [
      make(1, 1),
      make(1, 2),
      make(2, 1),
      make(3, 1),
      make(3, 2),
      make(4, 1),
      make(4, 2),
    ];
    const r = formGroups(ppl, { trials: 200 });
    expect(r.groups.length).toBe(2);
    const sizes = r.groups.map((g) => g.members.length).sort();
    expect(sizes).toEqual([3, 4]);
  });

  it("unbalanced (10 from team 1 + 5 each from 2-5) = 30 → best-effort, finite violations", () => {
    const ppl: Participant[] = [];
    for (let i = 1; i <= 10; i++) ppl.push(make(1, i));
    for (let team = 2; team <= 5; team++) {
      for (let i = 1; i <= 5; i++) ppl.push(make(team, i));
    }
    const r = formGroups(ppl, { trials: 500 });
    expect(r.groups.length).toBe(10);
    expect(r.groups.every((g) => g.members.length === 3)).toBe(true);
    expect(r.totalViolations).toBeLessThanOrEqual(5);
  });

  it("everyone in same team → produces groups with all violations", () => {
    const ppl: Participant[] = [];
    for (let i = 1; i <= 6; i++) ppl.push(make(1, i));
    const r = formGroups(ppl, { trials: 50 });
    expect(r.groups.length).toBe(2);
    expect(r.totalViolations).toBeGreaterThan(0);
  });

  it("each call covers every participant exactly once", () => {
    const ppl = balancedThirty();
    const r = formGroups(ppl, { trials: 50 });
    const seen = new Set<string>();
    for (const g of r.groups) for (const m of g.members) seen.add(m.id);
    expect(seen.size).toBe(ppl.length);
  });

  it("deterministic with fixed seed", () => {
    const ppl = balancedThirty();
    const a = formGroups(ppl, { trials: 1, seed: 42 });
    const b = formGroups(ppl, { trials: 1, seed: 42 });
    expect(a.groups.map((g) => g.members.map((m) => m.id))).toEqual(
      b.groups.map((g) => g.members.map((m) => m.id))
    );
  });
});
