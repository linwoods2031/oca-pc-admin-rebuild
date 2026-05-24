import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReleaseReadinessReport } from './check-release-readiness.mjs';

const VERIFY_WORKFLOW_NAME = 'Verify frontend safety gates';

function execText(command, args, { root = process.cwd(), timeout = 8000 } = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    }).trim();
  } catch {
    return null;
  }
}

function git(args, root) {
  return execText('git', args, { root });
}

export function parseGithubRepo(remoteUrl) {
  if (!remoteUrl) return null;
  const httpsMatch = remoteUrl.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!httpsMatch) return null;
  return `${httpsMatch[1]}/${httpsMatch[2]}`;
}

export function summarizeGithubRun(runs, workflowName = VERIFY_WORKFLOW_NAME) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return {
      source: 'gh',
      status: 'unknown',
      conclusion: 'unknown',
      workflowName,
      reason: 'No GitHub Actions run was found for this commit.',
    };
  }

  const run = runs.find((candidate) => candidate.workflowName === workflowName) || runs[0];
  return {
    source: 'gh',
    status: run.status || 'unknown',
    conclusion: run.conclusion || 'unknown',
    workflowName: run.workflowName || workflowName,
    displayTitle: run.displayTitle || null,
    url: run.url || null,
    createdAt: run.createdAt || null,
    updatedAt: run.updatedAt || null,
  };
}

function githubRunEvidence({ root, sha, includeGithub }) {
  if (!includeGithub) {
    return {
      source: 'not_requested',
      status: 'unknown',
      conclusion: 'unknown',
      workflowName: VERIFY_WORKFLOW_NAME,
      reason: 'Run with --include-github to query GitHub Actions through gh.',
    };
  }

  const remote = git(['remote', 'get-url', 'origin'], root);
  const repo = parseGithubRepo(remote);
  if (!repo) {
    return {
      source: 'unavailable',
      status: 'unknown',
      conclusion: 'unknown',
      workflowName: VERIFY_WORKFLOW_NAME,
      reason: 'origin remote is not a GitHub repository URL.',
    };
  }

  const output = execText('gh', [
    'run',
    'list',
    '--repo',
    repo,
    '--commit',
    sha,
    '--limit',
    '10',
    '--json',
    'status,conclusion,headSha,displayTitle,workflowName,url,createdAt,updatedAt',
  ], { root });

  if (!output) {
    return {
      source: 'unavailable',
      status: 'unknown',
      conclusion: 'unknown',
      workflowName: VERIFY_WORKFLOW_NAME,
      reason: 'gh was unavailable, unauthenticated, or could not query this repository.',
    };
  }

  try {
    return summarizeGithubRun(JSON.parse(output));
  } catch {
    return {
      source: 'unavailable',
      status: 'unknown',
      conclusion: 'unknown',
      workflowName: VERIFY_WORKFLOW_NAME,
      reason: 'gh returned an unreadable response.',
    };
  }
}

function objectGates(automatedGates) {
  return Object.values(automatedGates).filter((gate) => typeof gate === 'object' && gate?.status);
}

export function automatedGatesPassed(readiness) {
  return objectGates(readiness.automatedGates).every((gate) => gate.status === 'pass');
}

export function unitTestsPassed(readiness) {
  return readiness.automatedGates?.unitTests === 'pass';
}

export function buildReleaseDecision({ readiness, githubActions }) {
  const localGatePass = automatedGatesPassed(readiness);
  const localAutomatedPass = localGatePass && unitTestsPassed(readiness);
  const githubStatus = githubActions?.conclusion || 'unknown';
  const githubPass = githubStatus === 'success';
  const automatedEvidencePass = localAutomatedPass || githubPass;

  return {
    localNonTestGatesPassed: localGatePass,
    localAutomatedGatesPassed: localAutomatedPass,
    localUnitTestsStatus: readiness.automatedGates?.unitTests || 'unknown',
    githubActionsPassed: githubPass,
    githubActionsStatus: githubStatus,
    submitFormalReviewCandidate: Boolean(readiness.finalGate.codeCandidate && automatedEvidencePass),
    readonlyGrayFeasible: automatedEvidencePass,
    restrictedWriteGrayFeasible: automatedEvidencePass,
    directProductionLaunchAllowed: false,
    evidenceCompleteness: {
      automatedSourceGates: automatedEvidencePass ? 'complete' : 'blocked',
      localUnitTests: unitTestsPassed(readiness) ? 'complete' : 'required_or_covered_by_ci',
      githubActions: githubPass ? 'complete' : 'required_or_attach_external_ci_result',
      externalContracts: 'required_external_confirmation',
      productionApproval: 'required_external_approval',
    },
  };
}

export function buildManualEvidenceRequests(readiness) {
  return readiness.requiredManualContracts.map((contract) => ({
    name: contract.name,
    status: contract.status,
    ownerRole: contract.name.includes('mini program') ? 'mini_program_owner' : 'backend_or_release_owner',
    requiredEvidence: [
      '负责人确认记录或评审单条目',
      '脱敏截图或文档摘要',
      '不得包含真实账号、真实患者信息或真实 allow-list id',
    ],
    risk: contract.risk,
    blocksDirectLaunch: contract.blocksDirectLaunch,
  }));
}

export function buildReleaseEvidence({ root = process.cwd(), env = process.env, includeGithub = false } = {}) {
  const readiness = buildReleaseReadinessReport({ root, env });
  const githubActions = githubRunEvidence({
    root,
    sha: readiness.commit.sha,
    includeGithub,
  });
  const decision = buildReleaseDecision({ readiness, githubActions });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: {
      origin: git(['remote', 'get-url', 'origin'], root),
      github: parseGithubRepo(git(['remote', 'get-url', 'origin'], root)),
    },
    commit: readiness.commit,
    releaseProfile: readiness.releaseProfile,
    verification: {
      expectedLocalCommand: 'npm run verify',
      readinessAutomatedGates: readiness.automatedGates,
      githubActions,
    },
    safetyAssertions: {
      productionActionsExecuted: false,
      realWriteApiCalled: false,
      deploymentExecuted: false,
      generatedByCodexWithoutProductionAccess: true,
    },
    manualEvidenceRequests: buildManualEvidenceRequests(readiness),
    decision,
    finalGate: readiness.finalGate,
  };
}

function statusIcon(value) {
  if (value === true || value === 'success' || value === 'complete') return 'PASS';
  if (value === false || value === 'blocked' || value === 'failure') return 'FAIL';
  return 'PENDING';
}

export function renderMarkdownEvidence(evidence) {
  const lines = [
    '# Release Evidence Pack',
    '',
    `Commit: \`${evidence.commit.sha || 'unknown'}\``,
    `Release profile: \`${evidence.releaseProfile.name}\` (${evidence.releaseProfile.classification})`,
    `GitHub Actions: ${statusIcon(evidence.decision.githubActionsPassed)} ${evidence.verification.githubActions.workflowName} / ${evidence.verification.githubActions.conclusion}`,
    '',
    '## Automated Evidence',
    '',
    `- Local command expected: \`${evidence.verification.expectedLocalCommand}\``,
    `- Local non-test gates: ${statusIcon(evidence.decision.localNonTestGatesPassed)}`,
    `- Local unit tests: ${evidence.decision.localUnitTestsStatus}`,
    `- Complete automated evidence: ${statusIcon(evidence.decision.localAutomatedGatesPassed || evidence.decision.githubActionsPassed)}`,
    `- Formal review candidate: ${evidence.decision.submitFormalReviewCandidate ? 'yes' : 'no'}`,
    `- Direct production launch allowed: ${evidence.decision.directProductionLaunchAllowed ? 'yes' : 'no'}`,
    '',
    '## Required External Evidence',
    '',
    ...evidence.manualEvidenceRequests.flatMap((item) => [
      `- ${item.name}: ${item.status}`,
      `  Owner role: ${item.ownerRole}`,
      `  Risk: ${item.risk}`,
    ]),
    '',
    '## Release Decision',
    '',
    `- Readonly gray feasible: ${evidence.decision.readonlyGrayFeasible ? 'yes' : 'no'}`,
    `- Restricted write gray feasible: ${evidence.decision.restrictedWriteGrayFeasible ? 'yes, with separate allow-list evidence' : 'no'}`,
    '- Direct production launch: no',
  ];

  if (evidence.verification.githubActions.url) {
    lines.splice(4, 0, `GitHub Actions URL: ${evidence.verification.githubActions.url}`);
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  return {
    markdown: argv.includes('--markdown'),
    includeGithub: argv.includes('--include-github'),
  };
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const evidence = buildReleaseEvidence({ includeGithub: args.includeGithub });
  if (args.markdown) {
    console.log(renderMarkdownEvidence(evidence));
  } else {
    console.log(JSON.stringify(evidence, null, 2));
  }

  if (evidence.decision.evidenceCompleteness.automatedSourceGates !== 'complete') process.exit(1);
}
