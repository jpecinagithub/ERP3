import { describe, it, expect } from 'vitest';
import traceabilityService from './traceabilityService.js';

describe('TraceabilityService - Unit Tests (No Database)', () => {
  it('should export a TraceabilityService instance', () => {
    expect(traceabilityService).toBeDefined();
    expect(typeof traceabilityService).toBe('object');
  });

  it('should have createDocumentLink method', () => {
    expect(traceabilityService.createDocumentLink).toBeDefined();
    expect(typeof traceabilityService.createDocumentLink).toBe('function');
  });

  it('should have getTraceabilityChain method', () => {
    expect(traceabilityService.getTraceabilityChain).toBeDefined();
    expect(typeof traceabilityService.getTraceabilityChain).toBe('function');
  });

  it('should have logAction method', () => {
    expect(traceabilityService.logAction).toBeDefined();
    expect(typeof traceabilityService.logAction).toBe('function');
  });

  it('should have canDeleteDocument method', () => {
    expect(traceabilityService.canDeleteDocument).toBeDefined();
    expect(typeof traceabilityService.canDeleteDocument).toBe('function');
  });

  it('should have getAuditLog method', () => {
    expect(traceabilityService.getAuditLog).toBeDefined();
    expect(typeof traceabilityService.getAuditLog).toBe('function');
  });

  it('should have getRecentAuditLog method', () => {
    expect(traceabilityService.getRecentAuditLog).toBeDefined();
    expect(typeof traceabilityService.getRecentAuditLog).toBe('function');
  });

  it('should have all required traceability methods', () => {
    const methods = [
      'createDocumentLink',
      'getTraceabilityChain',
      'logAction',
      'canDeleteDocument',
      'getAuditLog',
      'getRecentAuditLog'
    ];

    methods.forEach(method => {
      expect(traceabilityService[method]).toBeDefined();
      expect(typeof traceabilityService[method]).toBe('function');
    });
  });

  it('should have private helper methods', () => {
    // Private methods start with underscore
    expect(traceabilityService._getDescendants).toBeDefined();
    expect(traceabilityService._getAncestors).toBeDefined();
    expect(traceabilityService._getDocumentDetails).toBeDefined();
    expect(traceabilityService._buildFullChain).toBeDefined();
  });
});
