export type WorkflowStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED' | 'CANCELLED';
export type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED';
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED';
export type QuorumRule = 'UNANIMITY' | 'MAJORITY' | 'ANY_OF';
export type StepExecution = 'SEQUENTIAL' | 'PARALLEL';

export interface WorkflowStructure {
  phases: PhaseStructure[];
}

export interface PhaseStructure {
  name: string;
  steps: StepStructure[];
}

export interface StepStructure {
  name: string;
  execution: StepExecution;
  quorumRule: QuorumRule;
  quorumCount?: number;
  validatorEmails: string[];
  deadlineHours?: number;
}

export type ActionType = 'APPROVE' | 'REFUSE';

export interface TransitionResult {
  workflowAdvanced: boolean;
  phaseAdvanced: boolean;
  stepCompleted: boolean;
  workflowStatus: WorkflowStatus;
  phaseStatus: PhaseStatus;
  stepStatus: StepStatus;
}
