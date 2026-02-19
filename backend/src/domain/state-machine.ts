import type {
  WorkflowStatus,
  PhaseStatus,
  StepStatus,
  QuorumRule,
  ActionType,
  TransitionResult,
} from './workflow-types.js';

// Valid state transitions
const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['APPROVED', 'REFUSED', 'CANCELLED'],
  APPROVED: ['ARCHIVED'],
  REFUSED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

const PHASE_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['APPROVED', 'REFUSED'],
  APPROVED: [],
  REFUSED: ['IN_PROGRESS'], // Can be reactivated after refusal routing
};

const STEP_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['APPROVED', 'REFUSED'],
  APPROVED: [],
  REFUSED: ['IN_PROGRESS'], // Can be reactivated after refusal routing
};

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Invalid ${entity} transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class AlreadyDecidedError extends Error {
  constructor() {
    super('This step has already been decided');
    this.name = 'AlreadyDecidedError';
  }
}

export const stateMachine = {
  validateWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): void {
    if (!WORKFLOW_TRANSITIONS[from].includes(to)) {
      throw new InvalidTransitionError('workflow', from, to);
    }
  },

  validatePhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
    if (!PHASE_TRANSITIONS[from].includes(to)) {
      throw new InvalidTransitionError('phase', from, to);
    }
  },

  validateStepTransition(from: StepStatus, to: StepStatus): void {
    if (!STEP_TRANSITIONS[from].includes(to)) {
      throw new InvalidTransitionError('step', from, to);
    }
  },

  /**
   * Evaluate whether a step's quorum has been reached.
   * Returns the resulting step status based on the quorum rule.
   */
  evaluateQuorum(
    quorumRule: QuorumRule,
    totalValidators: number,
    approvalCount: number,
    refusalCount: number,
    quorumCount?: number,
  ): StepStatus {
    switch (quorumRule) {
      case 'UNANIMITY':
        if (refusalCount > 0) return 'REFUSED';
        if (approvalCount >= totalValidators) return 'APPROVED';
        return 'IN_PROGRESS';

      case 'MAJORITY': {
        const threshold = Math.floor(totalValidators / 2) + 1;
        if (approvalCount >= threshold) return 'APPROVED';
        if (refusalCount >= threshold) return 'REFUSED';
        // If remaining votes can't reach majority for either side
        const remaining = totalValidators - approvalCount - refusalCount;
        if (approvalCount + remaining < threshold && refusalCount + remaining < threshold) {
          // Deadlock — treat as refused
          return 'REFUSED';
        }
        return 'IN_PROGRESS';
      }

      case 'ANY_OF': {
        const required = quorumCount ?? 1;
        if (approvalCount >= required) return 'APPROVED';
        if (refusalCount > 0) return 'REFUSED';
        return 'IN_PROGRESS';
      }

      default:
        return 'IN_PROGRESS';
    }
  },

  /**
   * Determine if all steps in a phase are completed.
   */
  evaluatePhaseCompletion(stepStatuses: StepStatus[]): PhaseStatus {
    if (stepStatuses.some(s => s === 'REFUSED')) return 'REFUSED';
    if (stepStatuses.every(s => s === 'APPROVED')) return 'APPROVED';
    return 'IN_PROGRESS';
  },

  /**
   * Determine if all phases in a workflow are completed.
   */
  evaluateWorkflowCompletion(phaseStatuses: PhaseStatus[]): WorkflowStatus {
    if (phaseStatuses.some(s => s === 'REFUSED')) return 'REFUSED';
    if (phaseStatuses.every(s => s === 'APPROVED')) return 'APPROVED';
    return 'IN_PROGRESS';
  },

  /**
   * Find the index of the previous phase for refusal routing.
   * Returns -1 if we're at the first phase (route to initiator).
   */
  findPreviousPhaseIndex(currentPhaseIndex: number): number {
    return currentPhaseIndex - 1;
  },
};
