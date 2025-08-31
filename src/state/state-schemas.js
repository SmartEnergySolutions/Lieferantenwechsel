// JSON Schemas for validating state files
module.exports = {
  currentStateSchema: {
    $id: 'https://schemas.lieferantenwechsel/current-generation.json',
    type: 'object',
    required: ['generationId', 'status', 'currentPhase', 'completedChapters', 'globalSettings', 'userPreferences', 'statistics'],
    properties: {
      generationId: { type: 'string' },
      startTime: { type: 'string' },
      lastUpdate: { type: 'string' },
      version: { type: 'string' },
      status: { enum: ['INITIALIZED','IN_PROGRESS','PAUSED','COMPLETED','ERROR'] },
      currentPhase: {
        type: 'object',
        required: ['phase'],
        properties: {
          phase: { type: 'string' },
          chapterId: { type: 'string' },
          sectionIndex: { type: 'number' },
          iterationCount: { type: 'number' },
          interruptible: { type: 'boolean' },
          lastCheckpoint: { type: 'string' }
        },
        additionalProperties: true
      },
      completedChapters: { type: 'array' },
      globalSettings: {
        type: 'object',
        required: ['autoSaveInterval'],
        properties: {
          interactiveMode: { type: 'boolean' },
          detailLevel: { type: 'string' },
          maxIterationsPerSection: { type: 'number' },
          autoSaveInterval: { type: 'number' }
        },
        additionalProperties: true
      },
      userPreferences: {
        type: 'object',
        required: ['searchStrategy','contentPreferences'],
        properties: {
          searchStrategy: {
            type: 'object',
            required: ['alpha'],
            properties: {
              alpha: { type: 'number' },
              priorityChunkTypes: { type: 'array', items: { type: 'string' } },
              adaptiveKeywords: { type: 'array', items: { type: 'string' } }
            },
            additionalProperties: true
          },
          contentPreferences: {
            type: 'object',
            properties: {
              exampleDensity: { type: 'string' },
              technicalDetail: { type: 'string' },
              crossReferenceStyle: { type: 'string' }
            },
            additionalProperties: true
          }
        },
        additionalProperties: true
      },
      statistics: {
        type: 'object',
        properties: {
          totalSearchQueries: { type: 'number' },
          totalUserInteractions: { type: 'number' },
          averageSectionTime: { type: 'number' },
          cacheHitRatio: { type: 'number' }
        },
        additionalProperties: true
      }
    },
    additionalProperties: true
  },
  chapterStateSchema: {
    $id: 'https://schemas.lieferantenwechsel/chapter-state.json',
    type: 'object',
    required: ['chapterId','status'],
    properties: {
      chapterId: { type: 'string' },
      status: { enum: ['INITIALIZED','IN_PROGRESS','PAUSED','COMPLETED','ERROR'] },
      currentSection: { type: 'object' },
      completedSections: { type: 'array' },
      searchCache: { type: 'object' },
      pendingDecisions: { type: 'array' }
    },
    additionalProperties: true
  }
};
