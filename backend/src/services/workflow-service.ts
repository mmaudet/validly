import { prisma } from '../infrastructure/database.js';
import { stateMachine, InvalidTransitionError, AlreadyDecidedError } from '../domain/state-machine.js';
import type { WorkflowStructure, ActionType } from '../domain/workflow-types.js';
import { t } from '../i18n/index.js';
import { tokenService } from './token-service.js';
import { emailService } from './email-service.js';
import { env } from '../config/env.js';
import { scheduleReminder, cancelReminder } from './reminder-service.js';
import { notificationService } from './notification-service.js';

export class WorkflowError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export interface LaunchInput {
  title: string;
  structure: WorkflowStructure;
  documentIds: string[];
  initiatorId: string;
  templateId?: string;
}

export interface ActionInput {
  stepId: string;
  actorEmail: string;
  actorId?: string;
  action: ActionType;
  comment: string;
}

async function notifyValidators(
  stepId: string,
  validatorEmails: string[],
  context: {
    workflowTitle: string;
    documentTitle: string;
    stepName: string;
    initiatorName: string;
  }
) {
  try {
    // Resolve validator locales (batch query; fallback 'en' for unregistered validators)
    const validatorUsers = await prisma.user.findMany({
      where: { email: { in: validatorEmails } },
      select: { email: true, locale: true },
    });
    const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

    const tokens = await tokenService.createTokensForStep(stepId, validatorEmails);
    for (const email of validatorEmails) {
      const { approveToken, refuseToken } = tokens[email];
      await emailService.sendPendingAction({
        to: email,
        locale: localeByEmail.get(email) ?? 'en',
        workflowTitle: context.workflowTitle,
        documentTitle: context.documentTitle,
        stepName: context.stepName,
        initiatorName: context.initiatorName,
        approveUrl: `${env.API_URL}/api/actions/${approveToken}`,
        refuseUrl: `${env.API_URL}/api/actions/${refuseToken}`,
      });
    }
  } catch (err) {
    console.error('Failed to send validator notifications:', err);
  }
}

export const workflowService = {
  /**
   * Launch a new workflow. Deep-copies the template structure into the instance.
   */
  async launch(input: LaunchInput) {
    const user = await prisma.user.findUnique({ where: { id: input.initiatorId } });
    if (!user) throw new WorkflowError(404, 'User not found');

    // Deep-copy structure (snapshot pattern)
    const structureSnapshot = JSON.parse(JSON.stringify(input.structure));

    const workflow = await prisma.$transaction(async (tx) => {
      const wf = await tx.workflowInstance.create({
        data: {
          title: input.title,
          initiatorId: input.initiatorId,
          templateId: input.templateId,
          status: 'IN_PROGRESS',
          structure: structureSnapshot as any,
          currentPhase: 0,
        },
      });

      // Link documents
      if (input.documentIds.length > 0) {
        await tx.workflowDocument.createMany({
          data: input.documentIds.map(docId => ({
            workflowId: wf.id,
            documentId: docId,
          })),
        });
      }

      // Create phase and step instances from structure
      for (let pi = 0; pi < structureSnapshot.phases.length; pi++) {
        const phaseDef = structureSnapshot.phases[pi];
        const phase = await tx.phaseInstance.create({
          data: {
            workflowId: wf.id,
            order: pi,
            name: phaseDef.name,
            status: pi === 0 ? 'IN_PROGRESS' : 'PENDING',
          },
        });

        // Determine if this phase uses parallel execution
        const phaseHasParallel = phaseDef.steps.some(
          (s: any) => s.execution === 'PARALLEL'
        );

        for (let si = 0; si < phaseDef.steps.length; si++) {
          const stepDef = phaseDef.steps[si];
          // In phase 0: activate ALL steps if phase is parallel, else only step 0
          const isActiveStep = pi === 0 && (phaseHasParallel || si === 0);
          await tx.stepInstance.create({
            data: {
              phaseId: phase.id,
              order: si,
              name: stepDef.name,
              status: isActiveStep ? 'IN_PROGRESS' : 'PENDING',
              execution: stepDef.execution,
              quorumRule: stepDef.quorumRule,
              quorumCount: stepDef.quorumCount,
              validatorEmails: stepDef.validatorEmails,
              deadline: stepDef.deadlineHours
                ? new Date(Date.now() + stepDef.deadlineHours * 60 * 60 * 1000)
                : null,
            },
          });
        }
      }

      // Audit
      await tx.auditEvent.create({
        data: {
          action: 'WORKFLOW_LAUNCHED',
          entityType: 'workflow',
          entityId: wf.id,
          actorId: input.initiatorId,
          actorEmail: user.email,
          metadata: { title: input.title, documentCount: input.documentIds.length },
        },
      });

      return wf;
    });

    const result = await this.getById(workflow.id);

    // Send email notifications to all active step validators in phase 0 (after transaction commit)
    const firstPhase = result.phases[0];
    if (firstPhase) {
      const activeSteps = firstPhase.steps.filter((s: any) => s.status === 'IN_PROGRESS');
      for (const step of activeSteps) {
        await notifyValidators(step.id, step.validatorEmails, {
          workflowTitle: result.title,
          documentTitle: result.documents[0]?.document?.title ?? result.title,
          stepName: step.name,
          initiatorName: result.initiator.name,
        });
        if (step.deadline) {
          try {
            await scheduleReminder(step.id, step.deadline);
          } catch (err) {
            console.error('Failed to schedule reminder for step:', err);
          }
        }
      }
    }

    return result;
  },

  /**
   * Record a validator's decision on a step.
   * Uses atomic operations to prevent quorum race conditions.
   */
  async recordAction(input: ActionInput) {
    const step = await prisma.stepInstance.findUnique({
      where: { id: input.stepId },
      include: {
        phase: {
          include: {
            workflow: true,
            steps: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!step) throw new WorkflowError(404, t('workflow.not_found'));
    if (step.status !== 'IN_PROGRESS') {
      throw new WorkflowError(409, t('workflow.already_decided'));
    }

    // Check validator is authorized
    if (!step.validatorEmails.includes(input.actorEmail)) {
      throw new WorkflowError(403, 'Not an authorized validator for this step');
    }

    // Check for duplicate action by same validator
    const existingAction = await prisma.workflowAction.findFirst({
      where: {
        stepId: input.stepId,
        actorEmail: input.actorEmail,
      },
    });
    if (existingAction) {
      throw new WorkflowError(409, t('workflow.already_decided'));
    }

    if (!input.comment.trim()) {
      throw new WorkflowError(400, t('workflow.comment_required'));
    }

    const workflow = step.phase.workflow;
    const phase = step.phase;

    // Perform action in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Record the action
      await tx.workflowAction.create({
        data: {
          workflowId: workflow.id,
          stepId: step.id,
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          action: input.action,
          comment: input.comment,
        },
      });

      // Atomic increment of decision count
      const updatedStep = await tx.stepInstance.update({
        where: { id: step.id },
        data: { decisionCount: { increment: 1 } },
      });

      // Count approvals and refusals for this step
      const actions = await tx.workflowAction.findMany({
        where: { stepId: step.id },
      });
      const approvalCount = actions.filter(a => a.action === 'APPROVE').length;
      const refusalCount = actions.filter(a => a.action === 'REFUSE').length;

      // Evaluate quorum
      const newStepStatus = stateMachine.evaluateQuorum(
        step.quorumRule as any,
        step.validatorEmails.length,
        approvalCount,
        refusalCount,
        step.quorumCount ?? undefined,
      );

      let stepCompleted = false;
      let phaseAdvanced = false;
      let workflowAdvanced = false;
      let activatedStep: { id: string; name: string; validatorEmails: string[]; deadline?: Date | null } | null = null;
      let activatedSteps: { id: string; name: string; validatorEmails: string[]; deadline?: Date | null }[] = [];

      if (newStepStatus !== 'IN_PROGRESS') {
        // Step has reached a decision
        stateMachine.validateStepTransition(step.status as any, newStepStatus);
        await tx.stepInstance.update({
          where: { id: step.id },
          data: { status: newStepStatus },
        });
        stepCompleted = true;

        if (newStepStatus === 'REFUSED') {
          // Refusal routing: go back to previous step/phase
          activatedStep = await this.handleRefusal(tx, workflow.id, phase, step);
          phaseAdvanced = true;
        } else if (newStepStatus === 'APPROVED') {
          // Try to advance to next step or phase
          const advanced = await this.tryAdvance(tx, workflow.id, phase);
          phaseAdvanced = advanced.phaseAdvanced;
          workflowAdvanced = advanced.workflowAdvanced;
          activatedStep = advanced.activatedStep;
          activatedSteps = advanced.activatedSteps;
        }
      }

      // Audit
      await tx.auditEvent.create({
        data: {
          action: input.action === 'APPROVE' ? 'STEP_APPROVED' : 'STEP_REFUSED',
          entityType: 'step',
          entityId: step.id,
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          metadata: { comment: input.comment, stepName: step.name, workflowId: workflow.id },
        },
      });

      return { stepCompleted, phaseAdvanced, workflowAdvanced, newStepStatus, activatedStep, activatedSteps };
    });

    // Cancel BullMQ reminder job for the completed step (after transaction)
    if (result.stepCompleted) {
      try {
        await cancelReminder(step.id);
      } catch (err) {
        console.error('Failed to cancel reminder for completed step:', err);
      }
    }

    // Send email notifications to newly activated step validators (after transaction commit)
    // Build unified list: activatedSteps (parallel next phase) takes priority;
    // fall back to wrapping the singular activatedStep for sequential next phase.
    const stepsToNotify =
      result.activatedSteps && result.activatedSteps.length > 0
        ? result.activatedSteps
        : result.activatedStep
        ? [result.activatedStep]
        : [];

    if (stepsToNotify.length > 0) {
      const wf = await prisma.workflowInstance.findUnique({
        where: { id: workflow.id },
        include: {
          initiator: { select: { name: true } },
          documents: { include: { document: { select: { title: true } } } },
        },
      });
      if (wf) {
        for (const step of stepsToNotify) {
          await notifyValidators(step.id, step.validatorEmails, {
            workflowTitle: wf.title,
            documentTitle: wf.documents[0]?.document.title ?? wf.title,
            stepName: step.name,
            initiatorName: wf.initiator.name,
          });
          if (step.deadline) {
            try {
              await scheduleReminder(step.id, step.deadline);
            } catch (err) {
              console.error('Failed to schedule reminder for activated step:', err);
            }
          }
        }
      }
    }

    // Send initiator email notifications (after transaction commit, wrapped in try/catch)
    try {
      const wfWithInitiator = await prisma.workflowInstance.findUnique({
        where: { id: workflow.id },
        include: {
          initiator: { select: { email: true, locale: true } },
        },
      });

      if (wfWithInitiator) {
        const workflowUrl = `${env.APP_URL}/workflows/${workflow.id}`;

        // Notify initiator of the validator's action
        await emailService.sendInitiatorAction({
          to: wfWithInitiator.initiator.email,
          locale: wfWithInitiator.initiator.locale,
          workflowTitle: workflow.title,
          stepName: step.name,
          actorEmail: input.actorEmail,
          actionType: input.action as 'APPROVE' | 'REFUSE',
          comment: input.comment,
          workflowUrl,
        });

        // Notify initiator if workflow reached a terminal state
        const isWorkflowComplete =
          result.workflowAdvanced === true ||
          (result.newStepStatus === 'REFUSED' && result.activatedStep === null && result.stepCompleted);

        if (isWorkflowComplete) {
          const finalStatus = result.workflowAdvanced ? 'APPROVED' : 'REFUSED';
          await emailService.sendInitiatorComplete({
            to: wfWithInitiator.initiator.email,
            locale: wfWithInitiator.initiator.locale,
            workflowTitle: workflow.title,
            finalStatus,
            workflowUrl,
          });
        }
      }
    } catch (err) {
      console.error('Failed to send initiator notifications:', err);
    }

    // Create in-app notifications (after transaction commit, never inside $transaction)
    try {
      const wfForNotif = await prisma.workflowInstance.findUnique({
        where: { id: workflow.id },
        include: {
          initiator: { select: { id: true } },
          phases: { include: { steps: { select: { validatorEmails: true } } } },
        },
      });
      if (wfForNotif) {
        // Collect all validator emails from all steps
        const allValidatorEmails = new Set<string>();
        for (const phase of wfForNotif.phases) {
          for (const wfStep of phase.steps) {
            for (const email of wfStep.validatorEmails) {
              allValidatorEmails.add(email);
            }
          }
        }

        // Resolve validator emails to registered user IDs
        const validatorUsers = await prisma.user.findMany({
          where: { email: { in: [...allValidatorEmails] } },
          select: { id: true, email: true },
        });

        const notifContext = {
          workflowId: workflow.id,
          workflowTitle: workflow.title,
          stepName: step.name,
          actorEmail: input.actorEmail,
        };

        // Determine notification type from action
        const notifType = input.action === 'APPROVE' ? 'STEP_APPROVED' : 'STEP_REFUSED';

        // Deduplicated list of all participant IDs
        const recipientIds = [
          wfForNotif.initiator.id,
          ...validatorUsers.map(u => u.id),
        ].filter((id, idx, arr) => arr.indexOf(id) === idx);

        const actorUserId = input.actorId;
        for (const recipientId of recipientIds) {
          if (recipientId === actorUserId) continue; // don't notify yourself
          await notificationService.createNotification(recipientId, notifType, notifContext);
        }

        // If workflow reached a terminal state, send WORKFLOW_COMPLETED or WORKFLOW_REFUSED
        const isTerminal =
          result.workflowAdvanced === true ||
          (result.newStepStatus === 'REFUSED' && result.activatedStep === null && result.stepCompleted);

        if (isTerminal) {
          const terminalType = result.workflowAdvanced ? 'WORKFLOW_COMPLETED' : 'WORKFLOW_REFUSED';
          const terminalContext = {
            workflowId: workflow.id,
            workflowTitle: workflow.title,
          };
          // Notify initiator (primary recipient for terminal notifications)
          await notificationService.createNotification(wfForNotif.initiator.id, terminalType, terminalContext);
        }
      }
    } catch (err) {
      console.error('Failed to create in-app notifications:', err);
    }

    return result;
  },

  /**
   * Handle refusal: route back to the previous step.
   */
  async handleRefusal(tx: any, workflowId: string, currentPhase: any, currentStep: any) {
    // Mark current phase as refused
    await tx.phaseInstance.update({
      where: { id: currentPhase.id },
      data: { status: 'REFUSED' },
    });

    const prevPhaseIndex = stateMachine.findPreviousPhaseIndex(currentPhase.order);

    if (prevPhaseIndex < 0) {
      // No previous phase — refuse the entire workflow
      await tx.workflowInstance.update({
        where: { id: workflowId },
        data: { status: 'REFUSED' },
      });
      return null;
    }

    let activatedStep: { id: string; name: string; validatorEmails: string[] } | null = null;

    // Reactivate previous phase
    const prevPhase = await tx.phaseInstance.findFirst({
      where: { workflowId, order: prevPhaseIndex },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (prevPhase) {
      await tx.phaseInstance.update({
        where: { id: prevPhase.id },
        data: { status: 'IN_PROGRESS' },
      });

      // Reactivate the last step of the previous phase
      const lastStep = prevPhase.steps[prevPhase.steps.length - 1];
      if (lastStep) {
        await tx.stepInstance.update({
          where: { id: lastStep.id },
          data: {
            status: 'IN_PROGRESS',
            decisionCount: 0,
          },
        });

        // Clear previous actions on this step for re-evaluation
        await tx.workflowAction.deleteMany({
          where: { stepId: lastStep.id },
        });

        activatedStep = { id: lastStep.id, name: lastStep.name, validatorEmails: lastStep.validatorEmails };
      }

      await tx.workflowInstance.update({
        where: { id: workflowId },
        data: { currentPhase: prevPhaseIndex },
      });
    }

    return activatedStep;
  },

  /**
   * Try to advance to the next step or phase after an approval.
   */
  async tryAdvance(tx: any, workflowId: string, currentPhase: any) {
    let phaseAdvanced = false;
    let workflowAdvanced = false;
    let activatedStep: { id: string; name: string; validatorEmails: string[]; deadline?: Date | null } | null = null;
    let activatedSteps: { id: string; name: string; validatorEmails: string[]; deadline?: Date | null }[] = [];

    // Check all steps in current phase
    const steps = await tx.stepInstance.findMany({
      where: { phaseId: currentPhase.id },
      orderBy: { order: 'asc' },
    });

    const stepStatuses = steps.map((s: any) => s.status);
    const phaseResult = stateMachine.evaluatePhaseCompletion(stepStatuses);

    if (phaseResult === 'APPROVED') {
      // Phase complete — advance to next phase
      await tx.phaseInstance.update({
        where: { id: currentPhase.id },
        data: { status: 'APPROVED' },
      });
      phaseAdvanced = true;

      // Check if there's a next phase
      const allPhases = await tx.phaseInstance.findMany({
        where: { workflowId },
        orderBy: { order: 'asc' },
      });

      const nextPhase = allPhases.find((p: any) => p.order === currentPhase.order + 1);
      if (nextPhase) {
        // Activate next phase
        await tx.phaseInstance.update({
          where: { id: nextPhase.id },
          data: { status: 'IN_PROGRESS' },
        });

        // Load all steps in the next phase to determine activation mode
        const nextPhaseSteps = await tx.stepInstance.findMany({
          where: { phaseId: nextPhase.id },
          orderBy: { order: 'asc' },
        });
        const nextPhaseHasParallel = nextPhaseSteps.some((s: any) => s.execution === 'PARALLEL');

        if (nextPhaseHasParallel) {
          // Activate ALL steps in the parallel next phase
          for (const s of nextPhaseSteps) {
            await tx.stepInstance.update({ where: { id: s.id }, data: { status: 'IN_PROGRESS' } });
          }
          // Populate activatedSteps with all steps for the post-transaction notification loop
          activatedSteps = nextPhaseSteps.map((s: any) => ({
            id: s.id,
            name: s.name,
            validatorEmails: s.validatorEmails,
            deadline: s.deadline,
          }));
        } else {
          // Sequential: activate only first step
          const firstStep = nextPhaseSteps[0];
          if (firstStep) {
            await tx.stepInstance.update({ where: { id: firstStep.id }, data: { status: 'IN_PROGRESS' } });
            activatedStep = { id: firstStep.id, name: firstStep.name, validatorEmails: firstStep.validatorEmails, deadline: firstStep.deadline };
          }
        }

        await tx.workflowInstance.update({
          where: { id: workflowId },
          data: { currentPhase: nextPhase.order },
        });
      } else {
        // All phases complete — workflow approved
        await tx.workflowInstance.update({
          where: { id: workflowId },
          data: { status: 'APPROVED' },
        });
        workflowAdvanced = true;
      }
    } else if (phaseResult === 'IN_PROGRESS') {
      // Only activate next PENDING step if in SEQUENTIAL mode.
      // In PARALLEL mode, all steps were activated at phase start — no new activations.
      const phaseHasParallel = steps.some((s: any) => s.execution === 'PARALLEL');
      if (!phaseHasParallel) {
        const nextStep = steps.find((s: any) => s.status === 'PENDING');
        if (nextStep) {
          await tx.stepInstance.update({
            where: { id: nextStep.id },
            data: { status: 'IN_PROGRESS' },
          });
          activatedStep = { id: nextStep.id, name: nextStep.name, validatorEmails: nextStep.validatorEmails };
        }
      }
    }

    return { phaseAdvanced, workflowAdvanced, activatedStep, activatedSteps };
  },

  async getById(id: string) {
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, email: true, name: true } },
        documents: { include: { document: true } },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: {
                actions: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!workflow) throw new WorkflowError(404, t('workflow.not_found'));
    return workflow;
  },

  async listByInitiator(
    initiatorId: string,
    page = 1,
    limit = 20,
    options?: { status?: string; includeArchived?: boolean },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { initiatorId };

    if (options?.status) {
      where.status = options.status;
    } else if (!options?.includeArchived) {
      where.status = { not: 'ARCHIVED' };
    }

    const [workflows, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          documents: { include: { document: { select: { id: true, title: true } } } },
          phases: {
            orderBy: { order: 'asc' },
            select: { id: true, name: true, status: true, order: true },
          },
        },
      }),
      prisma.workflowInstance.count({ where }),
    ]);
    return { workflows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Cancel an in-progress workflow (initiator only).
   * Expires all active tokens and creates an audit event.
   */
  async cancel(workflowId: string, initiatorId: string) {
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: {
        initiator: { select: { id: true, email: true } },
        phases: {
          include: {
            steps: true,
          },
        },
      },
    });

    if (!workflow) throw new WorkflowError(404, t('workflow.not_found'));
    if (workflow.initiatorId !== initiatorId) {
      throw new WorkflowError(403, 'Only the initiator can cancel this workflow');
    }
    if (workflow.status !== 'IN_PROGRESS') {
      throw new WorkflowError(409, 'Workflow is not in progress');
    }

    // Collect all step IDs across all phases
    const allStepIds: string[] = [];
    for (const phase of workflow.phases) {
      for (const step of phase.steps) {
        allStepIds.push(step.id);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Cancel the workflow
      await tx.workflowInstance.update({
        where: { id: workflowId },
        data: { status: 'CANCELLED' },
      });

      // Expire all active (unused) tokens for steps in this workflow
      if (allStepIds.length > 0) {
        await tx.actionToken.updateMany({
          where: {
            stepId: { in: allStepIds },
            usedAt: null,
          },
          data: { expiresAt: new Date(0) },
        });
      }

      // Audit event
      await tx.auditEvent.create({
        data: {
          action: 'WORKFLOW_CANCELLED',
          entityType: 'workflow',
          entityId: workflowId,
          actorId: initiatorId,
          actorEmail: workflow.initiator.email,
          metadata: { workflowId },
        },
      });
    });

    // Cancel BullMQ reminder jobs for all steps (after transaction)
    for (const phase of workflow.phases) {
      for (const step of phase.steps) {
        try {
          await cancelReminder(step.id);
        } catch {
          // Non-critical — log but continue
          console.error(`Failed to cancel reminder for step ${step.id}`);
        }
      }
    }
  },

  /**
   * Re-send notifications to pending validators on the active step.
   * Only pending validators (those who haven't acted yet) receive a new notification.
   */
  async notifyCurrentStep(workflowId: string, initiatorId: string) {
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: {
        initiator: { select: { id: true, name: true } },
        documents: { include: { document: { select: { title: true } } } },
        phases: {
          include: {
            steps: {
              include: {
                actions: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!workflow) throw new WorkflowError(404, t('workflow.not_found'));
    if (workflow.initiatorId !== initiatorId) {
      throw new WorkflowError(403, 'Only the initiator can re-notify validators');
    }

    // Find the active phase
    const activePhase = workflow.phases.find(p => p.status === 'IN_PROGRESS');
    if (!activePhase) {
      throw new WorkflowError(409, 'No active step to notify');
    }

    // Find the active step
    const activeStep = activePhase.steps.find(s => s.status === 'IN_PROGRESS');
    if (!activeStep) {
      throw new WorkflowError(409, 'No active step to notify');
    }

    // Determine pending validators (those who haven't acted yet)
    const actedEmails = new Set(activeStep.actions.map((a: any) => a.actorEmail));
    const pendingEmails = activeStep.validatorEmails.filter((email: string) => !actedEmails.has(email));

    if (pendingEmails.length === 0) {
      throw new WorkflowError(409, 'All validators have acted');
    }

    // Use distinct reminder template (not the initial notification)
    try {
      // Resolve validator locales (batch query; fallback 'en' for unregistered validators)
      const validatorUsers = await prisma.user.findMany({
        where: { email: { in: pendingEmails } },
        select: { email: true, locale: true },
      });
      const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

      const tokens = await tokenService.createTokensForStep(activeStep.id, pendingEmails);
      const docTitle = workflow.documents[0]?.document?.title ?? workflow.title;
      for (const email of pendingEmails) {
        const { approveToken, refuseToken } = tokens[email];
        await emailService.sendManualReminder({
          to: email,
          locale: localeByEmail.get(email) ?? 'en',
          workflowTitle: workflow.title,
          documentTitle: docTitle,
          stepName: activeStep.name,
          initiatorName: workflow.initiator.name,
          approveUrl: `${env.API_URL}/api/actions/${approveToken}`,
          refuseUrl: `${env.API_URL}/api/actions/${refuseToken}`,
        });
      }
    } catch (err) {
      console.error('Failed to send manual reminders:', err);
    }
  },

  /**
   * Archive a terminal workflow (initiator only).
   */
  async archive(workflowId: string, initiatorId: string) {
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: { initiator: { select: { id: true, email: true } } },
    });

    if (!workflow) throw new WorkflowError(404, t('workflow.not_found'));
    if (workflow.initiatorId !== initiatorId) {
      throw new WorkflowError(403, 'Only the initiator can archive this workflow');
    }

    const terminalStatuses = ['APPROVED', 'REFUSED', 'CANCELLED'];
    if (!terminalStatuses.includes(workflow.status)) {
      throw new WorkflowError(409, 'Only terminal workflows can be archived');
    }

    await prisma.$transaction(async (tx) => {
      await tx.workflowInstance.update({
        where: { id: workflowId },
        data: { status: 'ARCHIVED' },
      });

      await tx.auditEvent.create({
        data: {
          action: 'WORKFLOW_ARCHIVED',
          entityType: 'workflow',
          entityId: workflowId,
          actorId: initiatorId,
          actorEmail: workflow.initiator.email,
          metadata: { workflowId },
        },
      });
    });
  },

  /**
   * Archive multiple terminal workflows at once (initiator only).
   */
  async archiveBulk(workflowIds: string[], initiatorId: string) {
    const user = await prisma.user.findUnique({ where: { id: initiatorId } });
    if (!user) throw new WorkflowError(404, 'User not found');

    const workflows = await prisma.workflowInstance.findMany({
      where: { id: { in: workflowIds } },
    });

    const terminalStatuses = ['APPROVED', 'REFUSED', 'CANCELLED'];
    for (const wf of workflows) {
      if (wf.initiatorId !== initiatorId) {
        throw new WorkflowError(403, `Workflow ${wf.id} does not belong to you`);
      }
      if (!terminalStatuses.includes(wf.status)) {
        throw new WorkflowError(409, `Workflow ${wf.id} is not in a terminal state`);
      }
    }

    if (workflows.length !== workflowIds.length) {
      throw new WorkflowError(404, 'One or more workflows not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.workflowInstance.updateMany({
        where: { id: { in: workflowIds } },
        data: { status: 'ARCHIVED' },
      });

      for (const wf of workflows) {
        await tx.auditEvent.create({
          data: {
            action: 'WORKFLOW_ARCHIVED',
            entityType: 'workflow',
            entityId: wf.id,
            actorId: initiatorId,
            actorEmail: user.email,
            metadata: { workflowId: wf.id },
          },
        });
      }
    });
  },

  async listPendingForValidator(email: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const whereClause = {
      status: 'IN_PROGRESS' as const,
      validatorEmails: { has: email },
      phase: { is: { workflow: { is: { status: 'IN_PROGRESS' as const } } } },
    };

    const steps = await prisma.stepInstance.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        phase: {
          include: {
            workflow: {
              include: {
                initiator: { select: { id: true, email: true, name: true } },
                documents: { include: { document: { select: { id: true, title: true } } } },
              },
            },
          },
        },
        actions: {
          where: { actorEmail: email },
        },
      },
    });

    const total = await prisma.stepInstance.count({
      where: whereClause,
    });

    // Filter out steps where this validator has already acted
    const pending = steps.filter((s: any) => s.actions.length === 0);

    return { steps: pending, total: pending.length, page, limit, totalPages: Math.ceil(pending.length / limit) };
  },
};
