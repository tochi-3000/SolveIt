"""
FastAPI Server for SolvAm Deterministic Symbolic Engine.
Exposes endpoints for mathematical solving, step verification, and twin generation.
"""

import time
import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from schemas import (
    SolveRequest, SolveResponse,
    VerifyStepsRequest, VerifyStepsResponse,
    GenerateTwinRequest, GenerateTwinResponse
)
from math_engine import (
    solve_equation_symbolic,
    verify_steps_sequence,
    generate_parametric_twin
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s'
)
logger = logging.getLogger("solvam.server")

app = FastAPI(
    title="SolvAm Symbolic Math Engine",
    description="Deterministic neuro-symbolic engine powering SolvAm's math verification and WAEC rubric grading.",
    version="1.0.0"
)

# Production Safeguard: CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Next.js frontend during dev & deployed Vercel domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request, call_next):
    """Tracks latency for all symbolic computations."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time_ms)
    logger.info(f"Method: {request.method} Path: {request.url.path} Duration: {process_time_ms}ms")
    return response


@app.get("/health")
def health_check():
    """Healthcheck endpoint for orchestrator and container checks."""
    return {
        "status": "healthy",
        "service": "solvam-symbolic-engine",
        "version": "1.0.0"
    }


@app.post("/symbolic/solve", response_model=SolveResponse)
def solve_math(req: SolveRequest):
    """Solves an equation deterministically and extracts milestones."""
    try:
        result = solve_equation_symbolic(equation=req.equation, solve_for=req.solve_for)
        return SolveResponse(**result)
    except ValueError as val_err:
        logger.warning(f"Validation error solving '{req.equation}': {val_err}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as e:
        logger.error(f"Unexpected error solving '{req.equation}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deterministic symbolic computation failed: {str(e)}"
        )


@app.post("/symbolic/verify-steps", response_model=VerifyStepsResponse)
def verify_student_steps(req: VerifyStepsRequest):
    """Verifies a student's step-by-step working line-by-line with WAEC rubrics."""
    try:
        result = verify_steps_sequence(
            original_problem=req.original_problem,
            steps=req.steps,
            solve_for=req.solve_for
        )
        return VerifyStepsResponse(**result)
    except ValueError as val_err:
        logger.warning(f"Validation error verifying steps: {val_err}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as e:
        logger.error(f"Error verifying steps: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Step verification failed: {str(e)}"
        )


@app.post("/symbolic/generate-twin", response_model=GenerateTwinResponse)
def generate_twin(req: GenerateTwinRequest):
    """Generates a twin practice problem with integer root guarantees."""
    try:
        result = generate_parametric_twin(equation=req.equation, topic=req.topic or "Quadratic Equations")
        return GenerateTwinResponse(**result)
    except Exception as e:
        logger.error(f"Error generating twin problem: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Twin generation failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
