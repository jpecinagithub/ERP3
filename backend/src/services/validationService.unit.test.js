import { describe, it, expect } from 'vitest';
import validationService from './validationService.js';

describe('ValidationService - Unit Tests (No Database)', () => {
  it('should export a ValidationService instance', () => {
    expect(validationService).toBeDefined();
    expect(typeof validationService).toBe('object');
  });

  it('should have validateFundamentalEquation method', () => {
    expect(validationService.validateFundamentalEquation).toBeDefined();
    expect(typeof validationService.validateFundamentalEquation).toBe('function');
  });

  it('should have validateInventoryCoherence method', () => {
    expect(validationService.validateInventoryCoherence).toBeDefined();
    expect(typeof validationService.validateInventoryCoherence).toBe('function');
  });

  it('should have validateReceivablesCoherence method', () => {
    expect(validationService.validateReceivablesCoherence).toBeDefined();
    expect(typeof validationService.validateReceivablesCoherence).toBe('function');
  });

  it('should have validatePayablesCoherence method', () => {
    expect(validationService.validatePayablesCoherence).toBeDefined();
    expect(typeof validationService.validatePayablesCoherence).toBe('function');
  });

  it('should have validatePnLResult method', () => {
    expect(validationService.validatePnLResult).toBeDefined();
    expect(typeof validationService.validatePnLResult).toBe('function');
  });

  it('should have validateNonNegativeInventory method', () => {
    expect(validationService.validateNonNegativeInventory).toBeDefined();
    expect(typeof validationService.validateNonNegativeInventory).toBe('function');
  });

  it('should have validateNonNegativeFixedAssets method', () => {
    expect(validationService.validateNonNegativeFixedAssets).toBeDefined();
    expect(typeof validationService.validateNonNegativeFixedAssets).toBe('function');
  });

  it('should have validateDepreciation method', () => {
    expect(validationService.validateDepreciation).toBeDefined();
    expect(typeof validationService.validateDepreciation).toBe('function');
  });

  it('should have validateAllRules method', () => {
    expect(validationService.validateAllRules).toBeDefined();
    expect(typeof validationService.validateAllRules).toBe('function');
  });

  it('should have all 9 required validation methods', () => {
    const methods = [
      'validateFundamentalEquation',
      'validateInventoryCoherence',
      'validateReceivablesCoherence',
      'validatePayablesCoherence',
      'validatePnLResult',
      'validateNonNegativeInventory',
      'validateNonNegativeFixedAssets',
      'validateDepreciation',
      'validateAllRules'
    ];

    methods.forEach(method => {
      expect(validationService[method]).toBeDefined();
      expect(typeof validationService[method]).toBe('function');
    });
  });
});
