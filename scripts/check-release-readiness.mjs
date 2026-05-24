import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkApiBoundary } from './check-api-boundary.mjs';
import { checkBuildOutput, checkReleaseProfile } from './check-build-output.mjs';
import { checkSensitive } from './check-sensitive.mjs';
import { createRuntimeConfig } from '../src/config/runtime.js';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function statusFromIssues(issues) {
  return issues.length ? 'fail' : 'pass';
}

function gate(name, issues = []) {
  return { name, status: statusFromIssues(issues), issueCount: issues.length };
}

export const CONFIRMED_RECOVERED_CONTRACTS = [
  {
    name: 'patient archive ownership fields',
    status: 'confirmed_by_recovered_backend_artifacts',
    scope: 'deptId, hospitalId, attendingDoctor for patient create/edit',
    evidence: [
      'Recovered PatientArchiveServiceImpl.addPatient sets missing deptId from SecurityUtils.getDeptId().',
      'Recovered PatientArchiveServiceImpl.addPatient sets missing attendingDoctor from createUser/sys_user.user_id.',
      'Recovered PatientArchiveServiceImpl.addPatient sets hospitalId from LoginUser.getHospital().',
      'Recovered PatientArchiveController resolves doctorName with userService.selectUserById(attendingDoctor).',
      'Accepted mini program shell submits configured dept, hospital, and doctor user ids for patient create/edit.',
    ],
    residualRisk: 'Server artifact parity must still be checked during deployment evidence, but this is no longer an unknown payload contract.',
  },
  {
    name: 'editCheckReport payload compatibility with mini program',
    status: 'confirmed_by_recovered_backend_and_accepted_mini_program_artifacts',
    scope: 'POST /outpatient/check/editCheckReport with { reportId, itemList } question rows and nullable checkItem values',
    evidence: [
      'Accepted mini program shell posts editCheckReport with reportId and itemList.',
      'Accepted mini program shell sends full question rows and leaves unanswered rows as checkItem null.',
      'Recovered OutpatientCheckController.editCheckReport parses itemList as QuestionDto rows, extracts non-null checkItem values, and calls addCheckReport.',
      'Recovered CheckItem fields are questionId, optionId, score, question, and input.',
    ],
    residualRisk: 'Unsupported future question types still require a new contract before enabling; current PC payload code handles radio rows and text input rows only.',
  },
  {
    name: 'submitted state fields',
    status: 'confirmed_by_recovered_backend_and_accepted_mini_program_artifacts',
    scope: 'OutpatientCheck.state and OutpatientCheckReport.state',
    evidence: [
      'Recovered OutpatientCheck uses state 0 for in-progress assessments and state 1 for submitted assessments.',
      'Recovered OutpatientCheckReport uses state 0 for unstarted, state 1 for saved, and state 2 for submitted table reports.',
      'Recovered submitCheck sets the assessment state to 1 and report states to 2.',
      'Accepted mini program shell treats table report state 2 as completed/read-only and requires all table report states to be saved before submit.',
    ],
    residualRisk: 'reportState/status/finishState remain defensive PC-side aliases for unknown wrappers, but recovered canonical backend fields are state values.',
  },
  {
    name: 'patient base and medication storage scope',
    status: 'confirmed_by_recovered_backend_and_accepted_mini_program_artifacts',
    scope: 'Patient base is patient-scoped; medication rows are keyed to the patient base record and replaced when msList is present',
    evidence: [
      'Recovered PatientBaseDao.findByPatient selects oca_patient_base by patient_id.',
      'Recovered PatientBaseServiceImpl.add/update uses outpatientId and tableId only to mark the matching base report saved.',
      'Recovered MedicationSituation rows are keyed by patient base id, and update deletes then recreates medication rows when msList is present.',
      'Accepted mini program shell calls getBaseForm(patientId), getBaseMedications(patientId), and omits empty msList.',
    ],
    residualRisk: 'This confirms the storage scope but also confirms base/medication writes are shared at patient/base level; broader write rollout needs explicit release-owner approval.',
  },
];

export const REQUIRED_MANUAL_CONTRACTS = [
  {
    name: 'patient-scoped base write rollout approval',
    status: 'required_external_approval',
    blocksDirectLaunch: true,
    risk: 'Recovered artifacts confirm base and medication data are patient/base-scoped, not per-assessment; release owner must approve whether PC may edit those shared records beyond allow-list gray verification.',
  },
  {
    name: 'server artifact parity for recovered contracts',
    status: 'required_deployment_evidence',
    blocksDirectLaunch: true,
    risk: 'The release package and running server code must be shown to match the recovered backend artifacts used for these contract confirmations.',
  },
];

export function buildReleaseReadinessReport({ root = process.cwd(), env = process.env } = {}) {
  const apiBoundaryIssues = checkApiBoundary({ root });
  const sensitiveIssues = checkSensitive({ root });
  const releaseProfile = checkReleaseProfile(env);
  const buildOutput = checkBuildOutput({ root, env });
  const defaultRuntime = createRuntimeConfig({});
  const readonlyDefaultIssues = defaultRuntime.isReadOnlyMode && !defaultRuntime.isWriteEnabled ? [] : [{ rule: 'readonly-default' }];
  const unitTests = env.VERIFY_UNIT_TESTS_STATUS || env.UNIT_TESTS_STATUS || 'unknown';
  const automatedGates = {
    readonlyDefault: gate('readonlyDefault', readonlyDefaultIssues),
    releaseProfile: gate('releaseProfile', releaseProfile.issues),
    apiBoundary: gate('apiBoundary', apiBoundaryIssues),
    sensitiveScan: gate('sensitiveScan', sensitiveIssues),
    buildOutput: gate('buildOutput', buildOutput.issues),
    unitTests,
  };
  const automatedPass = Object.entries(automatedGates)
    .filter(([, value]) => typeof value === 'object' && value?.status)
    .every(([, value]) => value.status === 'pass');

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: {
      sha: git(['rev-parse', 'HEAD']),
      shortSha: git(['rev-parse', '--short', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: Boolean(git(['status', '--short'])),
    },
    releaseProfile: {
      name: releaseProfile.releaseProfile,
      writesRequested: releaseProfile.writesRequested,
      readonlyOverride: releaseProfile.readonlyOverride,
      classification: releaseProfile.releaseProfile === 'restricted-write-gray'
        ? 'restricted_write_gray_package'
        : releaseProfile.releaseProfile === 'readonly-gray'
          ? 'readonly_gray_package'
          : 'formal_review_candidate_package',
      formalCandidateRequiresReadonly: releaseProfile.releaseProfile === 'formal-candidate',
      notes: releaseProfile.releaseProfile === 'restricted-write-gray'
        ? 'This package may be used only for separately approved allow-list write gray verification; it is not a formal review candidate package.'
        : releaseProfile.releaseProfile === 'readonly-gray'
          ? 'This package may be used for readonly gray verification; it is not the default formal review candidate package.'
          : 'This package is expected to remain readonly by default and may be considered by automated gates as a formal review candidate only when all gates pass.',
    },
    automatedGates,
    confirmedRecoveredContracts: CONFIRMED_RECOVERED_CONTRACTS,
    requiredManualContracts: REQUIRED_MANUAL_CONTRACTS,
    productionActionsExecuted: false,
    realWriteApiCalled: false,
    deploymentExecuted: false,
    finalGate: {
      codeCandidate: automatedPass && releaseProfile.releaseProfile === 'formal-candidate',
      readonlyGrayCandidate: automatedPass && releaseProfile.releaseProfile === 'readonly-gray',
      restrictedWriteGrayCandidate: automatedPass && releaseProfile.releaseProfile === 'restricted-write-gray',
      directProductionLaunchAllowed: false,
      reason: !automatedPass
        ? 'One or more automated source gates failed.'
        : releaseProfile.releaseProfile === 'formal-candidate'
          ? 'Automated source gates passed for the default readonly formal review candidate package; direct production launch still requires external approval and contract confirmation.'
          : 'Automated gates passed for a gray package classification, but it is not a formal review candidate package and cannot be used for direct production launch.',
    },
  };
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const report = buildReleaseReadinessReport();
  console.log(JSON.stringify(report, null, 2));
  const failed = Object.values(report.automatedGates).some((value) => typeof value === 'object' && value?.status === 'fail');
  if (failed) process.exit(1);
}
