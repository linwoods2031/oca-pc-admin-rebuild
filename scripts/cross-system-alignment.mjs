import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_MINI_MAINTENANCE_DIR = path.join(os.homedir(), 'codex', '老年评估', '2026-04-20-小程序维护');
const DEFAULT_MINI_SHELL_DIR = path.join(os.homedir(), 'codex', 'oca-miniprogram-shell');

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function sameFileContent(a, b) {
  if (!fileExists(a) || !fileExists(b)) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

function comparePreviewVersions(a, b) {
  const left = a.split('.').map((part) => Number(part));
  const right = b.split('.').map((part) => Number(part));
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function findLatestPreviewArtifact(miniMaintenanceDir) {
  const artifactsDir = path.join(miniMaintenanceDir, 'artifacts');
  let files;
  try {
    files = fs.readdirSync(artifactsDir);
  } catch {
    return null;
  }

  return files
    .map((file) => {
      const match = /^oca-preview-qrcode-(\d+\.\d+\.\d+)\.jpg$/.exec(file);
      return match ? { file, version: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => comparePreviewVersions(b.version, a.version))[0] || null;
}

function missingTerms(content, terms) {
  if (content === null) return terms;
  return terms.filter((term) => !content.includes(term));
}

function checkTextFile({ base, file, terms, name, evidence = [] }) {
  const fullPath = path.join(base, file);
  const content = readText(fullPath);
  if (content === null) {
    return {
      name,
      status: 'unknown',
      file,
      evidence,
      missing: [`missing file: ${file}`],
    };
  }

  const missing = missingTerms(content, terms);
  return {
    name,
    status: missing.length ? 'fail' : 'pass',
    file,
    evidence: [...evidence, file],
    missing,
  };
}

function summarizeChecks(checks) {
  return {
    pass: checks.filter((check) => check.status === 'pass').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    unknown: checks.filter((check) => check.status === 'unknown').length,
    requiredExternalEvidence: checks.filter((check) => check.status === 'required_external_evidence').length,
    requiredExternalAction: checks.filter((check) => check.status === 'required_external_action').length,
  };
}

function compactExternalPath(file) {
  return file.split(path.sep).slice(-3).join('/');
}

function buildPcChecks(root) {
  return [
    checkTextFile({
      base: root,
      file: 'src/config/runtime.js',
      name: 'PC runtime keeps base and medication writes disabled',
      terms: ['baseWriteDisabledMessage', 'isBaseWriteEnabled: false', 'assertBaseWriteAllowed'],
      evidence: ['Runtime config exposes base readonly message and a fail-closed base write guard.'],
    }),
    checkTextFile({
      base: root,
      file: 'src/api/oca.js',
      name: 'PC API wrapper blocks base create and update calls',
      terms: ['assertBaseWriteAllowed();', 'export function addBase', 'export function updateBase'],
      evidence: ['Base API wrappers call the runtime base write guard before any request can be made.'],
    }),
    checkTextFile({
      base: root,
      file: 'src/views/PatientDetailView.vue',
      name: 'PC detail page renders base and medication controls readonly',
      terms: ['baseReadonly', ':disabled="baseReadonly"', 'function saveBaseForm()', 'baseWriteDisabledMessage'],
      evidence: ['The detail view disables base fields and current medication controls through the same readonly computed state.'],
    }),
    checkTextFile({
      base: root,
      file: 'docs/mini-program-final-requirements.md',
      name: 'PC docs defer scale names and conclusions to backend and accepted mini-program requirements',
      terms: ['小程序最终口径对齐清单', 'PC 后台不单独定义上述量表评分和结论规则', '以后端返回的量表名称、分值和结论为准'],
      evidence: ['The PC release docs record the final mini-program scale requirements as the cross-system source of truth.'],
    }),
    checkTextFile({
      base: root,
      file: 'docs/recovered-contracts.md',
      name: 'Recovered contracts record user decision for PC base and medication readonly',
      terms: ['PC 后台正式使用时不允许修改一般情况表和当前用药', '用药修改在平板端完成', '因 PC 不开放一般情况表和当前用药保存'],
      evidence: ['Recovered contracts separate the storage-scope confirmation from the PC rollout decision.'],
    }),
  ];
}

function buildMiniOpsChecks(miniMaintenanceDir) {
  if (!fs.existsSync(miniMaintenanceDir)) {
    return [
      {
        name: 'Mini-program maintenance workspace is available for local evidence scan',
        status: 'unknown',
        file: compactExternalPath(miniMaintenanceDir),
        evidence: [],
        missing: ['Set OCA_MINI_MAINTENANCE_DIR to the recovered mini-program maintenance workspace.'],
      },
    ];
  }

  const latestPreview = findLatestPreviewArtifact(miniMaintenanceDir);
  const previewFile = latestPreview?.file || 'oca-preview-qrcode-<latest>.jpg';
  const previewVersion = latestPreview?.version || '<latest>';
  const preview = path.join(miniMaintenanceDir, 'artifacts', previewFile);
  const latest = path.join(miniMaintenanceDir, 'artifacts', 'oca-preview-qrcode-latest.jpg');
  const formalQr = path.join(miniMaintenanceDir, 'artifacts', 'miniprogram-formal-qrcode-current.png');
  const artifactMissing = [
    !latestPreview ? 'missing versioned preview QR artifact: oca-preview-qrcode-<version>.jpg' : null,
    latestPreview && !fileExists(preview) ? `missing preview QR artifact: ${previewFile}` : null,
    !fileExists(latest) ? 'missing latest preview QR alias: oca-preview-qrcode-latest.jpg' : null,
    fileExists(preview) && fileExists(latest) && !sameFileContent(preview, latest)
      ? `latest preview QR alias does not match ${previewVersion} artifact`
      : null,
    !fileExists(formalQr) ? 'missing current formal QR artifact marker' : null,
  ].filter(Boolean);

  return [
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'OPERATIONS.md',
      name: 'Operations log records latest accepted preview and old formal QR separation',
      terms: [previewVersion, '当前正式长期二维码仍是旧正式包', '住院号搜索', '修改患者', '上次得分', '上次结论', '预计复诊日期'],
      evidence: ['The operations log separates the latest accepted preview evidence from the still-old formal QR.'],
    }),
    {
      name: 'Latest mini-program preview QR artifact is present and aliased',
      status: artifactMissing.length ? 'fail' : 'pass',
      file: `artifacts/${previewFile}`,
      evidence: [
        `artifacts/${previewFile}`,
        'artifacts/oca-preview-qrcode-latest.jpg',
        'artifacts/miniprogram-formal-qrcode-current.png',
      ],
      missing: artifactMissing,
      note: 'The formal QR artifact is intentionally only evidence of the current formal channel, not proof that the latest preview has been formally published.',
    },
    {
      name: 'WeChat formal release and long-term QR switch still need release-owner action',
      status: 'required_external_action',
      file: 'WeChat official release console',
      evidence: ['The local evidence shows the accepted preview artifact; official formal publish is outside this source repository.'],
      missing: [],
    },
  ];
}

function buildMiniShellChecks(miniShellDir) {
  if (!fs.existsSync(miniShellDir)) {
    return [
      {
        name: 'Mini-program shell workspace is available for final UI evidence scan',
        status: 'unknown',
        file: compactExternalPath(miniShellDir),
        evidence: [],
        missing: ['Set OCA_MINI_SHELL_DIR to the accepted mini-program shell workspace.'],
      },
    ];
  }

  return [
    checkTextFile({
      base: miniShellDir,
      file: 'pages/assessment/create/index.js',
      name: 'Mini-program scale cards use final accepted names and summaries',
      terms: ['简易智力状况检查表（MMSE）', 'MMSE 33 分量表', 'Zung氏焦虑自评量表（SAS）', '衰弱评定量表（FRIED）', '老年人跌倒风险评估表（FRA）'],
      evidence: ['Mini-program create-assessment cards expose the accepted scale labels.'],
    }),
    checkTextFile({
      base: miniShellDir,
      file: 'pages/assessment/create/index.wxml',
      name: 'Mini-program assessment create page supports select-all and clear',
      terms: ['全选', '清空'],
      evidence: ['The accepted mini-program shell contains the table selection controls requested in the final round.'],
    }),
    checkTextFile({
      base: miniShellDir,
      file: 'pages/assessment/menu/index.wxml',
      name: 'Mini-program assessment menu shows previous score, conclusion, and follow-up date',
      terms: ['上次得分', '上次结论', '预计复诊日期'],
      evidence: ['The accepted mini-program shell exposes the final comparison and follow-up fields.'],
    }),
    checkTextFile({
      base: miniShellDir,
      file: 'pages/patient/list/index.wxml',
      name: 'Mini-program patient list supports inpatient number search',
      terms: ['住院号', '输入住院号搜索'],
      evidence: ['The accepted mini-program shell includes the final patient search field.'],
    }),
    checkTextFile({
      base: miniShellDir,
      file: 'pages/patient/form/index.wxml',
      name: 'Mini-program patient form supports edit-patient wording and inpatient number',
      terms: ['修改患者', '住院号'],
      evidence: ['The accepted mini-program shell includes the edit-patient entry wording and inpatient number field.'],
    }),
    checkTextFile({
      base: miniShellDir,
      file: 'pages/assessment/base/index.wxml',
      name: 'Mini-program base form includes final added foundation fields',
      terms: ['居住楼层', '电梯房', '跌倒史', '义齿'],
      evidence: ['The accepted mini-program shell contains the final foundation fields requested by the user.'],
    }),
  ];
}

function buildBackendSqlChecks(miniMaintenanceDir) {
  if (!fs.existsSync(miniMaintenanceDir)) {
    return [];
  }

  return [
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-04-30-feedback-fixes.sql',
      name: 'SQL hotfix aligns SAS, MMSE, TCM, FRIED, and FRA final content',
      terms: ['Zung氏焦虑自评量表（SAS）', '简易智力状况检查表（MMSE）', '33 分', '限女性', '限男性', '握力', '步速', '用药史'],
      evidence: ['The recovered SQL hotfix records the final scale-name and question-content fixes.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-05-15-feedback-rules-format.sql',
      name: 'SQL hotfix aligns ADL, AIS, SPPB, MMSE summary, and FRIED display',
      terms: ['ADL', 'AIS', 'SPPB', 'MMSE 33 分量表', '握力', '步速'],
      evidence: ['The recovered SQL hotfix records the final scoring and display wording updates.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-05-16-fried-short-lines.sql',
      name: 'SQL hotfix keeps FRIED grip and walking-speed thresholds readable',
      terms: ['FRIED', 'BMI', '握力', '步速减慢'],
      evidence: ['The recovered SQL hotfix records the final FRIED short-line presentation.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-05-16-mmse-degree-question.sql',
      name: 'SQL hotfix records MMSE degree question and 33-point summary',
      terms: ['文化程度', '33 分', '文盲', '小学', '中学及以上'],
      evidence: ['The recovered SQL hotfix records the final MMSE degree question used for conclusion rules.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-05-17-adl-estimate-rule.sql',
      name: 'SQL hotfix records final ADL conclusion rule',
      terms: ['ADL 能自理', '轻度功能缺陷', '中度功能缺陷', '严重功能缺陷', '极严重功能缺陷'],
      evidence: ['The recovered SQL hotfix records the final ADL conclusion wording.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'db-hotfix/2026-05-20-iadl-option-scores.sql',
      name: 'SQL hotfix records final IADL option scoring correction',
      terms: ['IADL', 'option_score = 0', 'option_score = 1'],
      evidence: ['The recovered SQL hotfix records the final IADL 0/1 option scoring update.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'backend-hotfix-src/com/qihao/udp/oca/web/controller/business/OutpatientCheckController.java',
      name: 'Recovered backend controller sorts ADL/IADL/FRA and filters sex-specific questions',
      terms: ['FEMALE_ONLY_MARKERS', 'MALE_ONLY_MARKERS', 'ADL_TABLE_ID', 'IADL_TABLE_ID', 'FRA_TABLE_ID', 'sortQuestionsById'],
      evidence: ['The recovered backend controller contains final ordering and sex-filtering logic.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'backend-hotfix-src/com/qihao/udp/oca/business/score/MMSEScoreComputer.java',
      name: 'Recovered backend scorer requires MMSE degree answer for conclusion rules',
      terms: ['MMSE', '文化程度', 'ServiceException'],
      evidence: ['The recovered backend scorer contains the final MMSE conclusion input requirement.'],
    }),
    checkTextFile({
      base: miniMaintenanceDir,
      file: 'backend-hotfix-src/com/qihao/udp/oca/business/score/TcmCorporeityComputer.java',
      name: 'Recovered backend scorer handles TCM sex-specific markers',
      terms: ['FEMALE_ONLY_MARKERS', 'MALE_ONLY_MARKERS', '湿热质'],
      evidence: ['The recovered backend scorer contains the final TCM sex-specific marker handling.'],
    }),
  ];
}

function buildRequiredExternalChecks() {
  return [
    {
      name: 'Server artifact parity for recovered backend and SQL contracts',
      status: 'required_external_evidence',
      file: 'release-owner evidence',
      evidence: ['Release owner must confirm the running backend package and database migrations match the recovered artifacts used by this report.'],
      missing: [],
    },
    {
      name: 'Production backup, rollback, audit, and permission evidence',
      status: 'required_external_evidence',
      file: 'release-owner evidence',
      evidence: ['Release owner must attach backup, rollback, audit, permission, and change-window evidence before formal production launch.'],
      missing: [],
    },
  ];
}

export function buildCrossSystemAlignmentReport({
  root = process.cwd(),
  miniMaintenanceDir = process.env.OCA_MINI_MAINTENANCE_DIR || DEFAULT_MINI_MAINTENANCE_DIR,
  miniShellDir = process.env.OCA_MINI_SHELL_DIR || DEFAULT_MINI_SHELL_DIR,
} = {}) {
  const sections = {
    pcFrontend: buildPcChecks(root),
    miniProgramOperations: buildMiniOpsChecks(miniMaintenanceDir),
    miniProgramShell: buildMiniShellChecks(miniShellDir),
    recoveredBackendAndSql: buildBackendSqlChecks(miniMaintenanceDir),
    requiredExternalEvidence: buildRequiredExternalChecks(),
  };
  const allChecks = Object.values(sections).flat();
  const sourceChecks = allChecks.filter((check) => !check.status.startsWith('required_external'));
  const summary = summarizeChecks(allChecks);
  const sourceSummary = summarizeChecks(sourceChecks);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'PC admin release candidate, accepted mini-program shell, and recovered backend/SQL alignment evidence',
    inputs: {
      pcRepositoryRoot: '<pc-repository-root>',
      miniMaintenanceDir: '<mini-maintenance-dir>',
      miniShellDir: '<mini-shell-dir>',
      localPathsRedacted: true,
    },
    sections,
    summary,
    finalGate: {
      localCrossSystemAlignmentCandidate: sourceSummary.fail === 0 && sourceSummary.unknown === 0,
      directProductionLaunchAllowed: false,
      reason: sourceSummary.fail > 0
        ? 'One or more local cross-system evidence checks failed.'
        : sourceSummary.unknown > 0
          ? 'Some local cross-system evidence could not be scanned; provide the missing workspace paths or attach external evidence.'
          : 'Local source and recovered-artifact alignment checks passed. Formal production launch still requires release-owner evidence and approval.',
    },
  };
}

function statusIcon(status) {
  if (status === 'pass' || status === true) return 'PASS';
  if (status === 'fail' || status === false) return 'FAIL';
  if (status === 'unknown') return 'UNKNOWN';
  return 'REQUIRED';
}

function renderCheck(check) {
  const lines = [
    `- ${statusIcon(check.status)} ${check.name}`,
    `  Status: ${check.status}`,
    `  Evidence: ${check.evidence.length ? check.evidence.join('; ') : 'not available'}`,
  ];
  if (check.missing?.length) lines.push(`  Missing: ${check.missing.join('; ')}`);
  if (check.note) lines.push(`  Note: ${check.note}`);
  return lines;
}

export function renderMarkdownAlignment(report) {
  const sectionTitles = {
    pcFrontend: 'PC Frontend Evidence',
    miniProgramOperations: 'Mini-Program Operations Evidence',
    miniProgramShell: 'Mini-Program Shell Evidence',
    recoveredBackendAndSql: 'Recovered Backend And SQL Evidence',
    requiredExternalEvidence: 'Required External Evidence',
  };
  const lines = [
    '# Cross-System Alignment Report',
    '',
    `Scope: ${report.scope}`,
    `Local alignment candidate: ${report.finalGate.localCrossSystemAlignmentCandidate ? 'yes' : 'no'}`,
    `Direct production launch allowed: ${report.finalGate.directProductionLaunchAllowed ? 'yes' : 'no'}`,
    `Reason: ${report.finalGate.reason}`,
    '',
    '## Summary',
    '',
    `- Pass: ${report.summary.pass}`,
    `- Fail: ${report.summary.fail}`,
    `- Unknown: ${report.summary.unknown}`,
    `- Required external evidence: ${report.summary.requiredExternalEvidence}`,
    `- Required external action: ${report.summary.requiredExternalAction}`,
    '',
  ];

  for (const [key, checks] of Object.entries(report.sections)) {
    lines.push(`## ${sectionTitles[key] || key}`, '');
    for (const check of checks) lines.push(...renderCheck(check));
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  return {
    markdown: argv.includes('--markdown'),
    requireLocalArtifacts: argv.includes('--require-local-artifacts'),
  };
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildCrossSystemAlignmentReport();
  if (args.markdown) {
    console.log(renderMarkdownAlignment(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (report.summary.fail > 0) process.exit(1);
  if (args.requireLocalArtifacts && report.summary.unknown > 0) process.exit(1);
}
