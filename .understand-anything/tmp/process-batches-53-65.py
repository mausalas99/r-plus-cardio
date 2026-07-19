#!/usr/bin/env python3
"""Process Understand Anything batches 53-65: extract-structure + semantic graph."""
import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/mauriciosalas/R+")
PLUGIN_ROOT = Path("/Users/mauriciosalas/.understand-anything-plugin")
SKILL_DIR = PLUGIN_ROOT / "skills/understand"
INTER = PROJECT_ROOT / ".understand-anything/intermediate"
TMP = PROJECT_ROOT / ".understand-anything/tmp"

# Semantic summaries keyed by exact path (LLM-curated for this project)
SEMANTIC = {
    "docs/superpowers/specs/2026-06-11-v8-virtualized-lists.md": (
        "Design spec for v8 virtualized patient lists (>30 active census rows) with lazy rendering and scroll performance budgets.",
        ["documentation", "performance", "virtualization", "spec"],
    ),
    "docs/superpowers/specs/2026-06-20-hallmark-ui-audit-tracks-design.md": (
        "Hallmark UI audit track plan covering z-index/scrim tokens, radius hierarchy, lab/pase tokenization, and empty-state parity.",
        ["documentation", "design-system", "ui-audit", "spec"],
    ),
    "docs/superpowers/specs/2026-06-20-hallmark-v5-chart-desk-proposal.md": (
        "Proposal for hallmark v5 chart desk layout integrating Estado Actual charts with workbench surfaces.",
        ["documentation", "charts", "ui-proposal", "spec"],
    ),
    "lib/historia-clinica/catalogs/ahf-conditions.json": (
        "JSON catalog of hereditary/family-history condition labels used when parsing and normalizing HC AHF sections.",
        ["configuration", "historia-clinica", "catalog", "schema-definition"],
    ),
    "lib/historia-clinica/catalogs/app-conditions.json": (
        "Catalog of personal pathological antecedent (APP) condition names for structured HC suggestions and Drive import.",
        ["configuration", "historia-clinica", "catalog", "schema-definition"],
    ),
    "lib/historia-clinica/catalogs/genero-field-specs.json": (
        "Field specifications for gender/sex-specific HC blocks (labels, visibility rules) consumed by genero-options.mjs.",
        ["configuration", "historia-clinica", "catalog", "schema-definition"],
    ),
    "lib/historia-clinica/catalogs/ipas-systems.json": (
        "Catalog of IPAS body-system labels for structured antecedentes parsing in historia clínica panels.",
        ["configuration", "historia-clinica", "catalog", "schema-definition"],
    ),
    "lib/historia-clinica/catalogs/toxicomanias-substances.json": (
        "Substance name list for toxicomanías entries; imported by toxicomanias.mjs and Drive HC extractors.",
        ["configuration", "historia-clinica", "catalog", "schema-definition"],
    ),
    "public/demo-patients/demo-perez.json": (
        "Demo patient fixture bundle with census, labs, and clinical state for onboarding and pitch screenshots.",
        ["configuration", "demo-data", "fixtures", "clinical"],
    ),
    "public/demo-patients/demo-pitch-bundle.json": (
        "Rich demo patient dataset packaged for product pitch flows with pre-filled labs and estado actual.",
        ["configuration", "demo-data", "fixtures", "clinical"],
    ),
    "public/demo-patients/demo-pitch-rango.json": (
        "Demo patient with wide lab value ranges for showcasing trend charts and alert styling in pitches.",
        ["configuration", "demo-data", "fixtures", "clinical"],
    ),
    "public/index.html": (
        "Assembled Electron renderer shell HTML: chrome, modals, feature panels, and script tags for app.bundle.mjs.",
        ["entry-point", "markup", "ui-shell", "electron-renderer"],
    ),
    "public/index.src.html": (
        "Source HTML template with partial placeholders consumed by scripts/build-ui.mjs before bundling.",
        ["markup", "build-system", "ui-shell", "template"],
    ),
    "public/min-version.json": (
        "Minimum supported app version gate used by auto-updater downgrade protection.",
        ["configuration", "release", "version-gate"],
    ),
    "public/tokens.css": (
        "Global design tokens: color ramps, spacing, z-index layers, radius hierarchy, and scrim variables for the workbench.",
        ["markup", "design-system", "css-variables", "tokens"],
    ),
    "preload.js": (
        "Electron preload bridge exposing window.electronAPI IPC channels for DB, LAN, exports, and native integrations.",
        ["entry-point", "electron", "ipc-bridge", "security"],
    ),
    "public/interno/index.html": (
        "Minimal HTML entry for the interno/guardia mobile web board served by the LAN server.",
        ["markup", "interno-mobile", "entry-point"],
    ),
    "public/interno/interno.css": (
        "Styles for the interno mobile guardia board: ward cards, vitals, team scope, and touch-friendly layout.",
        ["markup", "interno-mobile", "css", "mobile"],
    ),
    "public/js/age-calc.mjs": (
        "Date-of-birth parsing and age calculation helpers for census cards, docs export, and clinical displays.",
        ["utility", "date", "clinical", "exports"],
    ),
    "public/js/labs-procesar.mjs": (
        "Orchestrator for procesarLabs: segments pasted lab reports into per-patient structured lab blocks.",
        ["utility", "labs", "parser", "exports"],
    ),
    "public/js/guardia-v7-gating.mjs": (
        "Feature gating and progress nudges for guardia v7 onboarding meter on the ward board.",
        ["feature", "guardia", "onboarding", "gating"],
    ),
    "public/js/profile-template-preview.mjs": (
        "Preview renderer for pharmacotherapeutic profile templates before export or print.",
        ["utility", "export", "preview", "clinical"],
    ),
    "public/js/trend-spark-canvas.mjs": (
        "Canvas-based mini sparkline renderer for lab trend cells in sidebar and list views.",
        ["utility", "charts", "canvas", "labs"],
    ),
    "scripts/build-ui.mjs": (
        "Assembles public/index.html from partials and source template; required after markup or partial edits.",
        ["build-system", "script", "ui-assembly", "entry-point"],
    ),
    "scripts/ensure-sqlcipher-electron-native.mjs": (
        "Ensures SQLCipher native binary matches Electron ABI during prestart and release builds.",
        ["build-system", "native", "sqlcipher", "electron"],
    ),
    "scripts/lib/test-manifest.mjs": (
        "Explicit npm test file manifest with drift guard preventing accidental full-suite file drops.",
        ["build-system", "ci-cd", "test", "validation"],
    ),
    "scripts/metrics/baseline.json": (
        "Committed technical-debt baseline snapshot: complexity, length, duplication, and boot-graph scores per file.",
        ["configuration", "metrics", "technical-debt", "ci-cd"],
    ),
    "eslint.config.mjs": (
        "Flat ESLint config enforcing complexity and max-lines budgets aligned with debt ratchet rules.",
        ["configuration", "lint", "quality-gate", "build-system"],
    ),
    "lib/censo-export-file.mjs": (
        "Writes census PDF/export files to disk from renderer-initiated export requests.",
        ["utility", "export", "censo", "document-generation"],
    ),
    "lib/interno/qr-svg.mjs": (
        "Generates SVG QR codes for interno sala join links displayed on the guardia board.",
        ["utility", "interno-mobile", "qr", "svg"],
    ),
    "template_listado.docx": (
        "Word template for patient listado (.docx) exports used by doc-generators.",
        ["document-generation", "template", "export", "clinical"],
    ),
    "template.docx": (
        "Primary clinical note (.docx) export template with SOME-structured sections.",
        ["document-generation", "template", "export", "clinical"],
    ),
}

PLAN_SUMMARIES = {
    "001": "CI test manifest integrity — explicit file list and drift guard for npm test.",
    "002": "Server-side patient purge guard enforcing host ownership before DELETE.",
    "003": "Host store durability: commit barrier, flush on quit, persist failure reporting.",
    "004": "Global shift PIN lockout on repeated auth exchange failures.",
    "005": "Storage parsed-blob cache for faster lab/history hydration.",
    "006": "Clinico access scope decomposition into per-rank evaluators.",
    "007": "Cultivo block parser consolidation into cultivo-block-core.mjs.",
    "008": "LAN core characterization tests for orchestrator and transport.",
    "009": "DX hygiene: lint rules, docs truth, agent changelog discipline.",
    "010": "LAN client identity store for host purge and ownership guards.",
    "011": "Cultivo detect superset merge behavior on LAN sync.",
    "012": "Lint and docs truth alignment across project-context and indices.",
    "013": "Quarantine drain for hung test suites removed from manifest.",
    "014": "Host store hot path: DB-first clinical ops and reduced JSON churn.",
    "015": "Patient fields stub for future schema expansion.",
    "016": "Window.open allowlist hardening in Electron shell.",
    "017": "Native rebuild skip when ABI already matches Electron.",
    "018": "App shell modal budget and complexity ratchet.",
    "019": "LAN orchestrator decomposition into focused submodules.",
    "020": "IPC handler integration tests with fake ipcMain harness.",
}

CSS_SUMMARIES = {
    "base.css": "Global resets, typography, and shared utility classes for the renderer workbench.",
    "cmdk.css": "Command palette (cmdk) overlay styling and keyboard navigation affordances.",
    "components.css": "Shared component primitives: buttons, chips, badges, and form controls.",
    "estado-actual.css": "Estado Actual panel: vitals grid, I/O charts, tabs, and monitoreo modal styles.",
    "eventualidades.css": "Eventualidades (incident) timeline and alert chip styling.",
    "expediente.css": "Expediente tab shell, HC sidebar, and clinical record layout.",
    "group-row.css": "Grouped census row layout for team-scoped patient lists.",
    "historia-clinica.css": "Historia clínica panel forms, catalog pickers, and section editors.",
    "lab.css": "Lab panel tables, bulk paste preview, trend colors, and section headers.",
    "layout.css": "App shell grid: sidebar, main stage, responsive breakpoints.",
    "med-pharm-profile.css": "Pharmacotherapeutic profile editor and preview surfaces.",
    "mobile-surfaces.css": "Shared mobile-specific layout overrides for LAN-served pages.",
    "mobile.css": "Legacy mobile layout rules for narrow viewports.",
    "modals.css": "Modal stack, scrims, z-index layers, and dialog animations.",
    "motion.css": "Reduced-motion-safe transitions and micro-interaction keyframes.",
    "overlays.css": "Toast, tooltip, and lightweight overlay positioning.",
    "pase-board.css": "Pase de guardia board: cards, lanes, handoff chips, and ward chrome.",
    "receta-hu.css": "Receta HU print preview and prescription form styling.",
    "rpc-date-picker.css": "RPC-style date picker widget used in clinical date fields.",
    "settings.css": "Ajustes panel: teams, LAN, updates, help tours, and release notes.",
    "sidebar.css": "Patient sidebar cards, bed-first layout, and quick actions.",
    "skeleton.css": "Loading skeleton placeholders for async panel hydration.",
    "soft-ui.css": "Soft UI elevation shadows and card surface treatments.",
    "vpo.css": "VPO documentation panel typography and section layout.",
    "workbench-surfaces.css": "Workbench surface tokens bridging tokens.css to feature panels.",
    "workbench-tokens.css": "Supplemental workbench-scoped CSS custom properties.",
}


def file_node_type(file_meta):
    path = file_meta["path"]
    cat = file_meta["fileCategory"]
    lang = file_meta.get("language", "")
    if cat == "config":
        return "config"
    if cat == "docs":
        return "document"
    if cat == "data":
        return "schema" if lang in ("graphql", "protobuf", "prisma") else "schema"
    if cat == "infra":
        if ".github/workflows" in path or ".gitlab-ci" in path:
            return "pipeline"
        if path.endswith(".tf") or "Vagrantfile" in path:
            return "resource"
        return "service"
    return "file"


def node_prefix(n_type):
    return {
        "file": "file", "config": "config", "document": "document",
        "service": "service", "pipeline": "pipeline", "resource": "resource",
        "table": "table", "schema": "schema", "endpoint": "endpoint",
    }.get(n_type, "file")


def complexity(non_empty):
    if non_empty < 50:
        return "simple"
    if non_empty <= 200:
        return "moderate"
    return "complex"


def basename(p):
    return p.rsplit("/", 1)[-1]


def semantic_for(path, file_meta, result):
    if path in SEMANTIC:
        return SEMANTIC[path]
    base = basename(path)
    if path.startswith("plans/") and base.endswith(".md") and base != "README.md":
        num = base.split("-")[0]
        desc = PLAN_SUMMARIES.get(num, f"Implementation handoff plan {num} for R+ backlog.")
        return (desc, ["documentation", "implementation-plan", "development"])
    if path.startswith("public/styles/") and base in CSS_SUMMARIES:
        return (CSS_SUMMARIES[base], ["markup", "css", "design-system", "ui"])
    if path.startswith(".agents/skills/") and base == "SKILL.md":
        skill = path.split("/")[-2]
        return (
            f"Agent skill instructions for {skill.replace('-', ' ')} workflows used by AI coding assistants.",
            ["documentation", "agent-skill", "development"],
        )
    if path.startswith(".cursor/rules/") and path.endswith(".mdc"):
        rule = basename(path).replace(".mdc", "")
        return (
            f"Cursor workspace rule enforcing {rule.replace('-', ' ')} conventions for R+ agents.",
            ["documentation", "cursor-rule", "development", "configuration"],
        )
    if ".test." in path or path.endswith(".test.mjs") or path.endswith(".test.js"):
        prod = path.replace(".test.mjs", ".mjs").replace(".test.js", ".js")
        return (
            f"Unit/integration tests exercising {basename(prod)} behavior under Electron node test runner.",
            ["test", "validation", "electron"],
        )
    if file_meta["fileCategory"] == "docs":
        sections = result.get("sections") or []
        heading = sections[0]["heading"] if sections else basename(path)
        return (
            f"Project documentation covering {heading.lower()} for R+ clinical workbench.",
            ["documentation", "development"],
        )
    fn = len(result.get("functions") or [])
    cls = len(result.get("classes") or [])
    imp = (result.get("metrics") or {}).get("importCount", 0)
    if fn or cls:
        return (
            f"Module with {fn} function(s) and {cls} class(es); {imp} internal project import(s).",
            ["module", "exports"] if fn else ["module"],
        )
    return (
        f"{base} ({file_meta.get('language', 'unknown')}, {result.get('nonEmptyLines', 0)} non-empty lines).",
        ["module"],
    )


def should_emit_function(fn, exports):
    lines = (fn.get("endLine") or 0) - (fn.get("startLine") or 0) + 1
    exported = any(e["name"] == fn["name"] for e in exports)
    return exported or lines >= 10


def should_emit_class(cls, exports):
    exported = any(e["name"] == cls["name"] for e in exports)
    methods = len(cls.get("methods") or [])
    lines = (cls.get("endLine") or 0) - (cls.get("startLine") or 0) + 1
    return exported or methods >= 2 or lines >= 20


def fn_summary(path, fn):
    name = fn["name"]
    hints = {
        "parseDobToUTC": "Parses DOB strings into UTC midnight Date for consistent age math.",
        "calculateAge": "Computes patient age in years/months from DOB relative to reference date.",
        "formatDobForDocs": "Formats DOB for .docx export headers and clinical documents.",
        "procesarLabs": "Top-level lab paste processor delegating to segmentation and section collectors.",
    }
    if name in hints:
        return hints[name]
    return f"{'Exported ' if True else ''}function {name} in {basename(path)}."


def process_batch(batch):
    idx = batch["batchIndex"]
    input_path = TMP / f"ua-file-analyzer-input-{idx}.json"
    extract_path = TMP / f"ua-file-extract-results-{idx}.json"
    out_path = INTER / f"batch-{idx}.json"

    payload = {
        "projectRoot": str(PROJECT_ROOT),
        "batchFiles": batch["files"],
        "batchImportData": batch.get("batchImportData") or {},
    }
    input_path.write_text(json.dumps(payload))

    run = subprocess.run(
        ["node", str(SKILL_DIR / "extract-structure.mjs"), str(input_path), str(extract_path)],
        capture_output=True, text=True,
    )
    if run.returncode != 0:
        raise RuntimeError(f"batch {idx} extract failed: {run.stderr[-800:]}")

    if not extract_path.exists() or extract_path.stat().st_size == 0:
        raise RuntimeError(f"batch {idx} extract produced empty output")

    extracted = json.loads(extract_path.read_text())
    nodes = []
    edges = []
    neighbor_map = batch.get("neighborMap") or {}

    for result in extracted.get("results") or []:
        path = result["path"]
        file_meta = next((f for f in batch["files"] if f["path"] == path), {
            "path": path, "language": result.get("language"), "fileCategory": result.get("fileCategory", "code"),
        })
        n_type = file_node_type(file_meta)
        prefix = node_prefix(n_type)
        file_id = f"{prefix}:{path}"
        summary, tags = semantic_for(path, file_meta, result)
        tags = list(dict.fromkeys(tags))[:5]
        while len(tags) < 3:
            tags.append("module")

        nodes.append({
            "id": file_id,
            "type": n_type,
            "name": basename(path),
            "filePath": path,
            "summary": summary,
            "tags": tags,
            "complexity": complexity(result.get("nonEmptyLines") or 0),
        })

        for target in (batch.get("batchImportData") or {}).get(path, []):
            t_meta = next((f for f in batch["files"] if f["path"] == target), {"fileCategory": "code"})
            t_prefix = node_prefix(file_node_type({**t_meta, "path": target}))
            edges.append({
                "source": file_id,
                "target": f"{t_prefix}:{target}",
                "type": "imports",
                "direction": "forward",
                "weight": 0.7,
            })
            if ".test." in path:
                edges.append({
                    "source": f"{t_prefix}:{target}",
                    "target": file_id,
                    "type": "tested_by",
                    "direction": "forward",
                    "weight": 0.5,
                })

        # config/doc semantic edges
        if n_type == "config" and path.startswith("lib/historia-clinica/catalogs/"):
            for neighbor in neighbor_map.get(path, []):
                np = neighbor["path"]
                edges.append({
                    "source": file_id,
                    "target": f"file:{np}",
                    "type": "defines_schema",
                    "direction": "forward",
                    "weight": 0.8,
                })
        if path == "public/tokens.css":
            edges.append({
                "source": file_id,
                "target": "file:public/index.html",
                "type": "configures",
                "direction": "forward",
                "weight": 0.6,
            })
        if path == "public/index.src.html":
            edges.append({
                "source": file_id,
                "target": "file:scripts/build-ui.mjs",
                "type": "related",
                "direction": "forward",
                "weight": 0.5,
            })
        if path.startswith("docs/superpowers/specs/"):
            edges.append({
                "source": file_id,
                "target": "document:.cursor/rules/project-context.mdc",
                "type": "documents",
                "direction": "forward",
                "weight": 0.5,
            })

        exports = result.get("exports") or []
        for fn in result.get("functions") or []:
            if not should_emit_function(fn, exports):
                continue
            fn_id = f"function:{path}:{fn['name']}"
            fn_tags = ["utility"] if "test" not in tags else ["test"]
            if any(e["name"] == fn["name"] for e in exports):
                fn_tags.append("exports")
            nodes.append({
                "id": fn_id,
                "type": "function",
                "name": fn["name"],
                "filePath": path,
                "lineRange": [fn["startLine"], fn["endLine"]],
                "summary": fn_summary(path, fn),
                "tags": list(dict.fromkeys(fn_tags))[:5],
                "complexity": complexity((fn.get("endLine") or 0) - (fn.get("startLine") or 0) + 1),
            })
            edges.append({"source": file_id, "target": fn_id, "type": "contains", "direction": "forward", "weight": 1.0})
            if any(e["name"] == fn["name"] for e in exports):
                edges.append({"source": file_id, "target": fn_id, "type": "exports", "direction": "forward", "weight": 0.8})

        for cls in result.get("classes") or []:
            if not should_emit_class(cls, exports):
                continue
            cls_id = f"class:{path}:{cls['name']}"
            nodes.append({
                "id": cls_id,
                "type": "class",
                "name": cls["name"],
                "filePath": path,
                "lineRange": [cls["startLine"], cls["endLine"]],
                "summary": f"Class {cls['name']} encapsulating state and methods in {basename(path)}.",
                "tags": ["class", "exports"] if any(e["name"] == cls["name"] for e in exports) else ["class"],
                "complexity": complexity((cls.get("endLine") or 0) - (cls.get("startLine") or 0) + 1),
            })
            edges.append({"source": file_id, "target": cls_id, "type": "contains", "direction": "forward", "weight": 1.0})
            if any(e["name"] == cls["name"] for e in exports):
                edges.append({"source": file_id, "target": cls_id, "type": "exports", "direction": "forward", "weight": 0.8})

    out_path.write_text(json.dumps({"nodes": nodes, "edges": edges}, indent=2))
    return {
        "batchIndex": idx,
        "files": len(batch["files"]),
        "nodes": len(nodes),
        "edges": len(edges),
        "parts": 1,
        "status": "ok",
    }


def main():
    batches_data = json.loads((INTER / "batches.json").read_text())
    by_idx = {b["batchIndex"]: b for b in batches_data["batches"]}
    results = []
    errors = []
    for idx in range(53, 66):
        try:
            results.append(process_batch(by_idx[idx]))
        except Exception as e:
            errors.append({"batchIndex": idx, "error": str(e)})
    status = {
        "status": "ok" if not errors else "partial",
        "batchesCompleted": len(results),
        "batchRange": [53, 65],
        "nodesTotal": sum(r["nodes"] for r in results),
        "edgesTotal": sum(r["edges"] for r in results),
        "batches": results,
        "errors": errors,
    }
    print(json.dumps(status, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
