export type Participant = {
  id: string;
  name: string;
  original_team: number;
};

export type Group = {
  id: number;
  members: Participant[];
  violations: number;
};

export type GroupingResult = {
  groups: Group[];
  totalViolations: number;
  seed: number;
  trials: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countGroupViolations(members: Participant[]): number {
  let v = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (members[i].original_team === members[j].original_team) v++;
    }
  }
  return v;
}

function groupSizes(n: number, baseSize: number): number[] {
  if (n <= 0) return [];
  if (n < baseSize) return [n];
  const numGroups = Math.floor(n / baseSize);
  const remainder = n - numGroups * baseSize;
  const sizes = new Array<number>(numGroups).fill(baseSize);
  for (let i = 0; i < remainder; i++) sizes[i] += 1;
  return sizes;
}

function tryAssign(
  participants: Participant[],
  sizes: number[],
  rng: () => number
): Group[] {
  const teamBuckets = new Map<number, Participant[]>();
  for (const p of participants) {
    if (!teamBuckets.has(p.original_team)) teamBuckets.set(p.original_team, []);
    teamBuckets.get(p.original_team)!.push(p);
  }
  for (const arr of teamBuckets.values()) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  const groups: Group[] = sizes.map((_, i) => ({
    id: i + 1,
    members: [],
    violations: 0,
  }));

  const groupOrder = shuffle(
    groups.map((_, i) => i),
    rng
  );

  const totalSlots = sizes.reduce((s, x) => s + x, 0);
  for (let slot = 0; slot < totalSlots; slot++) {
    const gi = groupOrder[slot % groupOrder.length];
    const grp = groups[gi];
    if (grp.members.length >= sizes[gi]) {
      let next = -1;
      for (const candidate of groupOrder) {
        if (groups[candidate].members.length < sizes[candidate]) {
          next = candidate;
          break;
        }
      }
      if (next === -1) break;
      pickInto(groups[next], sizes[next], teamBuckets, rng);
    } else {
      pickInto(grp, sizes[gi], teamBuckets, rng);
    }
  }

  for (const g of groups) g.violations = countGroupViolations(g.members);
  return groups;
}

function pickInto(
  grp: Group,
  cap: number,
  teamBuckets: Map<number, Participant[]>,
  rng: () => number
) {
  if (grp.members.length >= cap) return;
  const presentTeams = new Set(grp.members.map((m) => m.original_team));

  const teamsByCount = Array.from(teamBuckets.entries())
    .filter(([, arr]) => arr.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  if (teamsByCount.length === 0) return;

  let chosenTeam: number | null = null;
  for (const [team, arr] of teamsByCount) {
    if (!presentTeams.has(team) && arr.length > 0) {
      chosenTeam = team;
      break;
    }
  }
  if (chosenTeam === null) {
    chosenTeam = teamsByCount[0][0];
  }

  const arr = teamBuckets.get(chosenTeam)!;
  const idx = Math.floor(rng() * arr.length);
  const picked = arr.splice(idx, 1)[0];
  grp.members.push(picked);
}

export function formGroups(
  participants: Participant[],
  opts?: { groupSize?: number; trials?: number; seed?: number }
): GroupingResult {
  const groupSize = opts?.groupSize ?? 3;
  const trials = Math.max(1, opts?.trials ?? 200);
  const baseSeed = opts?.seed ?? Math.floor(Math.random() * 1_000_000_000);

  if (participants.length === 0) {
    return { groups: [], totalViolations: 0, seed: baseSeed, trials: 0 };
  }

  const sizes = groupSizes(participants.length, groupSize);

  let bestGroups: Group[] | null = null;
  let bestViolations = Infinity;
  let bestSeed = baseSeed;

  for (let t = 0; t < trials; t++) {
    const seed = baseSeed + t;
    const rng = mulberry32(seed);
    const groups = tryAssign(participants, sizes, rng);
    const total = groups.reduce((s, g) => s + g.violations, 0);
    if (total < bestViolations) {
      bestViolations = total;
      bestGroups = groups;
      bestSeed = seed;
      if (total === 0) break;
    }
  }

  return {
    groups: bestGroups ?? [],
    totalViolations: bestViolations === Infinity ? 0 : bestViolations,
    seed: bestSeed,
    trials,
  };
}
