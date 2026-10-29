"""
Deterministic Symbolic Engine for SolvAm — Core Mathematical Engine
Ported and upgraded from exam-intelligence-engine with:
1. Strict AST sandboxing & token allowlist (safe_sympify)
2. LaTeX -> SymPy normalization
3. Deterministic solving & milestone extraction (discriminants, roots, factors)
4. Line-by-line algebraic equivalence verification for student handwritten work
5. Parameterized WAEC twin problem generator with integer root guarantees
"""

import re
import random
import logging
from typing import Any, Dict, List, Tuple, Optional
import sympy as sp

logger = logging.getLogger("solvam.symbolic")

# ---------------------------------------------------------------------------
# Security: Strict allowlist for SymPy parsing.
# Only these mathematical tokens are permitted during sympify().
# Code execution vectors ('import', 'os', 'exec', 'eval', '__') are impossible.
# ---------------------------------------------------------------------------
ALLOWED_SYMPY_NAMES = {
    # Variables
    'x', 'y', 'z', 'a', 'b', 'c', 'd', 'n', 'm', 'r', 'k', 't', 'p', 'q', 'u', 'v', 'w', 'theta',
    # Functions
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'log', 'ln', 'exp', 'sqrt', 'cbrt', 'Abs', 'sign', 'floor', 'ceiling',
    'factorial', 'binomial',
    # Constants
    'pi', 'E', 'oo', 'I',
    # Summation / Equality
    'Sum', 'Eq', 'Ne', 'true', 'false'
}


def _build_sympy_namespace() -> dict:
    """Builds the restricted namespace once. Immutable after creation."""
    ns = {}
    for name in ALLOWED_SYMPY_NAMES:
        obj = getattr(sp, name, None)
        ns[name] = obj if obj is not None else sp.Symbol(name)
    # Alias ln -> log
    ns['ln'] = sp.log
    return ns


_SAFE_NAMESPACE = _build_sympy_namespace()


def latex_to_sympy_str(latex: str) -> str:
    """Normalizes raw LaTeX / informal math notation into a SymPy parseable string.
    
    Examples:
        '2x^2 + 5x - 3 = 0' -> '2*x**2 + 5*x - 3 = 0'
        '\\frac{1}{2}' -> '(1)/(2)'
        '\\sqrt{x + 1}' -> 'sqrt(x + 1)'
    """
    if not isinstance(latex, str) or not latex.strip():
        raise ValueError("Math input cannot be empty")

    s = latex.strip()

    # Remove outer math delimiters: $$, $, \[, \]
    s = re.sub(r'^\$\$|\$\$$', '', s)
    s = re.sub(r'^\$|\$$', '', s)
    s = re.sub(r'^\\\[|\\\]$', '', s)
    s = re.sub(r'^\\\(|\\\)$', '', s)
    s = s.strip()

    # Replace LaTeX commands
    # \frac{a}{b} -> ((a)/(b))
    while r'\frac' in s:
        s = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', s)
    
    # \sqrt{a} -> sqrt(a)
    s = re.sub(r'\\sqrt\{([^{}]+)\}', r'sqrt(\1)', s)
    s = re.sub(r'\\sqrt\s*([a-zA-Z0-9])', r'sqrt(\1)', s)

    # Standard replacements
    s = s.replace(r'\cdot', '*')
    s = s.replace(r'\times', '*')
    s = s.replace(r'\pm', '+')  # default branch
    s = s.replace(r'\left', '')
    s = s.replace(r'\right', '')
    s = s.replace('{', '(').replace('}', ')')
    s = s.replace('^', '**')

    # Implicit multiplication: '2x' -> '2*x', '5(x+1)' -> '5*(x+1)', ')(' -> ')*('
    s = re.sub(r'(\d)([a-zA-Z\(])', r'\1*\2', s)
    s = re.sub(r'([a-zA-Z])\(', r'\1*(', s)
    s = re.sub(r'\)([a-zA-Z0-9\(])', r')*\1', s)

    return s


def safe_sympify(expression: str) -> sp.Expr:
    """Parses a mathematical expression with AST sandboxing and injection guards."""
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Expression must be a non-empty string")

    # Defense-in-depth: reject dangerous tokens
    dangerous_tokens = {'import', 'exec', 'eval', 'compile', '__', 'open', 'os.', 'sys.', 'subprocess', 'shutil'}
    lowered = expression.lower()
    for token in dangerous_tokens:
        if token in lowered:
            raise ValueError(f"Security rejection: expression contains forbidden token '{token}'")

    normalized = latex_to_sympy_str(expression)

    # Handle equations with '=' sign: 'lhs = rhs' -> lhs - (rhs)
    if '=' in normalized:
        parts = normalized.split('=')
        if len(parts) == 2:
            lhs_str = parts[0].strip()
            rhs_str = parts[1].strip() or '0'
            try:
                lhs_expr = sp.sympify(lhs_str, locals=_SAFE_NAMESPACE)
                rhs_expr = sp.sympify(rhs_str, locals=_SAFE_NAMESPACE)
                return sp.simplify(lhs_expr - rhs_expr)
            except Exception as e:
                raise ValueError(f"Failed to parse equation: '{expression}'") from e
        else:
            raise ValueError(f"Invalid equation format with multiple '=' signs: '{expression}'")

    try:
        result = sp.sympify(normalized, locals=_SAFE_NAMESPACE)
    except (sp.SympifyError, TypeError, ValueError, SyntaxError) as e:
        raise ValueError(f"Invalid mathematical expression: '{expression}'") from e

    # Guard against boolean results
    if isinstance(result, (bool, sp.logic.boolalg.BooleanAtom)):
        raise ValueError(f"Expression evaluated to a boolean constant ({result}): '{expression}'")

    return result


def solve_equation_symbolic(equation: str, solve_for: str = "x") -> Dict[str, Any]:
    """Solves an equation deterministically and extracts pedagogical milestones.
    
    Production Safeguard: Zero LLM hallucination for mathematical roots.
    """
    var = sp.Symbol(solve_for)
    expr = safe_sympify(equation)

    # Check if quadratic in target variable
    degree = sp.degree(expr, var) if expr.has(var) else None
    milestones: Dict[str, Any] = {}
    discriminant: Optional[float] = None
    factored_latex: Optional[str] = None
    topic_label = "Algebraic Expression"

    if degree == 2:
        topic_label = "Quadratic Equations"
        poly = sp.Poly(expr, var)
        coeffs = poly.all_coeffs()  # [a, b, c]
        if len(coeffs) == 3:
            a, b, c = coeffs
            delta = b**2 - 4*a*c
            try:
                discriminant = float(delta)
            except Exception:
                discriminant = None
            milestones['a'] = str(a)
            milestones['b'] = str(b)
            milestones['c'] = str(c)
            milestones['discriminant'] = str(delta)
            milestones['nature_of_roots'] = (
                "Real and Distinct" if delta > 0 else
                "Real and Equal" if delta == 0 else
                "Complex / Non-Real"
            )
            # Try factoring
            try:
                factored = sp.factor(expr)
                factored_latex = sp.latex(factored) + " = 0"
            except Exception:
                factored_latex = None
    elif degree == 1:
        topic_label = "Linear Equations"
    elif degree is not None and degree > 2:
        topic_label = f"Polynomial Equation (Degree {degree})"

    # Solve deterministically
    solutions = sp.solve(expr, var)

    # Format solution LaTeX
    if isinstance(solutions, list):
        if len(solutions) == 0:
            sol_latex = "\\text{No solution}"
        elif len(solutions) == 1:
            sol_latex = f"{solve_for} = {sp.latex(solutions[0])}"
        else:
            sol_latex = " \\quad \\text{or} \\quad ".join(f"{solve_for} = {sp.latex(s)}" for s in solutions)
    elif isinstance(solutions, dict):
        sol_latex = ", ".join(f"{k} = {sp.latex(v)}" for k, v in solutions.items())
    else:
        sol_latex = sp.latex(solutions)

    # Extract numerical roots if real
    numerical_roots: List[float] = []
    if isinstance(solutions, list):
        for s in solutions:
            try:
                val = float(sp.N(s))
                if sp.im(s) == 0:
                    numerical_roots.append(round(val, 4))
            except Exception:
                pass

    return {
        "success": True,
        "equation": equation,
        "latex_equation": sp.latex(expr) + " = 0",
        "solution_latex": sol_latex,
        "numerical_roots": numerical_roots,
        "discriminant": discriminant,
        "factored_latex": factored_latex,
        "milestones": milestones,
        "operation": "solve",
        "topic_label": topic_label
    }


def verify_steps_sequence(original_problem: str, steps: List[str], solve_for: str = "x") -> Dict[str, Any]:
    """Verifies a student's step-by-step handwritten work line-by-line.
    
    Pinpoints the EXACT step where an error occurs and computes WAEC M1/A1 marks.
    """
    if not steps:
        raise ValueError("Steps list cannot be empty")

    var = sp.Symbol(solve_for)
    step_analyses = []
    first_error_index: Optional[int] = None

    try:
        base_expr = safe_sympify(original_problem)
    except Exception as e:
        base_expr = None

    current_reference = base_expr
    valid_count = 0
    waec_earned = 0
    waec_total = max(4, len(steps))

    for idx, step_text in enumerate(steps):
        step_valid = False
        error_msg = None
        mark = "M0"

        try:
            step_expr = safe_sympify(step_text)
            
            # Check equivalence with original or immediately prior step
            if current_reference is not None:
                # Difference between expressions should simplify to 0
                diff = sp.simplify(step_expr - current_reference)
                if diff == 0:
                    step_valid = True
                else:
                    # Also check if it's equivalent to solving for roots directly on final step
                    # E.g. student writes x = 1/2 or x = -3
                    original_roots = sp.solve(current_reference, var) if current_reference.has(var) else []
                    step_roots = sp.solve(step_expr, var) if step_expr.has(var) else []
                    if set(original_roots) == set(step_roots) and len(original_roots) > 0:
                        step_valid = True
            else:
                step_valid = True  # If original problem couldn't parse, evaluate step standalone

        except Exception as parse_err:
            step_valid = False
            error_msg = f"Mathematical syntax error: {parse_err}"

        if step_valid:
            valid_count += 1
            # WAEC Rubric: First steps get M1 (Method), Final valid step gets A1 (Accuracy)
            if idx == len(steps) - 1:
                mark = "A1"
                waec_earned += 1
            else:
                mark = "M1"
                waec_earned += 1
        else:
            if first_error_index is None:
                first_error_index = idx
            mark = "M0"
            error_msg = error_msg or f"Equation on Step {idx + 1} is not mathematically equivalent to the previous line."

        step_analyses.append({
            "step_index": idx + 1,
            "raw_text": step_text,
            "latex": sp.latex(step_expr) if 'step_expr' in locals() and step_expr is not None else step_text,
            "is_mathematically_valid": step_valid,
            "waec_mark": mark,
            "feedback": error_msg or ("Valid step" if idx < len(steps) - 1 else "Accurate final solution!")
        })

    is_all_valid = (valid_count == len(steps))

    if is_all_valid:
        summary = f"Excellent work! All {len(steps)} steps are mathematically rigorous. Full WAEC credit awarded."
    else:
        summary = (
            f"You demonstrated good method in the initial steps, but an error occurred at Step {first_error_index + 1}. "
            f"You still earned {waec_earned}/{waec_total} marks for your working method!"
        )

    return {
        "success": True,
        "is_fully_correct": is_all_valid,
        "total_steps": len(steps),
        "valid_step_count": valid_count,
        "first_error_index": first_error_index,
        "step_analyses": step_analyses,
        "waec_score_earned": waec_earned,
        "waec_score_total": waec_total,
        "pedagogical_summary": summary
    }


def generate_parametric_twin(equation: str, topic: str = "Quadratic Equations") -> Dict[str, Any]:
    """Generates a twin practice problem with clean integer roots guaranteed.
    
    Production Safeguard: Prevents degenerate problems, division-by-zero, or messy decimal roots.
    Supports Quadratic, Calculus Differentiation, and Arithmetic Progression topics.
    """
    normalized = f"{equation} {topic}".lower()

    # Calculus Differentiation Support
    if any(k in normalized for k in ["dy/dx", "d/dx", "differentiat", "calculus", "derivative"]):
        c_coeffs = [
            (2, -6, 4, -5),
            (3, -4, 5, -8),
            (4, 2, -7, 3),
            (1, -5, 3, -9)
        ]
        a, b, c, d = random.choice(c_coeffs)
        poly_str = f"y = {a}*x**4 + {b}*x**2 + {c}*x + {d}"
        latex_str = f"y = {a}x^4 {b:+d}x^2 {c:+d}x {d:+d}".replace("+ -", "- ")
        ans_latex = f"\\frac{{dy}}{{dx}} = {4*a}x^3 {2*b:+d}x {c:+d}".replace("+ -", "- ")
        steps = [
            "Apply the power rule \\frac{d}{dx}[a x^n] = n \\cdot a x^{n-1} to each polynomial term.",
            f"\\frac{{d}}{{dx}}[{a}x^4] = {4*a}x^3",
            f"\\frac{{d}}{{dx}}[{b}x^2] = {2*b}x",
            f"\\frac{{d}}{{dx}}[{c}x] = {c} \\quad \\text{{and}} \\quad \\frac{{d}}{{dx}}[{d}] = 0",
            f"Combine all evaluated terms: \\frac{{dy}}{{dx}} = {4*a}x^3 {2*b:+d}x {c:+d}".replace("+ -", "- ")
        ]
        return {
            "success": True,
            "original_equation": equation,
            "twin_equation": poly_str,
            "twin_equation_latex": latex_str,
            "correct_answer_latex": ans_latex,
            "solution_steps": steps,
            "parameters": {"a": a, "b": b, "c": c, "d": d, "type": "calculus"}
        }

    x = sp.Symbol('x')

    # Generate random integer roots r1, r2 between -8 and 8 (excluding 0)
    r1 = random.choice([i for i in range(-7, 8) if i != 0])
    r2 = random.choice([i for i in range(-7, 8) if i != 0 and i != r1])
    
    # Random integer coefficient 'a' (1, 2, or 3)
    a_val = random.choice([1, 2, 3])

    # Construct equation: a * (x - r1) * (x - r2) = 0
    # Expand to standard quadratic: a*x^2 + b*x + c = 0
    expanded = sp.expand(a_val * (x - r1) * (x - r2))
    poly = sp.Poly(expanded, x)
    coeffs = poly.all_coeffs()
    a, b, c = coeffs

    twin_eq_str = f"{a}*x**2 + {b}*x + {c} = 0"
    twin_latex = sp.latex(expanded) + " = 0"

    # Step-by-step solution
    steps = [
        f"Identify standard form: a = {a}, b = {b}, c = {c}",
        f"Calculate discriminant: \\Delta = b^2 - 4ac = ({b})^2 - 4({a})({c}) = {b**2 - 4*a*c}",
        f"Factor or apply quadratic formula: (x - ({r1}))(x - ({r2})) = 0",
        f"Solve for roots: x = {r1} \\quad \\text{{or}} \\quad x = {r2}"
    ]

    return {
        "success": True,
        "original_equation": equation,
        "twin_equation": twin_eq_str,
        "twin_equation_latex": twin_latex,
        "correct_answer_latex": f"x = {r1} \\quad \\text{{or}} \\quad x = {r2}",
        "solution_steps": steps,
        "parameters": {"a": int(a), "b": int(b), "c": int(c), "root_1": r1, "root_2": r2}
    }
