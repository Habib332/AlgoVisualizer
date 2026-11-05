"""
algo-visualizer backend (FastAPI).

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import math
import re
import time
from pathlib import Path
from typing import Annotated, Literal, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

import closest_pair as cp
import karatsuba as ka   # importing this also lifts Python's int<->str digit limit

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
KIND_DIRS = {"cp": DATA_DIR / "closest_pair", "mul": DATA_DIR / "multiplication"}

# Input limits: keep one request from tying up the server for minutes.
MAX_TEXT_CHARS = 5_000_000
MAX_POINTS = 100_000
MAX_DIGITS = 50_000
BRUTE_FORCE_MAX_N = 2000

app = FastAPI(title="algo-visualizer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173, https://algo-visualizer-7ja9.vercel.app"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models (match the API spec)
# ---------------------------------------------------------------------------

class TextInput(BaseModel):
    text: str


class PointOut(BaseModel):
    x: float
    y: float


class BestPair(BaseModel):
    i: int
    j: int
    dist: float


class _StepBase(BaseModel):
    depth: int
    description: str


class DivideStep(_StepBase):
    type: Literal["divide"]
    lo: int
    hi: int
    mid: int
    midX: float


class BaseStep(_StepBase):
    type: Literal["base"]
    lo: int
    hi: int
    best: BestPair


class StripStep(_StepBase):
    type: Literal["strip"]
    lo: int
    hi: int
    midX: float
    d: float
    strip: list[int]
    checked: list[tuple[int, int, float]]


class MergeStep(_StepBase):
    type: Literal["merge"]
    lo: int
    hi: int
    best: BestPair


# "type" tells pydantic which model to use for each step.
ClosestPairStep = Annotated[Union[DivideStep, BaseStep, StripStep, MergeStep], Field(discriminator="type")]


class ClosestPairResult(BaseModel):
    n: int
    points: list[PointOut]
    best: BestPair
    runtime_ms: float
    brute_force_ms: float | None
    truncated: bool
    steps: list[ClosestPairStep]


class MultiplyStep(BaseModel):
    id: int
    parent_id: int | None
    depth: int
    type: Literal["split", "base", "combine"]
    x: str
    y: str
    m: int | None
    a: str | None
    b: str | None
    c: str | None
    d: str | None
    z0: str | None
    z1: str | None
    z2: str | None
    result: str | None
    description: str


class MultiplyResult(BaseModel):
    a: str
    b: str
    digits_a: int
    digits_b: int
    product: str
    verified: bool
    runtime_ms: float
    builtin_ms: float
    truncated: bool
    steps: list[MultiplyStep]


# ---------------------------------------------------------------------------
# Errors: the spec wants HTTP 400 {"detail": "<string>"} for malformed input,
# including a body that isn't {"text": "..."} (FastAPI would send 422 by default).
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(part) for part in first.get("loc", []))
    message = f"Invalid request ({where}): {first.get('msg', 'malformed input')}"
    return JSONResponse(status_code=400, content={"detail": message})


def bad_input(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def elapsed_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


# ---------------------------------------------------------------------------
# File endpoints
# ---------------------------------------------------------------------------

def kind_dir(kind: str) -> Path:
    if kind not in KIND_DIRS:
        raise HTTPException(status_code=404, detail=f"Unknown kind '{kind}'. Use 'cp' or 'mul'.")
    return KIND_DIRS[kind]


@app.get("/api/files/{kind}")
def list_files(kind: str) -> list[str]:
    folder = kind_dir(kind)
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.glob(f"{kind}_*.txt") if p.is_file())


@app.get("/api/files/{kind}/{name}", response_class=PlainTextResponse)
def read_file(kind: str, name: str) -> str:
    folder = kind_dir(kind)
    # Path traversal protection, two layers:
    # 1) only names like "cp_01.txt" are allowed (no slashes, no "..")
    if not re.fullmatch(rf"{kind}_\d{{2}}\.txt", name):
        raise bad_input(f"Invalid file name '{name}'.")
    # 2) the resolved path must still be inside the data folder
    path = (folder / name).resolve()
    if not path.is_relative_to(folder.resolve()) or not path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{name}' not found.")
    return path.read_text()


# ---------------------------------------------------------------------------
# Closest pair
# ---------------------------------------------------------------------------

def parse_points(text: str) -> list[tuple[float, float]]:
    if len(text) > MAX_TEXT_CHARS:
        raise bad_input("Input is too large.")
    points = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue                                   # tolerate blank lines
        parts = line.split()
        if len(parts) != 2:
            raise bad_input(f"Line {line_no}: expected 'x y', got '{line.strip()[:50]}'.")
        try:
            x, y = float(parts[0]), float(parts[1])
        except ValueError:
            raise bad_input(f"Line {line_no}: '{line.strip()[:50]}' is not two numbers.") from None
        if not (math.isfinite(x) and math.isfinite(y)):
            raise bad_input(f"Line {line_no}: coordinates must be finite numbers.")
        points.append((x, y))

    if len(points) < 2:
        raise bad_input("Need at least 2 points.")
    if len(points) > MAX_POINTS:
        raise bad_input(f"Too many points ({len(points)}); the limit is {MAX_POINTS}.")
    return points


@app.post("/api/closest-pair", response_model=ClosestPairResult)
def run_closest_pair(body: TextInput) -> dict:
    # Sort once here; every index in the response refers to this sorted list.
    points = sorted(parse_points(body.text))
    n = len(points)

    # Time the plain version, so recording steps doesn't distort the runtime.
    start = time.perf_counter()
    cp.closest_pair(points)
    runtime_ms = elapsed_ms(start)

    brute_force_ms = None
    if n <= BRUTE_FORCE_MAX_N:
        start = time.perf_counter()
        cp.brute_force(points)
        brute_force_ms = elapsed_ms(start)

    # Run the traced version for the steps; its answer is identical to the plain one.
    (dist, i, j), steps, truncated = cp.closest_pair_traced(points)

    return {
        "n": n,
        "points": [{"x": x, "y": y} for x, y in points],
        "best": {"i": i, "j": j, "dist": dist},
        "runtime_ms": runtime_ms,
        "brute_force_ms": brute_force_ms,
        "truncated": truncated,
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# Multiplication
# ---------------------------------------------------------------------------

def parse_pair(text: str) -> tuple[int, int]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) != 2:
        raise bad_input(f"Expected exactly 2 non-empty lines (a and b), got {len(lines)}.")
    numbers = []
    for label, line in zip("ab", lines):
        # Check length BEFORE int(): converting a huge string is itself expensive.
        if len(line) > MAX_DIGITS:
            raise bad_input(f"'{label}' has {len(line)} digits; the limit is {MAX_DIGITS}.")
        if not line.isascii() or not line.isdigit():
            raise bad_input(f"'{label}' must contain only the digits 0-9.")
        value = int(line)
        if value == 0:
            raise bad_input(f"'{label}' must be a positive integer.")
        numbers.append(value)
    return numbers[0], numbers[1]


@app.post("/api/multiply", response_model=MultiplyResult)
def run_multiply(body: TextInput) -> dict:
    a, b = parse_pair(body.text)

    start = time.perf_counter()
    product = ka.karatsuba(a, b)
    runtime_ms = elapsed_ms(start)

    start = time.perf_counter()
    expected = a * b
    builtin_ms = elapsed_ms(start)

    _, steps, truncated = ka.karatsuba_traced(a, b)

    a_str, b_str = str(a), str(b)    # normalised (any leading zeros removed)
    return {
        "a": a_str,
        "b": b_str,
        "digits_a": len(a_str),
        "digits_b": len(b_str),
        "product": str(product),
        "verified": product == expected,
        "runtime_ms": runtime_ms,
        "builtin_ms": builtin_ms,
        "truncated": truncated,
        "steps": steps,
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "message": "Algo Visualizer backend is running."
    }