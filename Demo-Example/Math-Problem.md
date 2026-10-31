# 📐 SolvAm Hackathon Evaluation — Sample Math Problems

Use these curated exam problems to test SolvAm across different West African Senior School Certificate Examination (WASSCE / WAEC) topics and verify SolvAm's neuro-symbolic step breakdown, deterministic SymPy CAS verification, and isomorphic twin problem generator.

---

### 1. Arithmetic Progression (A.P.)
**Problem Statement:**
```text
The first term of an arithmetic progression (AP) is 9 and the common difference is 4. If the AP has 10 terms in total, find the 5th term and the last term.
```
*Or handwritten exam short-form (matches the sample in `Demo-Example/Images/`):*
```text
Find the 10th term of the A.P: 3, 7, 11, 15
```
- **What to look for:** SolvAm extracts $a = 9$, $d = 4$, $n = 10$, applies formula $T_n = a + (n - 1)d$, and computes $T_5 = 25$ and $T_{10} = 45$ with zero arithmetic hallucination.

---

### 2. Commercial Mathematics & Simple Interest (WAEC 2021 Question 6a)
**Problem Statement:**
```text
Fred bought a car for $5,600.00 and later sold it at 90% of the cost price. He spent $1,310.00 out of the amount received and invested the rest at 6% per annum simple interest. Calculate the interest earned in 3 years.
```
- **What to look for:** Multimodal reasoning breaks this into sequential milestones:
  1. Selling Price $= 0.90 \times 5600 = \$5,040.00$
  2. Amount Invested (Principal) $= 5040 - 1310 = \$3,730.00$
  3. Simple Interest $= \frac{P \times R \times T}{100} = \frac{3730 \times 6 \times 3}{100} = \$671.40$
- Click **"Break down a similar twin variation"** to verify the isomorphic twin generator synthesizes a new commercial math question with clean integer numbers.

---

### 3. Quadratic Equations (WAEC 2024 Q1a)
**Equation:**
```text
3x^2 - 5x - 2 = 0
```
- **What to look for:** Verified discriminant ($\Delta = b^2 - 4ac = 25 - 4(3)(-2) = 49$), factor pair derivation $(3x + 1)(x - 2) = 0$, exact roots $x = 2$ or $x = -1/3$, and 15-second exam room substitution check $3(2)^2 - 5(2) - 2 = 0$.

---

### 4. Simultaneous Exponential Equations (WAEC 2021 Question 6b)
**Equations:**
```text
Solve 2^x * (4^-7) = 2 and 3^-x * (9^2y) = 3 simultaneously
```
- **What to look for:** Applies laws of indices ($4 = 2^2 \implies 2^{x - 14} = 2^1 \implies x = 15$, then substitutes into $3^{-x + 4y} = 3^1 \implies y = 4$).

---

### 5. Calculus Differentiation
**Equation:**
```text
y = 3x^4 - 5x^2 + 2x - 7
```
- **What to look for:** Power rule step-by-step breakdown resulting in $\frac{dy}{dx} = 12x^3 - 10x + 2$.

---

## 📷 Testing the Meta SAM 3.1 Exam Scanner
To test real paper perception:
1. Click **Upload** (or **Scan**) in the top header.
2. Select the sample photo in [`Demo-Example/Images/20261031_151049 (1).jpg`](./Images/20261031_151049%20(1).jpg).
3. Meta SAM 3.1 isolates the handwritten problem region with a bounding box and Meta Muse Spark extracts the handwritten text into editable LaTeX.
