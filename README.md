# <div align="center"><h1>📐 SolvAm (SolveAm)</h1><h3>Zero-Hallucination Neuro-Symbolic Math Tutor & "Red-Pen" WAEC Diagnostic Grader</h3><p><em>Built for Meta AI Developer Hackathon 2026 — Track 1: Build for Your World (Indie Developer)</em></p></div>

<div align="center">

[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015%20App%20Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-000000?style=for-the-badge&logo=turborepo)](https://turbo.build/)
[![FastAPI](https://img.shields.io/badge/Symbolic_Engine-FastAPI%20%2B%20SymPy-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Meta AI](https://img.shields.io/badge/Meta_AI-SAM_3.1_%7C_Muse_Spark_%7C_Voice_%7C_Image-0466c8?style=for-the-badge&logo=meta)](https://ai.meta.com/)
[![Turso](https://img.shields.io/badge/Database-Turso%20libSQL-4FF8D2?style=for-the-badge&logo=sqlite&logoColor=black)](https://turso.tech/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=for-the-badge&logo=clerk)](https://clerk.com/)

</div>

---

## ⚡ 1-Minute Hackathon Judge Quickstart

If you are evaluating SolvAm for the **Meta Global AI Developer Hackathon 2026**, use our top-bar **1-Click Judge Mode**:

1. Open `http://localhost:3000` (or the deployed live URL).
2. **Sample 1 (SAM 3.1 Exam Scanner):** Click to isolate 4 individual questions on an authentic 2024 WASSCE Theory paper with pulsing polygon masks and bounding boxes.
3. **Sample 2 (Geometry & Pidgin Audio):** Click to trigger the full Muse Spark tool loop on a circle sector ($r=7\text{ cm}, \theta=60^\circ$) with an SVG geometry diagram and bilingual spoken voice tutor (English / Nigerian Pidgin 🇳🇬).
4. **Sample 3 (Red-Pen Handwritten Grader):** Click to inspect authentic student notebook working in blue Bic ink. Watch SolvAm award partial Method Marks (`M1`) on Line 1, locate the sign mistake on Line 2 (`-6x - x = -7x`), and generate a fresh twin problem for paper practice.
5. **Architecture HUD:** Click **"Open Architecture & Telemetry HUD"** to view real-time latency breakdowns and test ANY equation on the live SymPy CAS Scratchpad.

---

## 📌 Executive Summary & Problem Statement

Over **729,429 students fail WASSCE / SSCE mathematics annually in West Africa** (a 37% failure rate). Conventional LLM-based math assistants fail African candidates because:
- **Catastrophic Arithmetic Hallucination:** LLMs make confident calculation errors on intermediate algebra, confusing students.
- **Missing Marking Rubrics:** Real examinations are graded on **Method Marks (`M1`)** and **Accuracy Marks (`A1`)**. A candidate who gets the right final number with flawed working earns zero marks; a candidate with clean method who slips on the last arithmetic step still earns 4 out of 5 marks.
- **Language & Context Disconnect:** Textbook explanations use alien analogies rather than relatable local context or vernacular (Nigerian Pidgin).

**SolvAm** solves this through a **Neuro-Symbolic architecture**:
1. **Zero-Hallucination CAS Invariant:** The LLM *never* performs raw math calculations. Python `SymPy` Computer Algebra System (CAS) computes exact roots, discriminants ($\Delta = b^2 - 4ac$), and algebraic syntax tree (AST) step subtractions (`sp.simplify(step_expr - reference_expr) == 0`).
2. **Official WAEC Marking Rubrics:** Explanations and diagnostics are graded using official WAEC Method (`M1`) and Accuracy (`A1`) mark breakdowns.
3. **"Red-Pen" Handwritten Work Grader:** Students solve problems in their real paper notebooks, snap a photo, and SolvAm stamps green `[M1 Earned]` badges and a pulsing red diagnostic box `[M0 Lost Here]` directly on their paper.
4. **Desktop-to-Mobile QR Camera Bridge:** Scan a QR code from any smartphone to pair the phone camera with the desktop workspace in real-time via Native Server-Sent Events (SSE).
5. **Multimodal Meta AI Stack:** Orchestrates **Meta SAM 3.1**, **Meta Muse Spark 1.3**, **Meta Muse Voice Transcribe**, and **Meta Muse Image** in a unified agentic loop.

---

## 🏗️ System Architecture & Meta AI Orchestration

```mermaid
flowchart TB
    subgraph Client ["Client Layer (Next.js 15 PWA)"]
        Web["Desktop / Laptop UI\n(Judge Mode Quickbar + Telemetry HUD)"]
        Mobile["Smartphone Camera Lens\n(Canvas <150KB Image Optimizer)"]
        VoiceIO["Voice Tutor Modal\n(Web Audio API + LaTeX-to-Speech Normalizer)"]
    end

    subgraph MetaAI ["Meta AI Multi-Model Orchestration Layer"]
        SAM["Meta SAM 3.1\n(Multi-Equation Page Segmentation & Bounding Boxes)"]
        MuseSpark["Meta Muse Spark 1.3\n(Multimodal Vision & Native Tool Calling Agent)"]
        MuseVoice["Meta Muse Voice Transcribe\n(Interactive Spoken Candidate Inquiries)"]
        MuseImg["Meta Muse Image\n(Mathematical Geometry & Parabola Visualizer)"]
    end

    subgraph Symbolic ["Deterministic Symbolic CAS Engine (Python 3.12 / FastAPI)"]
        FastAPI["Uvicorn Server (:8000)"]
        ASTGuard["safe_sympify() AST Whitelist Filter"]
        StepVerifier["Line-by-Line Equivalence Checker\n(sp.simplify(LHS - RHS) == 0)"]
        TwinGen["Parametric WAEC Twin Generator\n(Clean Integer Solutions)"]
    end

    subgraph Persistence ["Persistence & Cloud Layer"]
        Turso["Turso Remote libSQL Cloud\n(Atomic Credit Sync & User Profiles)"]
        LocalSQLite["Local SQLite Fallback (file:local.db)"]
        SSEBridge["Native SSE Camera Bridge API\n(No Third-Party Sockets Required)"]
    end

    Mobile -->|"Snap Exam Page"| SSEBridge --> Web
    Web -->|"Segment Sheet"| SAM
    Web -->|"Orchestrate Solution"| MuseSpark
    MuseSpark -->|"Native Tool Call: solve_equation"| FastAPI
    FastAPI --> ASTGuard --> StepVerifier & TwinGen
    MuseSpark -->|"Synthesize Diagram"| MuseImg
    Web <-->|"Voice Q&A"| MuseVoice
    Web <--> Turso
    Turso -.->|"Offline Dropout"| LocalSQLite
```

---

## 🔬 How Each Meta AI Tool Is Used

| Meta AI Model | Role in SolvAm | Innovation / Safeguard |
|---|---|---|
| **Meta SAM 3.1** | Multi-equation exam page segmentation | Isolates individual problem clusters from complex printed WAEC exam papers; outputs polygon masks and normalized `[yMin, xMin, yMax, xMax]` coordinates. |
| **Meta Muse Spark 1.3** | Multimodal reasoning & native tool loop | Orchestrates the solve pipeline; executes native tool calls into Python SymPy; translates deterministic AST milestones into 3-tier adaptive scaffolding. |
| **Meta Muse Voice Transcribe** | Bidirectional voice candidate tutor | Transcribes candidate verbal questions; pairs with our Phonetic LaTeX-to-Speech Normalizer for natural math reading (reads `\frac{1}{2}` as *"one half"*, not *"backslash frac"*). |
| **Meta Muse Image** | Mathematical concept visualizer | Synthesizes precision mathematical diagrams (circle sectors with radius and central angle $\theta$, right-angled triangles, quadratic parabolas). |

---

## 📂 Repository Structure

```text
SolveAm/
├── apps/
│   └── web/                         # Next.js 15 App Router Frontend & Gateway
│       ├── public/                  # PWA Manifest, SVG Favicons, App Icons
│       ├── src/
│       │   ├── app/                 # Routes: /, /capture, /api/*
│       │   │   ├── api/math/        # segment, transcribe, grade-handwriting, diagram, voice
│       │   │   ├── api/session/     # create, stream (Native SSE), upload
│       │   │   └── api/user/        # auth, me (Clerk + Guest profile)
│       │   ├── components/          # JudgeModeBar, JudgeTelemetryDrawer, RedPenGraderCanvas,
│       │   │                        # SamSegmentationCanvas, ScaffoldingSolutionView, MathDisplay
│       │   └── lib/                 # auth.ts, db.ts, symbolicClient.ts, audio/*, image/*, fixtures/*
│       ├── .env.example             # Documented environment template
│       └── package.json
├── packages/
│   └── shared-types/                # Shared TypeScript contracts & schemas
├── services/
│   └── symbolic-engine/             # Python FastAPI + SymPy CAS microservice
│       ├── main.py                  # API endpoints (/symbolic/solve, /verify-steps, /generate-twin)
│       ├── math_engine.py           # SymPy AST verification logic
│       ├── schemas.py               # Pydantic schemas
│       └── requirements.txt
├── turbo.json                       # Turborepo pipeline orchestration
├── package.json                     # Root monorepo configuration
└── README.md
```

---

## ⚙️ Prerequisites

* **Node.js:** `v18.18+` or `v20+`
* **npm:** `v10+`
* **Python:** `3.10` to `3.12`
* **Git**

---

## 🚀 Step-by-Step Replication & Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/SolveAm.git
cd SolveAm
```

### 2. Install Root & Monorepo Dependencies

```bash
npm install
```

### 3. Setup Python Deterministic Symbolic Engine

#### Windows (PowerShell):
```powershell
cd services/symbolic-engine
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..
```

#### macOS / Linux:
```bash
cd services/symbolic-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 4. Configure Environment Variables

Create `apps/web/.env.local` by copying the documented template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
# ------------------------------------------------------------------------------
# 1. CLERK AUTHENTICATION (Optional: leave blank for Guest Mode with 50 credits)
# ------------------------------------------------------------------------------
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ------------------------------------------------------------------------------
# 2. TURSO DATABASE (Defaults to local SQLite 'file:local.db' if empty or offline)
# ------------------------------------------------------------------------------
TURSO_DATABASE_URL="file:local.db"
TURSO_AUTH_TOKEN=

# ------------------------------------------------------------------------------
# 3. DETERMINISTIC SYMBOLIC ENGINE (FastAPI)
# ------------------------------------------------------------------------------
SYMBOLIC_ENGINE_URL="http://localhost:8000"
NEXT_PUBLIC_SYMBOLIC_ENGINE_URL="http://localhost:8000"

# ------------------------------------------------------------------------------
# 4. META AI MODEL API (Optional: fallback loop runs deterministic local SymPy)
# ------------------------------------------------------------------------------
META_API_KEY=
META_API_URL="https://api.meta.ai/v1/chat/completions"
```

> [!NOTE]
> **Zero-Friction Hackathon Mode:** SolvAm executes out-of-the-box even with empty keys! It automatically provides anonymous guest student sessions (50 free credits), local SQLite (`local.db`), pre-warmed WAEC fixtures, and local SymPy AST solving.

---

## 🏃 Running the Application

### Terminal 1: Start Python Symbolic Engine (Port 8000)

```bash
npm run dev:symbolic
```
*Health check runs at: `http://localhost:8000/health`*

### Terminal 2: Start Next.js Frontend via Turborepo (Port 3000)

```bash
npm run dev
```
*App is ready at `http://localhost:3000` (and on local LAN for mobile QR pairing).*

---

## 📱 Mobile QR Camera Pairing

1. Open `http://localhost:3000` on your desktop browser.
2. Click **"Scan with Phone (QR)"** in the top navigation bar.
3. SolvAm auto-detects your laptop's local LAN IPv4 address (e.g. `http://192.168.x.x:3000/capture?session=...`) and encodes it in the QR code.
4. Point your phone camera at the QR code, snap your handwritten problem, and watch it stream to your desktop in real-time via Native Server-Sent Events (SSE).

---

## 🛡️ Production Safeguards Implemented

* **Deterministic CAS Guard:** Input expressions run through an AST whitelist filter preventing code injection or unsafe Python evaluations.
* **Zero-Hallucination Constraint:** Equivalence verification uses `sp.simplify(step - reference) == 0`. The LLM is strictly decoupled from raw arithmetic.
* **Auto Offline Failover:** The database client catches remote network dropouts and automatically falls back to local SQLite without crashing user sessions.
* **Non-Blocking Auth:** Validates Clerk key formats before mounting `<ClerkProvider>` to prevent server-side hydration panics in offline mode.
* **Atomic Server-Verified Credits:** SolvAm deducts credits on the server *after* a successful calculation, preventing race conditions.
* **Bilingual LaTeX Phonetic Normalization:** Cleans raw LaTeX math before Web Speech API or TTS synthesis so formulas sound natural in English and Nigerian Pidgin.

---

## 🏆 Hackathon Judging Rubric Mapping

| Criterion | Weight | SolvAm Implementation |
|---|---|---|
| **Impact** | **30%** | Solves the 729,429 annual WAEC failure crisis. Replaces opaque numeric answers with official `[M1]` Method Marks and `[A1]` Accuracy Marks tailored to the West African curriculum. |
| **Meta AI Tooling** | **25%** | Native parallel orchestration of **Meta SAM 3.1**, **Meta Muse Spark 1.3** agentic tool-loop, **Meta Muse Voice Transcribe**, and **Meta Muse Image** visualizer. |
| **Demo & UX** | **25%** | Instant 1-Click Judge Mode bar with 3 live samples, zero-friction anonymous guest sessions (no login required to test), and real-time reverse QR camera bridge. |
| **Technical Depth** | **20%** | Neuro-symbolic design: decoupled neural perception (Meta Vision) and deterministic algebraic ground truth (Python SymPy CAS) with AST subtraction. |
