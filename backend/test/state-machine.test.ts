import { describe, it, expect } from 'vitest';
import { stateMachine, InvalidTransitionError } from '../src/domain/state-machine.js';

describe('State Machine', () => {
  describe('workflow transitions', () => {
    it('allows DRAFT → IN_PROGRESS', () => {
      expect(() => stateMachine.validateWorkflowTransition('DRAFT', 'IN_PROGRESS')).not.toThrow();
    });

    it('allows DRAFT → CANCELLED', () => {
      expect(() => stateMachine.validateWorkflowTransition('DRAFT', 'CANCELLED')).not.toThrow();
    });

    it('rejects APPROVED → IN_PROGRESS', () => {
      expect(() => stateMachine.validateWorkflowTransition('APPROVED', 'IN_PROGRESS'))
        .toThrow(InvalidTransitionError);
    });
  });

  describe('quorum evaluation', () => {
    it('UNANIMITY: approves when all approve', () => {
      expect(stateMachine.evaluateQuorum('UNANIMITY', 3, 3, 0)).toBe('APPROVED');
    });

    it('UNANIMITY: refuses on first refusal', () => {
      expect(stateMachine.evaluateQuorum('UNANIMITY', 3, 1, 1)).toBe('REFUSED');
    });

    it('UNANIMITY: in progress when not all have voted', () => {
      expect(stateMachine.evaluateQuorum('UNANIMITY', 3, 2, 0)).toBe('IN_PROGRESS');
    });

    it('MAJORITY: approves with majority', () => {
      expect(stateMachine.evaluateQuorum('MAJORITY', 5, 3, 1)).toBe('APPROVED');
    });

    it('MAJORITY: refuses with majority refusals', () => {
      expect(stateMachine.evaluateQuorum('MAJORITY', 5, 1, 3)).toBe('REFUSED');
    });

    it('MAJORITY: in progress when undecided', () => {
      expect(stateMachine.evaluateQuorum('MAJORITY', 5, 2, 1)).toBe('IN_PROGRESS');
    });

    it('ANY_OF: approves with minimum required', () => {
      expect(stateMachine.evaluateQuorum('ANY_OF', 5, 2, 0, 2)).toBe('APPROVED');
    });

    it('ANY_OF: defaults to 1 approval required', () => {
      expect(stateMachine.evaluateQuorum('ANY_OF', 5, 1, 0)).toBe('APPROVED');
    });

    it('ANY_OF: refuses on refusal', () => {
      expect(stateMachine.evaluateQuorum('ANY_OF', 5, 0, 1, 2)).toBe('REFUSED');
    });
  });

  describe('phase completion', () => {
    it('approves when all steps approved', () => {
      expect(stateMachine.evaluatePhaseCompletion(['APPROVED', 'APPROVED'])).toBe('APPROVED');
    });

    it('refuses when any step refused', () => {
      expect(stateMachine.evaluatePhaseCompletion(['APPROVED', 'REFUSED'])).toBe('REFUSED');
    });

    it('in progress when steps still pending', () => {
      expect(stateMachine.evaluatePhaseCompletion(['APPROVED', 'IN_PROGRESS'])).toBe('IN_PROGRESS');
    });
  });

  describe('refusal routing', () => {
    it('returns previous phase index', () => {
      expect(stateMachine.findPreviousPhaseIndex(2)).toBe(1);
    });

    it('returns -1 for first phase', () => {
      expect(stateMachine.findPreviousPhaseIndex(0)).toBe(-1);
    });
  });
});
