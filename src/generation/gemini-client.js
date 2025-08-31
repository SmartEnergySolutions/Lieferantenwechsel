"use strict";

// Minimal Gemini client facade with safe fallback to echo/transform
class GeminiClient {
  constructor({ apiKey = process.env.GOOGLE_API_KEY, model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" } = {}) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(prompt, context = {}) {
    if (!this.apiKey) {
      // fallback: trivial generation stub
      return `# Section\n\nPrompt: ${prompt}\n\nContext keys: ${Object.keys(context).join(", ")}`;
    }
    // Placeholder for real API call; keep offline-safe
    return `Generated (model=${this.model}): ${prompt.slice(0, 120)}...`;
  }

  async validateContent(content, criteria = {}) {
    // naive validator: length and presence of headers
    const ok = typeof content === "string" && content.includes("#");
    return { valid: ok, issues: ok ? [] : ["missing heading"], criteria };
  }

  async refineContent(content, feedback = {}) {
    // basic refinement: append feedback note
    const note = typeof feedback === "string" ? feedback : JSON.stringify(feedback);
    return content + "\n\n> Refined: " + note;
  }

  async suggestImprovements(content, criteria = {}) {
    const suggestions = [];
    if (!/\bBeispiel\b/i.test(content)) suggestions.push("Füge konkrete Beispiele hinzu.");
    if (!/\bFristen\b/i.test(content)) suggestions.push("Präzisiere Fristen und Prozess-Schritte.");
    return { suggestions, criteria };
  }
}

module.exports = { GeminiClient };
