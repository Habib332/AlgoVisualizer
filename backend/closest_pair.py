"""
Closest Pair of Points - Divide and Conquer, O(n log n)

Two versions with the SAME algorithm:
  closest_pair(points)         plain, used for timing
  closest_pair_traced(points)  same logic, but records every step for the visualizer

Both expect `points` already SORTED by x (then y). Working on a sorted list lets
us describe every subproblem as an index range [lo, hi), which is exactly what the
frontend needs to highlight. It also handles duplicate points correctly, because
we split by index instead of by coordinate value.

Algorithm:
  1. DIVIDE   split the range [lo, hi) at mid; the vertical line is at x = points[mid].x
  2. CONQUER  solve the left and right halves recursively -> best distance d
  3. COMBINE  only a pair crossing the line can beat d, so look at points within d
              of the line (the "strip"), in y order. Each point is compared only
              with following points whose y-gap is < d (at most 7 of them), so the
              combine step is O(n).
"""

from __future__ import annotations

import math
from typing import Any

Point = tuple[float, float]
Best = tuple[float, int, int]     # (distance, i, j) with i < j, indices into sorted points

BASE_SIZE = 3        # ranges this small are solved by brute force
MAX_STEPS = 3000     # cap on recorded steps (the answer is still computed fully)


# ---------------------------------------------------------------------------
# Helpers shared by both versions
# ---------------------------------------------------------------------------

def distance(p: Point, q: Point) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


def brute_force(points: list[Point], lo: int = 0, hi: int | None = None) -> Best:
    """Compare every pair in [lo, hi). O(n^2). Base case and correctness check."""
    if hi is None:
        hi = len(points)
    best: Best = (math.inf, -1, -1)
    for i in range(lo, hi):
        for j in range(i + 1, hi):
            d = distance(points[i], points[j])
            if d < best[0]:
                best = (d, i, j)
    return best


def _y_order(points: list[Point]) -> list[int]:
    """Indices of the points sorted by y (then x). Computed once, split in O(n) per level."""
    return sorted(range(len(points)), key=lambda i: (points[i][1], points[i][0]))


def _check_input(points: list[Point]) -> None:
    if len(points) < 2:
        raise ValueError("Need at least 2 points.")


# ---------------------------------------------------------------------------
# Plain version (for timing)
# ---------------------------------------------------------------------------

def closest_pair(points: list[Point]) -> Best:
    """points must be sorted by x then y. Returns (distance, i, j)."""
    _check_input(points)
    return _closest(points, 0, len(points), _y_order(points))


def _closest(pts: list[Point], lo: int, hi: int, py: list[int]) -> Best:
    # Base case: brute force is cheapest for <= 3 points.
    if hi - lo <= BASE_SIZE:
        return brute_force(pts, lo, hi)

    # DIVIDE at the middle index. Because pts is sorted by x, every index < mid
    # is on the left. Splitting py by index keeps each half in y order.
    mid = (lo + hi) // 2
    mid_x = pts[mid][0]
    left_py = [i for i in py if i < mid]
    right_py = [i for i in py if i >= mid]

    # CONQUER: tuples compare by distance first, so min() picks the closer pair.
    best = min(_closest(pts, lo, mid, left_py), _closest(pts, mid, hi, right_py))

    # COMBINE: points within d of the dividing line, already in y order.
    strip = [i for i in py if abs(pts[i][0] - mid_x) < best[0]]
    for s in range(len(strip)):
        t = s + 1
        # Stop once the y-gap alone is >= best: no later point can be closer.
        while t < len(strip) and pts[strip[t]][1] - pts[strip[s]][1] < best[0]:
            d = distance(pts[strip[s]], pts[strip[t]])
            if d < best[0]:
                i, j = sorted((strip[s], strip[t]))
                best = (d, i, j)
            t += 1
    return best


# ---------------------------------------------------------------------------
# Traced version (for the visualizer) - identical logic + step recording
# ---------------------------------------------------------------------------

class StepRecorder:
    """Collects steps until the cap is hit, then silently stops recording."""

    def __init__(self, limit: int) -> None:
        self.steps: list[dict[str, Any]] = []
        self.limit = limit
        self.truncated = False

    @property
    def active(self) -> bool:
        return not self.truncated

    def add(self, step: dict[str, Any]) -> None:
        if self.truncated:
            return
        if len(self.steps) >= self.limit:
            self.truncated = True      # stop recording, but the algorithm keeps running
            return
        self.steps.append(step)


def _best_dict(best: Best) -> dict[str, Any]:
    return {"i": best[1], "j": best[2], "dist": best[0]}


def closest_pair_traced(points: list[Point], max_steps: int = MAX_STEPS) -> tuple[Best, list[dict[str, Any]], bool]:
    """Same as closest_pair, plus a list of steps in execution order and a truncated flag."""
    _check_input(points)
    rec = StepRecorder(max_steps)
    best = _closest_traced(points, 0, len(points), _y_order(points), 0, rec)
    return best, rec.steps, rec.truncated


def _closest_traced(pts: list[Point], lo: int, hi: int, py: list[int], depth: int, rec: StepRecorder) -> Best:
    if hi - lo <= BASE_SIZE:
        best = brute_force(pts, lo, hi)
        rec.add({
            "type": "base", "depth": depth, "lo": lo, "hi": hi, "best": _best_dict(best),
            "description": f"Brute force on {hi - lo} points [{lo}, {hi}): closest pair is "
                           f"#{best[1]} and #{best[2]} at distance {best[0]:.4f}.",
        })
        return best

    mid = (lo + hi) // 2
    mid_x = pts[mid][0]
    rec.add({
        "type": "divide", "depth": depth, "lo": lo, "hi": hi, "mid": mid, "midX": mid_x,
        "description": f"Split points [{lo}, {hi}) at index {mid} with a vertical line at x = {mid_x:.2f}.",
    })
    left_py = [i for i in py if i < mid]
    right_py = [i for i in py if i >= mid]

    best = min(_closest_traced(pts, lo, mid, left_py, depth + 1, rec),
               _closest_traced(pts, mid, hi, right_py, depth + 1, rec))
    d = best[0]

    strip = [i for i in py if abs(pts[i][0] - mid_x) < d]
    checked: list[list[float]] = []
    for s in range(len(strip)):
        t = s + 1
        while t < len(strip) and pts[strip[t]][1] - pts[strip[s]][1] < best[0]:
            dist = distance(pts[strip[s]], pts[strip[t]])
            if rec.active:                               # don't build lists we'll never send
                checked.append([strip[s], strip[t], dist])
            if dist < best[0]:
                i, j = sorted((strip[s], strip[t]))
                best = (dist, i, j)
            t += 1

    rec.add({
        "type": "strip", "depth": depth, "lo": lo, "hi": hi, "midX": mid_x, "d": d,
        "strip": strip, "checked": checked,
        "description": f"{len(strip)} points lie within d = {d:.4f} of x = {mid_x:.2f}; "
                       f"compared {len(checked)} crossing pairs.",
    })
    rec.add({
        "type": "merge", "depth": depth, "lo": lo, "hi": hi, "best": _best_dict(best),
        "description": f"Best pair for [{lo}, {hi}) is #{best[1]} and #{best[2]} at distance {best[0]:.4f}.",
    })
    return best