"use strict";

class ClaudeClient {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || "claude-3-opus-20240229" } = {}) {
    this.apiKey = apiKey || null;
    this.model = model;
  }

  async generateContent(prompt, { chapter = "unknown" } = {}) {
    // Offline-safe stub: if no API key, return deterministic mock
    if (!this.apiKey) {
      return `# Entwurf (Claude Stub)\n\nKapitel: ${chapter}\n\nPrompt: ${String(prompt).slice(0, 120)}...\n\nHinweis: Offline-Stubs aktiv.`;
    }
    // Even if API key exists, avoid network calls in this project to keep tests hermetic
    return `# Entwurf (Claude Stub)\n\nKapitel: ${chapter}\n\nPrompt: ${String(prompt).slice(0, 120)}...\n\nHinweis: Netzwerk deaktiviert.`;
  }
}

module.exports = { ClaudeClient };
