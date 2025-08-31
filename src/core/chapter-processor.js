"use strict";

const { CHAPTERS } = require("../config/ebook-structure");
const { generateSection } = require("../generator/section-generator");

class ChapterProcessor {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  async processChapter({ chapterId, sectionsLimit = 0 }) {
    const chapter = CHAPTERS.find((c) => c.id === chapterId);
    if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`);
    const sections = Array.isArray(chapter.sections)
      ? chapter.sections.slice(0, sectionsLimit > 0 ? sectionsLimit : chapter.sections.length)
      : [];

    // enter phase
    const st = (await this.stateManager.getCurrentState()) || (await this.stateManager.initializeState({}));
    st.currentPhase = { phase: "CHAPTER_PROCESS", chapterId, interruptible: true };
    await this.stateManager.saveState(st);

    const generated = [];
    for (let i = 0; i < sections.length; i++) {
      const sectionName = sections[i];
      // checkpoint before processing each section
      await this.stateManager.createCheckpoint(`Pre-section ${sectionName}`, "PHASE_TRANSITION");
      const r = await generateSection({ stateManager: this.stateManager, chapterId, sectionName });
      generated.push(r.fileName);
      // checkpoint after section
      await this.stateManager.createCheckpoint(`Post-section ${sectionName}`, "CHAPTER_PROGRESS");
    }

    // exit phase
    const st2 = (await this.stateManager.getCurrentState()) || {};
    st2.currentPhase = { phase: "IDLE", interruptible: true };
    await this.stateManager.saveState(st2);

    return { chapterId, files: generated };
  }
}

module.exports = { ChapterProcessor };
