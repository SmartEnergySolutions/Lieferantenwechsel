"use strict";

const path = require("path");
const fs = require("fs-extra");
const log = require("./utils/logger");
const cfg = require("./config/config");
const { StateManager } = require("./state/state-manager");

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      out[k] = v === undefined ? true : v;
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";
  const sm = new StateManager();

  process.on("SIGINT", async () => { try { await sm.handleGracefulShutdown(); } finally { process.exit(0); } });
  process.on("SIGTERM", async () => { try { await sm.handleGracefulShutdown(); } finally { process.exit(0); } });

  try {
    // core state
    if (cmd === "init") { await sm.initializeState({}); return; }
    if (cmd === "status") {
      const s = await sm.getCurrentState();
      if (!s) return console.log("No state initialized. Run: npm run init");
      console.log(JSON.stringify({ phase: s.currentPhase, status: s.status, generationId: s.generationId }, null, 2));
      return;
    }
    if (cmd === "checkpoint") {
      const desc = args.description || "Manual checkpoint";
      const id = await sm.createCheckpoint(desc);
      console.log(`Checkpoint: ${id}`);
      return;
    }
    if (cmd === "resume") {
      const latest = await sm.getLatestCheckpoint();
      if (!latest) { console.log("No checkpoints found"); return; }
      await sm.recoverFromCheckpoint(latest.checkpointId);
      return;
    }
    if (cmd === "recover:smart") {
      const res = await sm.recoverFromCrash();
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    // plan progress
    if (cmd === "plan:progress") {
      const planFile = path.join(process.cwd(), "PLAN.md");
      let text = "";
      try { text = await fs.readFile(planFile, "utf-8"); } catch {
        console.log(JSON.stringify({ error: "PLAN.md not found" }, null, 2));
        return;
      }
      const total = (text.match(/- \[ \]/g) || []).length + (text.match(/- \[x\]/gi) || []).length;
      const done = (text.match(/- \[x\]/gi) || []).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      console.log(JSON.stringify({ total, done, percent }, null, 2));
      return;
    }

    // checkpoint utilities
    if (cmd === "state:checkpoints") {
      const dir = sm.checkpointsDir;
      await fs.ensureDir(dir);
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
      const limit = parseInt(args.limit || args.l || "0", 10);
      const list = [];
      for (const f of files) {
        try {
          const full = path.join(dir, f);
          const data = await fs.readJson(full);
          list.push({ id: data.checkpointId || path.basename(f, ".json"), file: full, createdAt: data.createdAt, type: data.type, description: data.description });
        } catch {
          list.push({ id: path.basename(f, ".json"), file: path.join(dir, f) });
        }
      }
      console.log(JSON.stringify(limit > 0 ? list.slice(-limit) : list, null, 2));
      return;
    }
    if (cmd === "state:cleanup") {
      let keep = parseInt(args.keep || args.k || `${require("./config/config").state.checkpointsToKeep}`, 10);
      if (!Number.isFinite(keep) || keep < 0) keep = require("./config/config").state.checkpointsToKeep;
      const dir = sm.checkpointsDir;
      await fs.ensureDir(dir);
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
      if (files.length <= keep) { console.log(JSON.stringify({ deleted: 0, kept: files.length })); return; }
      const toDelete = files.slice(0, files.length - keep);
      for (const f of toDelete) { try { await fs.remove(path.join(dir, f)); } catch {} }
      console.log(JSON.stringify({ deleted: toDelete.length, kept: keep }, null, 2));
      return;
    }

    // qdrant tools
    if (cmd.startsWith("qdrant:")) {
  const { QdrantClient } = require("./retrieval/qdrant-client");
  const { embedText } = require("./retrieval/embeddings");
  const { basicFilter, mergeWeighted, chunkTypeFilter, combineFilters } = require("./retrieval/search-strategies");
      const { SessionManager } = require("./interactive/session-manager");
      const qc = new QdrantClient();
      if (cmd === "qdrant:health") { try { console.log(await qc.healthz()); } catch (e) { console.log("Qdrant not reachable:", e.message); } return; }
      if (cmd === "qdrant:collections") { console.log(await qc.listCollections()); return; }
      if (cmd === "qdrant:ensure") { const r = await qc.ensureCollection(cfg.qdrant.collection, cfg.embeddings.size); console.log(r); return; }
      if (cmd === "qdrant:search") {
        const term = args.term || args.t || "Test";
        const types = String(args.types || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        const vec = await embedText(term, cfg.embeddings.size);
        const filter = combineFilters(basicFilter(term), chunkTypeFilter(types));
        const res = await qc.searchPoints(cfg.qdrant.collection, vec, { limit: parseInt(args.limit || "10", 10), with_payload: true, ...(filter ? { filter } : {}) });
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      if (cmd === "qdrant:search-embed") {
        const term = args.term || args.t || "Test";
        const types = String(args.types || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        const vec = await embedText(term, cfg.embeddings.size);
        const base = await qc.searchPoints(cfg.qdrant.collection, vec, { limit: parseInt(args.limit || "10", 10), with_payload: true });
        const flt = combineFilters(basicFilter(term), chunkTypeFilter(types));
        const filtered = await qc.searchPoints(cfg.qdrant.collection, vec, { limit: parseInt(args.limit || "10", 10), with_payload: true, ...(flt ? { filter: flt } : {}) });
        const merged = mergeWeighted(base, filtered, parseFloat(args.alpha || "0.7"));
        console.log(JSON.stringify(merged, null, 2));
        return;
      }
      if (cmd === "qdrant:search-decision" || cmd === "qdrant:search-embed-decision") {
        const chapterId = args.chapter || args.c;
        if (!chapterId) { console.log("--chapter=<id> required"); return; }
        const term = args.term || args.t || "Test";
        const limit = parseInt(args.limit || "10", 10);
        const alpha = parseFloat(args.alpha || "0.7");
        const vec = await embedText(term, cfg.embeddings.size);
        let results;
        try {
          const base = await qc.searchPoints(cfg.qdrant.collection, vec, { limit, with_payload: true });
          if (cmd === "qdrant:search-embed-decision") {
            const filtered = await qc.searchPoints(cfg.qdrant.collection, vec, { limit, with_payload: true, filter: basicFilter(term) });
            results = mergeWeighted(base, filtered, alpha);
          } else {
            results = base;
          }
        } catch (e) {
          console.log("Qdrant search failed:", e.message);
          results = { points: [] };
        }
        const decisionType = cmd === "qdrant:search-embed-decision" ? "EMBEDDED_SEARCH_SELECTION" : "SEARCH_RESULTS_SELECTION";
        const smgr = new SessionManager(sm);
        const decision = await smgr.addPendingDecision(chapterId, {
          type: decisionType,
          context: { term, alpha, results, presentedAt: new Date().toISOString() },
          timeoutAt: new Date(Date.now() + (cfg.interactive.feedbackTimeoutSec || 300) * 1000).toISOString(),
        });
        console.log(JSON.stringify({ added: decision, chapterId }, null, 2));
        return;
      }
      if (cmd === "qdrant:import-sample") {
        const file = args.file || args.f;
        const collection = args.collection || cfg.qdrant.collection;
        if (!file) { console.log("--file=<path> required (NDJSON or JSON array)"); return; }
        await qc.ensureCollection(collection, cfg.embeddings.size);
        const full = path.resolve(file);
        let items = [];
        try {
          const text = await fs.readFile(full, "utf-8");
          if (text.trim().startsWith("[")) {
            items = JSON.parse(text);
          } else {
            items = text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
          }
        } catch (e) {
          console.log("Failed to read sample:", e.message);
          return;
        }
        const points = [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i] || {};
          const id = it.id ?? i;
          const content = it.content || it.text || it.payload?.content || "";
          try {
            const vec = await embedText(String(content), cfg.embeddings.size);
            points.push({ id, vector: vec, payload: it.payload || {
              content,
              chunk_type: it.chunk_type || it.type || "unknown",
              source_document: it.source_document || it.source || "sample",
            }});
          } catch {}
        }
        if (!points.length) { console.log("No points to import"); return; }
        try {
          const res = await qc.upsertPoints(collection, points);
          console.log(JSON.stringify({ imported: points.length, result: res }, null, 2));
        } catch (e) {
          console.log("Upsert failed:", e.message);
        }
        return;
      }
    }

    // outputs and validation
    if (cmd === "state:backup") {
      const { backupDir } = require("./utils/file-manager");
      const backupRoot = path.join(cfg.state.dir, "..", "backups");
      const stateBackup = await backupDir(cfg.state.dir, path.resolve(backupRoot, "state"));
      const outputsBackup = await backupDir(cfg.outputs.dir, path.resolve(backupRoot, "outputs"));
      console.log(JSON.stringify({ stateBackup, outputsBackup }, null, 2));
      return;
    }
    if (cmd === "state:validate") {
      const { validateAllStates } = require("./state/state-validator");
      const fix = !!args.fix || !!args["--fix"]; // support --fix
      const res = await validateAllStates(sm.stateDir, { fix });
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.valid ? 0 : 1;
      return;
    }
    if (cmd === "state:validate:consistency" || cmd === "validate:consistency") {
      const { validateConsistency } = require("./state/state-validator");
      const fix = !!args.fix || !!args["--fix"]; 
      const res = await validateConsistency(sm.stateDir, { fix });
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.valid ? 0 : 1;
      return;
    }
    if (cmd === "outputs:list") {
      const outDir = cfg.outputs.dir;
      const chapters = (await fs.pathExists(outDir)) ? await fs.readdir(outDir) : [];
      for (const ch of chapters) {
        const files = (await fs.readdir(path.join(outDir, ch))).filter((f) => f.endsWith(".md"));
        console.log(`${ch}: ${files.length}`);
      }
      return;
    }
    if (cmd === "outputs:validate" || cmd === "validate:outputs") {
      const { validateOutputsAgainstState } = require("./state/outputs-validator");
      const fix = !!args.fix || !!args["--fix"]; 
      const res = await validateOutputsAgainstState({ stateDir: sm.stateDir, outputsDir: cfg.outputs.dir, fix });
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.valid ? 0 : 1;
      return;
    }
    if (cmd === "outputs:report") {
      const chapters = await discoverChapters(sm);
      const { outputsReport } = require("./state/outputs-report");
      const rep = await outputsReport({ stateDir: sm.stateDir, outputsDir: cfg.outputs.dir, chapters });
      console.log(JSON.stringify(rep, null, 2));
      return;
    }
    if (cmd === "outputs:quality") {
      const minWords = parseInt(args.min || "50", 10);
      const warnBelow = parseFloat(args.warn || "0.7");
      const { analyzeOutputs } = require("./quality/content-quality-analyzer");
      const rep = await analyzeOutputs({ outputsDir: cfg.outputs.dir, minWords, warnBelow });
      console.log(JSON.stringify(rep, null, 2));
      return;
    }
    if (cmd === "outputs:coverage" || cmd === "validate:coverage") {
      const { coverageReport } = require("./state/coverage-validator");
      const min = parseInt(args["min"] || args["min-sections"] || "1", 10);
      const { getActiveChapters } = require("./config/loader");
      const { chapters } = await getActiveChapters();
      const res = await coverageReport({ outputsDir: cfg.outputs.dir, chapters, minSectionsPerChapter: min });
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.valid ? 0 : 1;
      return;
    }
    if (cmd === "validate:all") {
  const { validateConsistency } = require("./state/state-validator");
  const { validateOutputsAgainstState } = require("./state/outputs-validator");
  const { coverageReport } = require("./state/coverage-validator");
      const fix = !!args.fix || !!args["--fix"]; 
  const { getActiveChapters } = require("./config/loader");
  const { chapters } = await getActiveChapters();
      const consistency = await validateConsistency(sm.stateDir, { fix });
      const outputs = await validateOutputsAgainstState({ stateDir: sm.stateDir, outputsDir: cfg.outputs.dir, fix });
      const coverage = await coverageReport({ outputsDir: cfg.outputs.dir, chapters, minSectionsPerChapter: parseInt(args.min || "1", 10) });
      const valid = !!(consistency.valid && outputs.valid && coverage.valid);
      console.log(JSON.stringify({ valid, consistency, outputs, coverage }, null, 2));
      process.exitCode = valid ? 0 : 1;
      return;
    }
    if (cmd === "progress") {
      const chapters = await discoverChapters(sm);
      const { outputsReport } = require("./state/outputs-report");
      const rep = await outputsReport({ stateDir: sm.stateDir, outputsDir: cfg.outputs.dir, chapters });
      const totalExpected = chapters.reduce((a, c) => a + (Array.isArray(c.sections) ? c.sections.length : 0), 0) || null;
      const base = { files: rep.totals.files, sectionsCompleted: rep.totals.sections, avgQuality: rep.totals.avgQuality, totalExpected };
      try {
        const { computeProgress, estimateETA } = require("./utils/progress-tracker");
        const p = await computeProgress({ stateDir: sm.stateDir, chapters });
        const st = await sm.getCurrentState();
        const avg = Number(st?.statistics?.averageSectionTime) || 60000;
        const eta = totalExpected ? estimateETA({ startedAt: st?.startTime, itemsDone: rep.totals.sections, itemsTotal: totalExpected, avgMsPerItem: avg }) : null;
        console.log(JSON.stringify({ ...base, status: p.status, phase: p.phase, eta }, null, 2));
      } catch {
        console.log(JSON.stringify(base, null, 2));
      }
      return;
    }

    // feedback analyzer
    if (cmd === "feedback:analyze") {
      const file = args.file || (args.session ? path.join(cfg.outputs.dir, "interactive-sessions", `${args.session}.json`) : null);
      if (!file) { console.log("--file=PATH or --session=ID required"); return; }
      try {
        const data = await fs.readJson(file);
        const { analyzeFeedback } = require("./interactive/feedback-analyzer");
        const rep = analyzeFeedback(data.feedbackHistory || []);
        console.log(JSON.stringify(rep, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }, null, 2));
      }
      return;
    }

    if (cmd === "feedback:validate-type") {
      const t = args.type || args.t;
      const { isValidType, normalizeType } = require("./interactive/feedback-types");
      if (!t) { console.log(JSON.stringify({ error: "--type=... required" }, null, 2)); return; }
      console.log(JSON.stringify({ type: t, valid: isValidType(t), normalized: normalizeType(t) }, null, 2));
      return;
    }

    if (cmd === "learning:apply") {
      const file = args.file || (args.session ? path.join(cfg.outputs.dir, "interactive-sessions", `${args.session}.json`) : null);
      if (!file) { console.log("--file=PATH or --session=ID required"); return; }
      try {
        const data = await fs.readJson(file);
        const history = data.feedbackHistory || data.history || [];
        const { applyLearning } = require("./interactive/learning-engine");
        const merged = await applyLearning({ stateManager: sm, history });
        console.log(JSON.stringify({ updatedPreferences: merged }, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }, null, 2));
      }
      return;
    }

    // gemini helpers (offline-safe)
    if (cmd === "gemini:generate") {
      const prompt = args.prompt || "Beispiel Abschnitt";
      const { GeminiClient } = require("./generation/gemini-client");
      const gc = new GeminiClient({});
      const out = await gc.generateContent(prompt, { chapter: args.chapter || "01-overview" });
      console.log(out);
      return;
    }

    // interactive content refinement
    if (cmd === "interactive:refine") {
      const file = args.file || args.f;
      const maxLine = args.max ? parseInt(args.max, 10) : undefined;
      if (!file) { console.log("--file=PATH required"); return; }
      try {
        const md = await fs.readFile(path.resolve(file), "utf-8");
        const { analyzeContent, refineContent } = require("./interactive/content-refiner");
        const analysis = analyzeContent(md);
        const { content, changes } = refineContent(md, { maxLine });
        console.log(JSON.stringify({ analysis, changes, length: content.length }, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }, null, 2));
      }
      return;
    }

    if (cmd === "interactive:quality") {
      const file = args.file || args.f || path.join(process.cwd(), "README.md");
      try {
        const md = await fs.readFile(path.resolve(file), "utf-8");
        const { evaluateQuality } = require("./interactive/quality-checker");
        const rep = evaluateQuality(md, {});
        console.log(JSON.stringify(rep, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }, null, 2));
      }
      return;
    }

    // session management
    if (cmd.startsWith("session:")) {
      const { SessionManager } = require("./interactive/session-manager");
      const smgr = new SessionManager(sm);
      if (cmd === "session:add-decision") {
        const chapterId = args.chapter || args.c;
        const type = args.type || "GENERIC";
        if (!chapterId) { console.log("--chapter=<id> required"); return; }
        const term = args.term || null;
        const d = await smgr.addPendingDecision(chapterId, { type, context: { term } });
        console.log(JSON.stringify(d, null, 2));
        return;
      }
      if (cmd === "session:list-decisions") {
        const list = await smgr.listPendingDecisions();
        console.log(JSON.stringify(list, null, 2));
        return;
      }
      if (cmd === "session:resolve-decision") {
        const chapterId = args.chapter || args.c;
        const decisionId = args.decision || args.id;
        const selected = String(args.selected || "")
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((n) => parseInt(n, 10))
          .filter((n) => Number.isFinite(n));
        if (!chapterId || !decisionId) { console.log("--chapter and --decision required"); return; }
        await smgr.resolveDecision(chapterId, decisionId, { selected });
        console.log(JSON.stringify({ resolved: decisionId, chapterId, selected }, null, 2));
        return;
      }
      if (cmd === "session:apply-latest") {
        const chapterId = args.chapter || args.c;
        const sectionName = args.section || args.s || "Abschnitt";
        if (!chapterId) { console.log("--chapter=<id> required"); return; }
        const { generateSection } = require("./generator/section-generator");
        const res = await generateSection({ stateManager: sm, chapterId, sectionName });
        console.log(JSON.stringify({ generated: res.fileName, path: res.filePath }, null, 2));
        return;
      }
      if (cmd === "session:review-latest") {
        const chapterId = args.chapter || args.c;
        if (!chapterId) { console.log("--chapter=<id> required"); return; }
        const file = path.join(sm.chapterStatesDir, `${chapterId}.json`);
        try {
          const s = await fs.readJson(file);
          const h = s.searchHistory || [];
          const latest = h[h.length - 1] || null;
          console.log(JSON.stringify({ latest }, null, 2));
        } catch {
          console.log(JSON.stringify({ latest: null }, null, 2));
        }
        return;
      }
    }

    // generation helpers
    if (cmd === "generate:section") {
      const chapterId = args.chapter || args.c;
      const sectionName = args.section || args.s;
      if (!chapterId || !sectionName) { console.log("--chapter and --section required"); return; }
      const { generateSection } = require("./generator/section-generator");
      const res = await generateSection({ stateManager: sm, chapterId, sectionName });
      console.log(JSON.stringify({ generated: res.fileName, path: res.filePath }, null, 2));
      return;
    }
    if (cmd === "generate:chapter") {
      const chapterId = args.chapter || args.c;
      const sectionsRaw = args.sections || args.s || "";
      if (!chapterId || !sectionsRaw) { console.log("--chapter and --sections required"); return; }
      const sections = sectionsRaw.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
      const { generateSection } = require("./generator/section-generator");
      const done = [];
      for (const sec of sections) {
        const r = await generateSection({ stateManager: sm, chapterId, sectionName: sec });
        done.push(r.fileName);
      }
      console.log(JSON.stringify({ chapterId, files: done }, null, 2));
      return;
    }
    if (cmd === "generate:all") {
      const { CHAPTERS } = require("./config/ebook-structure");
      const limit = parseInt(args["sections-limit"] || args.limit || "0", 10);
      const seed = !!args["seed-retrieval"] || !!args.seed;
      const { generateSection } = require("./generator/section-generator");
      const generated = [];
      for (const ch of CHAPTERS) {
        const secs = Array.isArray(ch.sections) ? ch.sections.slice(0, limit > 0 ? limit : ch.sections.length) : [];
        if (seed) {
          try {
            const { SEARCH_QUERIES } = require("./config/search-queries");
            const queries = SEARCH_QUERIES[ch.id] || [];
            for (const q of queries.slice(0, 1)) {
              process.argv = [process.argv[0], process.argv[1]]; // guard
              const vec = null; // no-op; seeding handled by decision without results
              const { SessionManager } = require("./interactive/session-manager");
              const smgr = new SessionManager(sm);
              await smgr.addPendingDecision(ch.id, { type: "SEARCH_RESULTS_SELECTION", context: { term: q, results: { points: [] } } });
            }
          } catch {}
        }
        for (const sec of secs) {
          const r = await generateSection({ stateManager: sm, chapterId: ch.id, sectionName: sec });
          generated.push(r.fileName);
        }
      }
      console.log(JSON.stringify({ files: generated.length, list: generated }, null, 2));
      return;
    }

    // seed helpers
    if (cmd === "seed:retrieval") {
      const { SessionManager } = require("./interactive/session-manager");
      const { SEARCH_QUERIES } = require("./config/search-queries");
      const smgr = new SessionManager(sm);
      const one = args.chapter || args.c;
      const chapters = one ? [one] : Object.keys(SEARCH_QUERIES);
      for (const ch of chapters) {
        const queries = SEARCH_QUERIES[ch] || [];
        for (const q of queries) {
          await smgr.addPendingDecision(ch, { type: "SEARCH_RESULTS_SELECTION", context: { term: q, results: { points: [] } } });
        }
      }
      console.log(JSON.stringify({ seededChapters: chapters.length }, null, 2));
      return;
    }

    // sessions overview
    if (cmd === "sessions:list" || cmd === "sessions:resume" || cmd === "sessions:report" || cmd === "sessions:details" || cmd === "sessions:delete") {
      const { SessionPersistence } = require("./interactive/session-persistence");
      const sp = new SessionPersistence(cfg.outputs.dir);
      if (cmd === "sessions:list") {
        const list = await sp.listSessions();
        console.log(JSON.stringify(list, null, 2));
        return;
      }
      if (cmd === "sessions:resume") {
        const sid = args.session || args.id;
        if (!sid) { console.log("--session=<id> required"); return; }
        const s = await sp.resumeSession(sid);
        console.log(JSON.stringify({ id: sid, started: s.startTime, chapters: Object.keys(s.chapterProgress || {}).length }, null, 2));
        return;
      }
      if (cmd === "sessions:report") {
        const sid = args.session || args.id;
        if (!sid) { console.log("--session=<id> required"); return; }
        sp.currentSessionId = sid;
        const rep = await sp.generateSessionReport(sid);
        console.log(JSON.stringify(rep, null, 2));
        return;
      }
      if (cmd === "sessions:details") {
        const sid = args.session || args.id;
        if (!sid) { console.log("--session=<id> required"); return; }
        const s = await sp.resumeSession(sid);
        console.log(JSON.stringify(s, null, 2));
        return;
      }
      if (cmd === "sessions:delete") {
        const sid = args.session || args.id;
        if (!sid) { console.log("--session=<id> required"); return; }
        const file = require("path").join(sp.sessionDir, `${sid}.json`);
        try {
          await require("fs-extra").remove(file);
          console.log(JSON.stringify({ deleted: sid }, null, 2));
        } catch (e) {
          console.log(JSON.stringify({ deleted: false, error: e.message }, null, 2));
        }
        return;
      }
    }

    // cache ops
    if (cmd === "cache:search:stats") { const { stats } = require("./retrieval/search-cache"); console.log(await stats()); return; }
    if (cmd === "cache:search:clear") { const { clear } = require("./retrieval/search-cache"); await clear(); console.log("cleared"); return; }

    // export
    if (cmd === "export:bundle") {
      const title = args.title || "Lieferantenwechsel";
      const to = args.to || path.join(cfg.outputs.bundleDir, "book.md");
      const { getActiveChapters } = require("./config/loader");
      const { chapters } = await getActiveChapters();
      const { bundleMarkdown } = require("./export/bundle");
      await bundleMarkdown({ title, chapters, outputsDir: cfg.outputs.dir, toFile: to });
      console.log("bundled:", to);
      return;
    }
    if (cmd === "export:html") {
      const title = args.title || "Lieferantenwechsel";
      const to = args.to || path.join(cfg.outputs.bundleDir, "book.html");
      const { getActiveChapters } = require("./config/loader");
      const { chapters } = await getActiveChapters();
      const { bundleMarkdown } = require("./export/bundle");
      const { bundleHtml } = require("./export/html");
      const md = await bundleMarkdown({ title, chapters, outputsDir: cfg.outputs.dir });
      await bundleHtml({ title, markdown: md, toFile: to });
      console.log("exported html:", to);
      return;
    }
    if (cmd === "export:json") {
      const title = args.title || "Lieferantenwechsel";
      const to = args.to || path.join(cfg.outputs.bundleDir, "book.json");
      const { getActiveChapters } = require("./config/loader");
      const { chapters } = await getActiveChapters();
      const { bundleJson } = require("./export/json");
      await bundleJson({ title, chapters, outputsDir: cfg.outputs.dir, toFile: to });
      console.log("exported json:", to);
      return;
    }

    // interactive quick-start (starts a new session)
  if (cmd === "interactive") {
      const { SessionPersistence } = require("./interactive/session-persistence");
      const sp = new SessionPersistence(cfg.outputs.dir);
      const sid = await sp.startNewSession({ interactive: true });
      console.log(JSON.stringify({ sessionStarted: sid }, null, 2));
      return;
    }

    // interactive chat assistant (guided retrieval + review + optional generation)
    if (cmd === "interactive:chat") {
      const { SessionManager } = require("./interactive/session-manager");
      const { SessionPersistence } = require("./interactive/session-persistence");
      const { ChatInterface } = require("./interactive/chat-interface");
      const sp = new SessionPersistence(cfg.outputs.dir);
      const sid = await sp.startNewSession({ interactive: true, mode: "chat" });
      console.log(JSON.stringify({ sessionStarted: sid }, null, 2));
      const smgr = new SessionManager(sm);
      const chat = new ChatInterface(sm, smgr, { checkpointOnReview: true });
      try {
        await chat.startInteractiveSession();
        console.log(JSON.stringify({ sessionCompleted: sid }, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ sessionError: sid, error: e.message }, null, 2));
      }
      return;
    }

    // config helpers
    if (cmd === "config:show") {
      const safe = {
        env: cfg.env,
        qdrant: { url: cfg.qdrant.url, collection: cfg.qdrant.collection, timeoutMs: cfg.qdrant.timeoutMs },
        embeddings: { provider: cfg.embeddings.provider, size: cfg.embeddings.size, openai: { model: cfg.embeddings.openai.model, baseURL: cfg.embeddings.openai.baseURL, apiKey: cfg.embeddings.openai.apiKey ? "set" : "" } },
        outputs: cfg.outputs,
        state: cfg.state,
        interactive: cfg.interactive,
        cache: cfg.cache,
      };
      console.log(JSON.stringify(safe, null, 2));
      return;
    }
    if (cmd === "config:chapters:set") {
      const file = args.file || args.f;
      if (!file) { console.log("--file=PATH required (JSON)"); return; }
      try {
        const { loadFromFile } = require("./config/loader");
        const res = await loadFromFile(file);
        console.log(JSON.stringify({ loaded: true, file: res.file, chapters: res.chapters }, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ loaded: false, error: e.message }, null, 2));
        process.exitCode = 1;
      }
      return;
    }
    if (cmd === "config:chapters:show") {
      const { getActiveChapters, activeConfigPath } = require("./config/loader");
      const { source, chapters } = await getActiveChapters();
      console.log(JSON.stringify({ source, file: activeConfigPath(), chapters: chapters.map(c => ({ id: c.id, sections: c.sections.length, required: c.validationCriteria?.requiredSections || 1 })) }, null, 2));
      return;
    }
    if (cmd === "config:chapters:clear") {
      const { clearActiveConfig, activeConfigPath } = require("./config/loader");
      const file = await clearActiveConfig();
      console.log(JSON.stringify({ cleared: true, file }, null, 2));
      return;
    }
    if (cmd === "config:validate") {
      const issues = [];
      // directories
      try { await fs.ensureDir(cfg.outputs.dir); } catch (e) { issues.push({ key: "outputs.dir", level: "ERROR", message: e.message }); }
      try { await fs.ensureDir(cfg.state.dir); } catch (e) { issues.push({ key: "state.dir", level: "ERROR", message: e.message }); }
      // qdrant URL basic check
      if (!cfg.qdrant.url || !/^https?:\/\//.test(cfg.qdrant.url)) {
        issues.push({ key: "qdrant.url", level: "WARN", message: "Qdrant URL seems invalid; CLI will skip network tests" });
      }
      // embeddings size
      if (!Number.isFinite(cfg.embeddings.size) || cfg.embeddings.size <= 0) {
        issues.push({ key: "embeddings.size", level: "ERROR", message: "Embeddings size must be a positive integer" });
      }
      // provider specifics
      if ((cfg.embeddings.provider || "hash").toLowerCase() === "openai" && !cfg.embeddings.openai.apiKey) {
        issues.push({ key: "embeddings.openai.apiKey", level: "WARN", message: "OPENAI_API_KEY not set; falling back to hash embeddings is recommended" });
      }
      const valid = issues.every((i) => i.level !== "ERROR");
      console.log(JSON.stringify({ valid, issues }, null, 2));
      process.exitCode = valid ? 0 : 1;
      return;
    }

    console.log(
      [
        "Commands:",
        "  init", 
        "  status",
    "  checkpoint --description=<text>",
    "  state:checkpoints [--limit=N] | state:cleanup --keep=N",
        "  resume",
        "  recover:smart",
  "  qdrant:health | qdrant:collections | qdrant:ensure | qdrant:search --term=... [--types=a,b] | qdrant:search-embed --term=... [--types=a,b]",
  "  qdrant:import-sample --file=PATH [--collection=NAME]",
  "  qdrant:search-decision --term=... --chapter=ID | qdrant:search-embed-decision --term=... --chapter=ID",
  "  session:add-decision --chapter=ID [--type=...] [--term=...]",
  "  session:list-decisions | session:resolve-decision --chapter=ID --decision=ID --selected=0,2,5",
  "  session:apply-latest --chapter=ID --section=... | session:review-latest --chapter=ID",
  "  sessions:list | sessions:resume --session=ID | sessions:report --session=ID | sessions:details --session=ID | sessions:delete --session=ID",
  "  generate:section --chapter=ID --section=... | generate:chapter --chapter=ID --sections=a,b,c",
  "  generate:all [--sections-limit=N] [--seed-retrieval] | seed:retrieval [--chapter=ID]",
  "  outputs:list | outputs:report",
        "  cache:search:stats | cache:search:clear",
  "  export:bundle --title=... --to=... | export:html --title=... --to=... | export:json --title=... --to=...",
    "  interactive | interactive:chat",
  "  config:show | config:validate | config:chapters:set --file=PATH | config:chapters:show | config:chapters:clear | feedback:analyze --file=PATH | feedback:analyze --session=ID | gemini:generate --prompt=... [--chapter=ID]",
      ].join("\n")
    );
  } catch (e) {
    log.error("CLI error", { error: e.message, stack: e.stack });
    process.exitCode = 1;
  }
}

async function discoverChapters(sm) {
  // Discover chapters from chapter-states directory; fall back to outputs listing
  const chapters = [];
  const chDir = sm.chapterStatesDir;
  if (await fs.pathExists(chDir)) {
    const files = (await fs.readdir(chDir)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const id = path.basename(f, ".json");
      try {
        const st = await fs.readJson(path.join(chDir, f));
        chapters.push({ id, title: st.title || id, sections: st.sections || [] });
      } catch {
        chapters.push({ id, title: id, sections: [] });
      }
    }
  } else {
    const outDir = cfg.outputs.dir;
    if (await fs.pathExists(outDir)) {
      const dirs = await fs.readdir(outDir);
      for (const d of dirs) chapters.push({ id: d, title: d, sections: [] });
    }
  }
  return chapters.sort((a, b) => a.id.localeCompare(b.id));
}

main();
