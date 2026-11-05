"""
Correctness tests. Run from backend/:  pytest -q

- Closest pair (plain and traced) must find the same distance as brute force.
- Karatsuba (plain and traced) must equal Python's built-in a * b.
Both include cases that force the step cap, to prove truncation never changes the answer.
"""

import math
import random

import closest_pair as cp
import karatsuba as ka

rng = random.Random(1234)


def random_points(n, coord_max):
    # A small coord_max forces duplicate x values and even identical points.
    return sorted((round(rng.uniform(0, coord_max), 2), round(rng.uniform(0, coord_max), 2)) for _ in range(n))


def test_closest_pair_matches_brute_force():
    for case in range(20):
        n = rng.randint(2, 400)
        coord_max = 5 if case % 4 == 0 else 1000
        points = random_points(n, coord_max)

        expected = cp.brute_force(points)[0]
        plain = cp.closest_pair(points)
        traced, steps, _ = cp.closest_pair_traced(points)

        assert math.isclose(plain[0], expected), f"case {case}: plain"
        assert math.isclose(traced[0], expected), f"case {case}: traced"
        assert plain == traced                       # same logic -> same pair
        assert math.isclose(cp.distance(points[plain[1]], points[plain[2]]), expected)
        assert steps and steps[-1]["type"] in ("merge", "base")


def test_closest_pair_truncation_keeps_answer():
    points = random_points(1500, 1000)
    best, steps, truncated = cp.closest_pair_traced(points, max_steps=50)
    assert truncated and len(steps) == 50
    assert math.isclose(best[0], cp.brute_force(points)[0])


def test_karatsuba_matches_builtin():
    for case in range(20):
        # Mix of equal and very unequal lengths, including tiny numbers.
        a = rng.randint(1, 10 ** rng.randint(1, 600))
        b = rng.randint(1, 10 ** rng.randint(1, 600))

        assert ka.karatsuba(a, b) == a * b, f"case {case}: plain"
        product, steps, _ = ka.karatsuba_traced(a, b)
        assert product == a * b, f"case {case}: traced"
        assert len({s["id"] for s in steps}) == len(steps)   # ids are unique


def test_karatsuba_truncation_keeps_answer():
    a, b = rng.randint(10 ** 2999, 10 ** 3000), rng.randint(10 ** 2999, 10 ** 3000)
    product, steps, truncated = ka.karatsuba_traced(a, b, max_steps=100)
    assert truncated and len(steps) == 100
    assert product == a * b