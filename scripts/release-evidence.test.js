import { describe, expect, it } from 'vitest';
import {
  automatedGatesPassed,
  buildManualEvidenceRequests,
  buildReleaseDecision,
  parseGithubRepo,
  renderMarkdownEvidence,
  summarizeGithubRun,
  unitTestsPassed,
} from './release-evidence.mjs';

describe('release-evidence', () => {
  it('parses GitHub repository remotes', () => {
    expect(parseGithubRepo('https://github.com/linwoods2031/oca-pc-admin-rebuild.git')).toBe('linwoods2031/oca-pc-admin-rebuild');
    expect(parseGithubRepo('git@github.com:linwoods2031/oca-pc-admin-rebuild.git')).toBe('linwoods2031/oca-pc-admin-rebuild');
  });

  it('selects the verify workflow run for a commit', () => {
    const summary = summarizeGithubRun([
      { workflowName: 'Other', conclusion: 'success', status: 'completed' },
      { workflowName: 'Verify frontend safety gates', conclusion: 'success', status: 'completed', url: 'https://example.test/run' },
    ]);

    expect(summary.workflowName).toBe('Verify frontend safety gates');
    expect(summary.conclusion).toBe('success');
    expect(summary.url).toBe('https://example.test/run');
  });

  it('keeps direct production launch blocked even when automated evidence passes', () => {
    const readiness = {
      automatedGates: {
        readonlyDefault: { status: 'pass' },
        releaseProfile: { status: 'pass' },
        apiBoundary: { status: 'pass' },
        sensitiveScan: { status: 'pass' },
        buildOutput: { status: 'pass' },
        unitTests: 'pass',
      },
      finalGate: { codeCandidate: true },
    };

    const decision = buildReleaseDecision({
      readiness,
      githubActions: { conclusion: 'success' },
    });

    expect(automatedGatesPassed(readiness)).toBe(true);
    expect(unitTestsPassed(readiness)).toBe(true);
    expect(decision.submitFormalReviewCandidate).toBe(true);
    expect(decision.directProductionLaunchAllowed).toBe(false);
    expect(decision.evidenceCompleteness.externalContracts).toBe('required_external_confirmation');
  });

  it('does not treat unknown local unit tests as complete without CI evidence', () => {
    const readiness = {
      automatedGates: {
        readonlyDefault: { status: 'pass' },
        releaseProfile: { status: 'pass' },
        apiBoundary: { status: 'pass' },
        sensitiveScan: { status: 'pass' },
        buildOutput: { status: 'pass' },
        unitTests: 'unknown',
      },
      finalGate: { codeCandidate: true },
    };

    const decision = buildReleaseDecision({
      readiness,
      githubActions: { conclusion: 'unknown' },
    });

    expect(decision.localNonTestGatesPassed).toBe(true);
    expect(decision.localAutomatedGatesPassed).toBe(false);
    expect(decision.submitFormalReviewCandidate).toBe(false);
    expect(decision.evidenceCompleteness.localUnitTests).toBe('required_or_covered_by_ci');
  });

  it('turns manual contracts into evidence requests', () => {
    const requests = buildManualEvidenceRequests({
      requiredManualContracts: [
        {
          name: 'editCheckReport payload compatibility with mini program',
          status: 'required_external_confirmation',
          risk: 'Payload compatibility must be confirmed.',
          blocksDirectLaunch: true,
        },
      ],
    });

    expect(requests[0].ownerRole).toBe('mini_program_owner');
    expect(requests[0].blocksDirectLaunch).toBe(true);
    expect(requests[0].requiredEvidence.join(' ')).toContain('不得包含真实账号');
  });

  it('renders markdown evidence without allowing direct production launch', () => {
    const markdown = renderMarkdownEvidence({
      commit: { sha: 'mock-sha' },
      releaseProfile: { name: 'formal-candidate', classification: 'formal_review_candidate_package' },
      verification: {
        expectedLocalCommand: 'npm run verify',
        githubActions: { workflowName: 'Verify frontend safety gates', conclusion: 'success', url: null },
      },
      confirmedRecoveredContracts: [
        {
          name: 'patient archive ownership fields',
          status: 'confirmed_by_recovered_backend_artifacts',
          scope: 'mock scope',
          residualRisk: 'server parity still needs deployment evidence',
        },
      ],
      decision: {
        githubActionsPassed: true,
        localNonTestGatesPassed: true,
        localUnitTestsStatus: 'pass',
        localAutomatedGatesPassed: true,
        submitFormalReviewCandidate: true,
        readonlyGrayFeasible: true,
        restrictedWriteGrayFeasible: true,
        directProductionLaunchAllowed: false,
      },
      manualEvidenceRequests: [],
    });

    expect(markdown).toContain('Commit: `mock-sha`');
    expect(markdown).toContain('Confirmed Recovered Contracts');
    expect(markdown).toContain('patient archive ownership fields');
    expect(markdown).toContain('Direct production launch allowed: no');
    expect(markdown).toContain('Direct production launch: no');
  });
});
