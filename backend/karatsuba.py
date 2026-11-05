"""
Integer Multiplication - Karatsuba (Divide and Conquer), O(n^1.585)

Two versions with the SAME algorithm:
  karatsuba(x, y)         plain, used for timing
  karatsuba_traced(x, y)  same logic, but records a tree of steps for the visualizer

Idea:
  Split at m digits:  x = a*10^m + b,   y = c*10^m + d
  x*y = z2*10^(2m) + z1*10^m + z0, where
      z2 = a*c
      z0 = b*d
      z1 = (a+b)(c+d) - z2 - z0      <- equals a*d + b*c, using 1 multiply instead of 2
  Three recursive multiplications instead of four: T(n) = 3T(n/2) + O(n).

Step trace (traced version):
  Each non-base call records a "split" step when it starts (operands, m, a, b, c, d)
  and a "combine" step when it finishes (z0, z1, z2, result). Base-case calls record
  a single "base" step. Every step has its own id:
    - a call's split/base step has parent_id = the split step of the calling call
    - a call's combine step has parent_id = its own split step
  So the split/base steps form the recursion tree, and each combine is the last child
  of its split.
"""

from __future__ import annotations

import itertools
import sys
from typing import Any

# Python 3.11+ refuses int <-> str conversion above 4300 digits. Lift it; main.py
# caps input size separately so this can't be abused.
if hasattr(sys, "set_int_max_str_digits"):
    sys.set_int_max_str_digits(0)

BASE_DIGITS = 4                  # numbers with <= 4 digits are multiplied directly
BASE_LIMIT = 10 ** BASE_DIGITS
MAX_STEPS = 4000


# ---------------------------------------------------------------------------
# Plain version (for timing)
# ---------------------------------------------------------------------------

def karatsuba(x: int, y: int) -> int:
    """Multiply two non-negative integers."""
    # Base case: if either number has <= 4 digits, a direct multiply is cheaper.
    if x < BASE_LIMIT or y < BASE_LIMIT:
        return x * y

    # DIVIDE: split both numbers at half the length of the longer one.
    m = max(len(str(x)), len(str(y))) // 2
    power = 10 ** m
    a, b = divmod(x, power)
    c, d = divmod(y, power)

    # CONQUER: three recursive multiplications.
    z2 = karatsuba(a, c)
    z0 = karatsuba(b, d)
    z1 = karatsuba(a + b, c + d) - z2 - z0

    # COMBINE: multiplying by a power of 10 is a shift, not a real multiplication.
    return z2 * (power * power) + z1 * power + z0


# ---------------------------------------------------------------------------
# Traced version (for the visualizer) - identical logic + step recording
# ---------------------------------------------------------------------------

def _step(step_id: int, parent_id: int | None, depth: int, kind: str, x: int, y: int,
          description: str, **fields: Any) -> dict[str, Any]:
    """Build a step dict with every schema field present (unused ones are null)."""
    step: dict[str, Any] = {
        "id": step_id, "parent_id": parent_id, "depth": depth, "type": kind,
        "x": str(x), "y": str(y), "m": None,
        "a": None, "b": None, "c": None, "d": None,
        "z0": None, "z1": None, "z2": None, "result": None,
        "description": description,
    }
    for key, value in fields.items():
        # "m" stays an int; every big number goes out as a string (JS can't hold them).
        step[key] = value if key == "m" else str(value)
    return step


def karatsuba_traced(x: int, y: int, max_steps: int = MAX_STEPS) -> tuple[int, list[dict[str, Any]], bool]:
    """Same as karatsuba, plus the step list and a truncated flag."""
    steps: list[dict[str, Any]] = []
    ids = itertools.count()
    truncated = False

    def record(make_step) -> None:
        # make_step is a lambda so we skip building big strings once recording stopped.
        nonlocal truncated
        if truncated:
            return
        if len(steps) >= max_steps:
            truncated = True
            return
        steps.append(make_step())

    def call(x: int, y: int, parent_id: int | None, depth: int) -> int:
        my_id = next(ids)

        if x < BASE_LIMIT or y < BASE_LIMIT:
            result = x * y
            record(lambda: _step(my_id, parent_id, depth, "base", x, y,
                                 f"Base case: {x} x {y} = {result} (multiplied directly).",
                                 result=result))
            return result

        m = max(len(str(x)), len(str(y))) // 2
        power = 10 ** m
        a, b = divmod(x, power)
        c, d = divmod(y, power)
        record(lambda: _step(my_id, parent_id, depth, "split", x, y,
                             f"Split at m = {m} digits: x = a*10^{m} + b, y = c*10^{m} + d.",
                             m=m, a=a, b=b, c=c, d=d))

        z2 = call(a, c, my_id, depth + 1)
        z0 = call(b, d, my_id, depth + 1)
        z1 = call(a + b, c + d, my_id, depth + 1) - z2 - z0
        result = z2 * (power * power) + z1 * power + z0

        combine_id = next(ids)
        record(lambda: _step(combine_id, my_id, depth, "combine", x, y,
                             f"Combine: z2*10^{2 * m} + z1*10^{m} + z0 using 3 multiplications instead of 4.",
                             m=m, a=a, b=b, c=c, d=d, z0=z0, z1=z1, z2=z2, result=result))
        return result

    product = call(x, y, None, 0)
    return product, steps, truncated