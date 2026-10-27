"""
Pydantic schemas for the SolvAm Deterministic Symbolic Engine.
Strict typing and defensive validation for mathematical requests.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class SolveRequest(BaseModel):
    """Request to solve a single mathematical expression or equation."""
    equation: str = Field(..., description="The algebraic or LaTeX expression to solve. E.g. '2*x**2 + 5*x - 3 = 0'")
    solve_for: str = Field(default="x", description="Target variable to solve for")
    operation: str = Field(default="solve", description="Operation: solve, simplify, differentiate, integrate, evaluate")
    extra_args: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Extra bounds or parameters (order, lower, upper, point)")

    @field_validator('equation')
    @classmethod
    def validate_equation(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Equation cannot be empty")
        if len(cleaned) > 500:
            raise ValueError("Equation exceeds maximum length of 500 characters")
        return cleaned


class SolveResponse(BaseModel):
    """Response containing deterministic, verified mathematical milestones."""
    success: bool
    equation: str
    latex_equation: str
    solution_latex: str
    numerical_roots: List[float] = Field(default_factory=list)
    discriminant: Optional[float] = None
    factored_latex: Optional[str] = None
    milestones: Dict[str, Any] = Field(default_factory=dict)
    operation: str
    topic_label: str
    error: Optional[str] = None


class VerifyStepItem(BaseModel):
    """Analysis for a single step in student handwritten work."""
    step_index: int
    raw_text: str
    latex: str
    is_mathematically_valid: bool
    waec_mark: str = Field(description="WAEC marking code: M1 (Method), A1 (Accuracy), B1 (Independent), M0 (Failed)")
    feedback: Optional[str] = None


class VerifyStepsRequest(BaseModel):
    """Request to verify multi-line student handwritten work line-by-line."""
    original_problem: str = Field(..., description="The problem statement or initial equation")
    steps: List[str] = Field(..., description="List of handwritten steps written by student in order")
    solve_for: str = Field(default="x", description="Target variable")


class VerifyStepsResponse(BaseModel):
    """Line-by-line verification response with WAEC marking rubric breakdown."""
    success: bool
    is_fully_correct: bool
    total_steps: int
    valid_step_count: int
    first_error_index: Optional[int] = None
    step_analyses: List[VerifyStepItem]
    waec_score_earned: int
    waec_score_total: int
    pedagogical_summary: str
    error: Optional[str] = None


class GenerateTwinRequest(BaseModel):
    """Request to generate a mathematically identical twin practice problem."""
    equation: str = Field(..., description="Original equation to mirror")
    topic: Optional[str] = Field(default="Quadratic Equations", description="Math topic")
    constraints: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"integer_roots_only": True, "real_roots_only": True},
        description="Constraints for the generated problem"
    )


class GenerateTwinResponse(BaseModel):
    """Mathematically verified twin practice problem with verified answer."""
    success: bool
    original_equation: str
    twin_equation: str
    twin_equation_latex: str
    correct_answer_latex: str
    solution_steps: List[str]
    parameters: Dict[str, Any]
    error: Optional[str] = None
