"""
Unit tests for SolvAm Deterministic Symbolic Engine.
Run with pytest.
"""

import pytest
from math_engine import (
    solve_equation_symbolic,
    verify_steps_sequence,
    generate_parametric_twin,
    safe_sympify
)


def test_solve_quadratic_clean_roots():
    """Verify solving standard WAEC quadratic equation 2x^2 + 5x - 3 = 0."""
    result = solve_equation_symbolic("2*x**2 + 5*x - 3 = 0", solve_for="x")
    assert result["success"] is True
    assert result["topic_label"] == "Quadratic Equations"
    assert result["discriminant"] == 49.0
    assert -3.0 in result["numerical_roots"]
    assert 0.5 in result["numerical_roots"]
    assert result["milestones"]["nature_of_roots"] == "Real and Distinct"


def test_solve_latex_input():
    """Verify parsing LaTeX syntax with exponents and fractions."""
    result = solve_equation_symbolic(r"x^2 - 4 = 0", solve_for="x")
    assert result["success"] is True
    assert -2.0 in result["numerical_roots"]
    assert 2.0 in result["numerical_roots"]


def test_security_guards_reject_dangerous_tokens():
    """Verify that dangerous tokens raise security errors."""
    with pytest.raises(ValueError, match="Security rejection"):
        safe_sympify("__import__('os').system('ls')")

    with pytest.raises(ValueError, match="Security rejection"):
        safe_sympify("import sys")


def test_verify_steps_all_valid():
    """Verify multi-line student working where all steps are valid."""
    problem = "2*x**2 + 5*x - 3 = 0"
    steps = [
        "2*x**2 + 6*x - x - 3 = 0",
        "2*x*(x + 3) - 1*(x + 3) = 0",
        "(2*x - 1)*(x + 3) = 0"
    ]
    result = verify_steps_sequence(problem, steps, solve_for="x")
    assert result["is_fully_correct"] is True
    assert result["valid_step_count"] == 3
    assert result["first_error_index"] is None
    assert result["waec_score_earned"] >= 3


def test_verify_steps_detects_sign_error():
    """Verify that an error on line 2 is accurately pinpointed."""
    problem = "2*x**2 + 5*x - 3 = 0"
    steps = [
        "2*x**2 + 6*x - x - 3 = 0",
        "2*x**2 + 6*x + x - 3 = 0",  # Sign mistake introduced here (+x instead of -x)
        "(2*x - 1)*(x + 3) = 0"
    ]
    result = verify_steps_sequence(problem, steps, solve_for="x")
    assert result["is_fully_correct"] is False
    assert result["first_error_index"] == 1  # 0-indexed: 2nd line
    assert result["step_analyses"][1]["waec_mark"] == "M0"
    assert result["step_analyses"][0]["waec_mark"] == "M1"  # First line still earned method mark!


def test_generate_parametric_twin():
    """Verify twin problem generation guarantees real integer roots."""
    twin = generate_parametric_twin("2*x**2 + 5*x - 3 = 0")
    assert twin["success"] is True
    assert "x" in twin["twin_equation"]
    assert len(twin["solution_steps"]) == 4
    # Check that roots are integers
    params = twin["parameters"]
    assert isinstance(params["root_1"], int)
    assert isinstance(params["root_2"], int)
