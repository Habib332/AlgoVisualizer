"""
Generate the sample input files in ../data/.

  data/closest_pair/cp_01.txt ... cp_10.txt     one "x y" per line, 2 decimals, range 0..1000
  data/multiplication/mul_01.txt ... mul_10.txt two lines: integer a, integer b

A fixed seed makes the files identical on every run (reproducible results).

Edge cases:
  cp_03.txt  many points share the same few x values (duplicate x). This breaks
             naive "split where x <= mid_x" implementations.
  cp_06.txt  a large share of points lie exactly on one line (collinear).

Run from the backend/ folder:  python generate_inputs.py
"""

from __future__ import annotations

import random
from pathlib import Path

SEED = 42
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CP_DIR = DATA_DIR / "closest_pair"
MUL_DIR = DATA_DIR / "multiplication"

CP_SIZES = [120, 200, 350, 500, 800, 1000, 1500, 2000, 3000, 5000]
MUL_DIGITS = [128, 200, 256, 400, 512, 800, 1024, 1500, 2048, 4096]

DUPLICATE_X_FILE = 3   # cp_03
COLLINEAR_FILE = 6     # cp_06


def random_coord(rng: random.Random) -> float:
    return round(rng.uniform(0, 1000), 2)


def make_points(rng: random.Random, n: int, file_no: int) -> list[tuple[float, float]]:
    points = [(random_coord(rng), random_coord(rng)) for _ in range(n)]

    if file_no == DUPLICATE_X_FILE:
        # Put 40% of the points on just 8 vertical lines (shared x values).
        columns = [random_coord(rng) for _ in range(8)]
        for k in range(int(n * 0.4)):
            points[k] = (rng.choice(columns), random_coord(rng))

    elif file_no == COLLINEAR_FILE:
        # Put 30% of the points on the line y = 0.5x + 100. Choosing x = 2k
        # gives y = k + 100, so the points are exactly collinear even at 2 decimals.
        ks = rng.sample(range(0, 451), int(n * 0.3))
        for slot, k in enumerate(ks):
            points[slot] = (float(2 * k), float(k + 100))

    rng.shuffle(points)   # files shouldn't arrive pre-sorted
    return points


def random_number(rng: random.Random, digits: int) -> str:
    """A positive integer with exactly `digits` digits (no leading zero)."""
    return str(rng.randint(1, 9)) + "".join(rng.choice("0123456789") for _ in range(digits - 1))


def main() -> None:
    rng = random.Random(SEED)
    CP_DIR.mkdir(parents=True, exist_ok=True)
    MUL_DIR.mkdir(parents=True, exist_ok=True)

    for file_no, n in enumerate(CP_SIZES, start=1):
        path = CP_DIR / f"cp_{file_no:02d}.txt"
        lines = [f"{x:.2f} {y:.2f}" for x, y in make_points(rng, n, file_no)]
        path.write_text("\n".join(lines) + "\n")
        print(f"wrote {path.relative_to(DATA_DIR.parent)}  ({n} points)")

    for file_no, digits in enumerate(MUL_DIGITS, start=1):
        path = MUL_DIR / f"mul_{file_no:02d}.txt"
        path.write_text(f"{random_number(rng, digits)}\n{random_number(rng, digits)}\n")
        print(f"wrote {path.relative_to(DATA_DIR.parent)}  ({digits} digits each)")


if __name__ == "__main__":
    main()