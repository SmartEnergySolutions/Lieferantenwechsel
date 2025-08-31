"use strict";

const axios = require("axios");
const { config } = require("../config/config");
const logger = require("../utils/logger");

class QdrantClient {
  constructor(opts = {}) {
    const { url, apiKey } = config.qdrant;
    this.baseURL = opts.url || url;
    this.apiKey = opts.apiKey || apiKey;
    this.http = opts.http || axios.create({ baseURL: this.baseURL, timeout: opts.timeoutMs || config.qdrant.timeoutMs, headers: this.apiKey ? { "api-key": this.apiKey } : {} });
  }

  async healthz() {
    const res = await this.http.get("/healthz");
    return res.data;
  }

  async listCollections() {
    const res = await this.http.get("/collections");
    return res.data?.result?.collections || [];
  }

  async getCollection(name) {
    const res = await this.http.get(`/collections/${name}`);
    return res.data?.result;
  }

  async ensureCollection(name, vectorSize = 768, distance = "Cosine") {
    try {
      await this.http.get(`/collections/${name}`);
      return { existed: true };
    } catch {
      const body = { vectors: { size: vectorSize, distance } };
      await this.http.put(`/collections/${name}`, body);
      logger.info("Qdrant collection created", { name, vectorSize, distance });
      return { created: true };
    }
  }

  async searchPoints(collection, vector, { limit = 10, filter = undefined, with_payload = true, with_vector = false } = {}) {
    if (!Array.isArray(vector)) throw new Error("vector must be an array of numbers");
    const body = { vector, limit, with_payload, with_vector };
    if (filter) body.filter = filter;
    const res = await this.http.post(`/collections/${collection}/points/search`, body);
    return res.data?.result || [];
  }

  async upsertPoints(collection, points) {
    const body = { points };
    const res = await this.http.put(`/collections/${collection}/points`, body);
    return res.data?.result;
  }
}

module.exports = { QdrantClient };
