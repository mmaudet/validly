import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const shouldRun = !!process.env.DATABASE_URL;

describe.skipIf(!shouldRun)('Workflow engine', () => {
  let app: FastifyInstance;
  let accessToken: string;
  let userId: string;
  const initiatorEmail = `initiator-${Date.now()}@example.com`;
  const validator1Email = `validator1-${Date.now()}@example.com`;
  const validator2Email = `validator2-${Date.now()}@example.com`;
  const validator3Email = `validator3-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { email: initiatorEmail, password: 'testpassword123', name: 'Initiator' },
    });
    const body = JSON.parse(signupRes.payload);
    accessToken = body.accessToken;

    // Get user ID from profile
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    userId = JSON.parse(meRes.payload).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('launches a workflow with sequential phases', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Test Workflow',
        documentIds: [],
        structure: {
          phases: [
            {
              name: 'Review',
              steps: [
                {
                  name: 'Manager Review',
                  execution: 'SEQUENTIAL',
                  quorumRule: 'UNANIMITY',
                  validatorEmails: [validator1Email],
                },
              ],
            },
            {
              name: 'Final Approval',
              steps: [
                {
                  name: 'Director Approval',
                  execution: 'SEQUENTIAL',
                  quorumRule: 'UNANIMITY',
                  validatorEmails: [validator2Email],
                },
              ],
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const wf = JSON.parse(res.payload);
    expect(wf.status).toBe('IN_PROGRESS');
    expect(wf.phases).toHaveLength(2);
    expect(wf.phases[0].status).toBe('IN_PROGRESS');
    expect(wf.phases[1].status).toBe('PENDING');
    expect(wf.phases[0].steps[0].status).toBe('IN_PROGRESS');
  });

  it('advances workflow through approval', async () => {
    // Create workflow
    const launchRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Advance Test',
        documentIds: [],
        structure: {
          phases: [
            {
              name: 'Phase 1',
              steps: [{
                name: 'Step 1',
                execution: 'SEQUENTIAL',
                quorumRule: 'UNANIMITY',
                validatorEmails: [validator1Email],
              }],
            },
            {
              name: 'Phase 2',
              steps: [{
                name: 'Step 2',
                execution: 'SEQUENTIAL',
                quorumRule: 'UNANIMITY',
                validatorEmails: [validator2Email],
              }],
            },
          ],
        },
      },
    });

    const wf = JSON.parse(launchRes.payload);
    const stepId = wf.phases[0].steps[0].id;

    // Create validator account and get token
    const v1Signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { email: validator1Email, password: 'testpassword123', name: 'Validator 1' },
    });
    const v1Token = JSON.parse(v1Signup.payload).accessToken;

    // Approve step 1
    const actionRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${stepId}/action`,
      headers: { authorization: `Bearer ${v1Token}` },
      payload: { action: 'APPROVE', comment: 'Looks good' },
    });

    expect(actionRes.statusCode).toBe(200);
    const result = JSON.parse(actionRes.payload);
    expect(result.stepCompleted).toBe(true);
    expect(result.phaseAdvanced).toBe(true);

    // Check workflow state
    const wfRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${wf.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const updated = JSON.parse(wfRes.payload);
    expect(updated.phases[0].status).toBe('APPROVED');
    expect(updated.phases[1].status).toBe('IN_PROGRESS');
    expect(updated.phases[1].steps[0].status).toBe('IN_PROGRESS');
  });

  it('handles refusal routing to previous phase', async () => {
    // Create workflow with 2 phases
    const launchRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Refusal Test',
        documentIds: [],
        structure: {
          phases: [
            {
              name: 'Phase 1',
              steps: [{
                name: 'Step 1',
                execution: 'SEQUENTIAL',
                quorumRule: 'UNANIMITY',
                validatorEmails: [validator1Email],
              }],
            },
            {
              name: 'Phase 2',
              steps: [{
                name: 'Step 2',
                execution: 'SEQUENTIAL',
                quorumRule: 'UNANIMITY',
                validatorEmails: [validator2Email],
              }],
            },
          ],
        },
      },
    });

    const wf = JSON.parse(launchRes.payload);

    // Validator 1 approves phase 1
    const v1Login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validator1Email, password: 'testpassword123' },
    });
    const v1Token = JSON.parse(v1Login.payload).accessToken;

    await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${wf.phases[0].steps[0].id}/action`,
      headers: { authorization: `Bearer ${v1Token}` },
      payload: { action: 'APPROVE', comment: 'OK' },
    });

    // Validator 2 refuses phase 2 — should route back to phase 1
    const v2Signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { email: validator2Email, password: 'testpassword123', name: 'Validator 2' },
    });
    const v2Token = JSON.parse(v2Signup.payload).accessToken;

    // Get fresh workflow to find phase 2 step ID
    const freshWf = await app.inject({
      method: 'GET',
      url: `/api/workflows/${wf.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const step2Id = JSON.parse(freshWf.payload).phases[1].steps[0].id;

    const refuseRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${step2Id}/action`,
      headers: { authorization: `Bearer ${v2Token}` },
      payload: { action: 'REFUSE', comment: 'Needs revision' },
    });

    expect(refuseRes.statusCode).toBe(200);

    // Check: phase 2 refused, phase 1 reactivated
    const finalWf = await app.inject({
      method: 'GET',
      url: `/api/workflows/${wf.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const final = JSON.parse(finalWf.payload);
    expect(final.phases[1].status).toBe('REFUSED');
    expect(final.phases[0].status).toBe('IN_PROGRESS');
    expect(final.currentPhase).toBe(0);
  });

  it('handles majority quorum rule', async () => {
    const launchRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Majority Test',
        documentIds: [],
        structure: {
          phases: [{
            name: 'Vote Phase',
            steps: [{
              name: 'Committee Vote',
              execution: 'PARALLEL',
              quorumRule: 'MAJORITY',
              validatorEmails: [validator1Email, validator2Email, validator3Email],
            }],
          }],
        },
      },
    });

    const wf = JSON.parse(launchRes.payload);
    const stepId = wf.phases[0].steps[0].id;

    // Validator 1 approves
    const v1Login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validator1Email, password: 'testpassword123' },
    });
    const v1Token = JSON.parse(v1Login.payload).accessToken;

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${stepId}/action`,
      headers: { authorization: `Bearer ${v1Token}` },
      payload: { action: 'APPROVE', comment: 'Yes' },
    });
    expect(JSON.parse(r1.payload).stepCompleted).toBe(false); // Not yet majority

    // Validator 2 approves (now 2/3 = majority)
    const v2Login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validator2Email, password: 'testpassword123' },
    });
    const v2Token = JSON.parse(v2Login.payload).accessToken;

    const r2 = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${stepId}/action`,
      headers: { authorization: `Bearer ${v2Token}` },
      payload: { action: 'APPROVE', comment: 'Agreed' },
    });
    expect(JSON.parse(r2.payload).stepCompleted).toBe(true);
    expect(JSON.parse(r2.payload).workflowAdvanced).toBe(true); // Single phase, workflow done
  });

  it('rejects duplicate action from same validator', async () => {
    const launchRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Duplicate Test',
        documentIds: [],
        structure: {
          phases: [{
            name: 'Phase 1',
            steps: [{
              name: 'Step 1',
              execution: 'SEQUENTIAL',
              quorumRule: 'UNANIMITY',
              validatorEmails: [validator1Email, validator2Email],
            }],
          }],
        },
      },
    });

    const wf = JSON.parse(launchRes.payload);
    const stepId = wf.phases[0].steps[0].id;

    const v1Login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validator1Email, password: 'testpassword123' },
    });
    const v1Token = JSON.parse(v1Login.payload).accessToken;

    // First action
    await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${stepId}/action`,
      headers: { authorization: `Bearer ${v1Token}` },
      payload: { action: 'APPROVE', comment: 'Yes' },
    });

    // Duplicate action
    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/steps/${stepId}/action`,
      headers: { authorization: `Bearer ${v1Token}` },
      payload: { action: 'APPROVE', comment: 'Yes again' },
    });

    expect(duplicate.statusCode).toBe(409);
  });
});
