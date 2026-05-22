<template>
  <section v-loading="loading">
    <div class="panel" style="margin-bottom: 18px">
      <div class="detail-actions">
        <el-button link @click="$router.back()">返回</el-button>
        <div>
          <el-button @click="openBase(checks[0] || {})">一般情况表</el-button>
          <el-tooltip :disabled="!isReadOnlyMode" :content="writeDisabledMessage" placement="top">
            <span>
              <el-button type="primary" :disabled="isReadOnlyMode" @click="$router.push(`/patients/${props.id}/edit`)">编辑患者</el-button>
            </span>
          </el-tooltip>
        </div>
      </div>
      <div class="metric-grid" style="margin-top: 14px">
        <div class="metric"><span>姓名</span><b>{{ valueText(patient.name) }}</b></div>
        <div class="metric"><span>性别/年龄</span><b>{{ sexText(patient.sex) }} / {{ valueText(patient.age) }}</b></div>
        <div class="metric"><span>门诊号</span><b>{{ valueText(patient.patientNumber) }}</b></div>
        <div class="metric"><span>住院号</span><b>{{ valueText(patient.admissionNumber) }}</b></div>
      </div>
      <el-descriptions :column="4" border>
        <el-descriptions-item label="身份证号">{{ valueText(patient.idNumber) }}</el-descriptions-item>
        <el-descriptions-item label="生日">{{ dateText(patient.birthday) }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ valueText(patient.phone) }}</el-descriptions-item>
        <el-descriptions-item label="家庭住址">{{ valueText(patient.homeAddress) }}</el-descriptions-item>
        <el-descriptions-item label="病房号">{{ valueText(patient.sickroomNumber) }}</el-descriptions-item>
        <el-descriptions-item label="病床号">{{ valueText(patient.sickbedNumber) }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ valueText(patient.deptName) }}</el-descriptions-item>
        <el-descriptions-item label="医生">{{ valueText(patient.doctorName) }}</el-descriptions-item>
        <el-descriptions-item label="预计复诊">{{ dateText(patient.nextVisitDate) }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="panel">
      <h2 style="margin-top: 0">评估记录</h2>
      <el-table :data="checks" stripe>
        <el-table-column label="评估日期" min-width="150">
          <template #default="{ row }">{{ dateText(row.visitDate || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ Number(row.state) === 1 ? '已提交' : '进行中' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="320">
          <template #default="{ row }">
            <el-button type="primary" link @click="openBase(row)">一般情况表</el-button>
            <el-button type="primary" link @click="openAssessment(row)">查看量表结果</el-button>
            <el-button type="warning" link @click="openCompositePreview(row)">总报告预览</el-button>
            <el-button type="success" link @click="print(row)">总报告打印</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="assessmentOpen" title="量表结果" width="1040px">
      <el-table v-loading="assessmentLoading" :data="tables" stripe max-height="520">
        <el-table-column prop="tableName" label="量表名称" min-width="230" />
        <el-table-column prop="scoreText" label="得分" width="90" />
        <el-table-column prop="remarkText" label="结论" min-width="180" />
        <el-table-column prop="exScoreText" label="上次得分" width="100" />
        <el-table-column prop="exRemarkText" label="上次结论" min-width="160" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openReport(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="reportOpen" :title="reportTitle" width="980px">
      <section v-loading="reportLoading" class="question-editor">
        <el-alert
          v-if="reportSaveDisabled"
          :title="reportDisabledReason"
          type="info"
          :closable="false"
          style="margin-bottom: 12px"
        />
        <div v-for="row in reportRows" :key="row.id" class="question-row">
          <div v-if="row.showGroup" class="question-group">{{ row.groupName }}</div>
          <div class="question-title">{{ row.order }}. {{ row.displayContent || row.content || row.question || '-' }}</div>
          <el-radio-group
            v-if="Number(row.type) === 0"
            v-model="row.selectedOptionId"
            :disabled="reportSaveDisabled"
            class="question-options"
          >
            <el-radio v-for="option in row.options || []" :key="option.id" :value="option.id" border>
              {{ option.optionText }}
              <span class="subtle">（{{ option.optionScore ?? option.score ?? 0 }}分）</span>
            </el-radio>
          </el-radio-group>
          <el-input
            v-else-if="Number(row.type) === 2"
            v-model.trim="row.inputValue"
            :disabled="reportSaveDisabled"
            placeholder="请输入"
          />
          <el-input
            v-else
            v-model.trim="row.inputValue"
            :disabled="reportSaveDisabled"
            type="textarea"
            :rows="3"
            placeholder="请输入"
          />
          <div class="subtle question-score">当前分值：{{ scoreText(row) }}</div>
        </div>
      </section>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reportOpen = false">关闭</el-button>
          <el-button type="primary" :disabled="reportSaveDisabled" :loading="reportSaving" @click="saveReport">保存量表</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="baseOpen" title="一般情况调查表" width="1120px">
      <section v-loading="baseLoading">
        <el-alert
          v-if="baseSaveDisabled"
          type="warning"
          :closable="false"
          :title="baseDisabledReason"
          style="margin-bottom: 12px"
        />
        <el-descriptions :column="4" border style="margin-bottom: 18px">
          <el-descriptions-item label="姓名">{{ valueText(patient.name) }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ sexText(patient.sex) }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ valueText(patient.age) }}</el-descriptions-item>
          <el-descriptions-item label="门诊号">{{ valueText(patient.patientNumber) }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-position="top" class="base-form" :model="baseForm" :disabled="baseReadonly">
          <el-form-item label="籍贯"><el-input v-model.trim="baseForm.nativePlace" /></el-form-item>
          <el-form-item label="医保类型"><dict-select v-model="baseForm.medicalInsuranceType" :options="dicts.medicalInsuranceType" /></el-form-item>
          <el-form-item label="文化程度"><dict-select v-model="baseForm.degree" :options="dicts.degree" /></el-form-item>
          <el-form-item label="目前工作"><dict-select v-model="baseForm.careerStatus" :options="dicts.careerStatus" /></el-form-item>
          <el-form-item label="吸烟情况"><el-input v-model.trim="baseForm.smokingHistory" /></el-form-item>
          <el-form-item label="饮酒情况"><el-input v-model.trim="baseForm.drinkingHistory" /></el-form-item>
          <el-form-item label="婚姻状态"><dict-select v-model="baseForm.maritalStatus" :options="dicts.maritalStatus" /></el-form-item>
          <el-form-item label="是否独居"><dict-select v-model="baseForm.isAlone" :options="dicts.isAlone" /></el-form-item>
          <el-form-item label="居住楼层"><el-input-number v-model="baseForm.livingFloor" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="电梯房"><dict-select v-model="baseForm.hasElevator" :options="dicts.hasElevator" /></el-form-item>
          <el-form-item label="跌倒史"><dict-select v-model="baseForm.fallHistory" :options="dicts.fallHistory" /></el-form-item>
          <el-form-item label="常住类型"><dict-select v-model="baseForm.permanentHomeType" :options="dicts.permanentHomeType" /></el-form-item>
          <el-form-item label="常住地点" class="form-span-2"><el-input v-model.trim="baseForm.permanentHomeName" /></el-form-item>
          <el-form-item label="儿子人数"><el-input-number v-model="baseForm.sonNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="女儿人数"><el-input-number v-model="baseForm.daughtersNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="子女居住类型"><dict-select v-model="baseForm.childrenHomeType" :options="dicts.childrenHomeType" /></el-form-item>
          <el-form-item label="子女探视频率"><el-input v-model.trim="baseForm.childrenHomingFreq" /></el-form-item>
          <el-form-item label="照料者"><dict-select v-model="baseForm.carerType" :options="dicts.carerType" /></el-form-item>
          <el-form-item label="身高(cm)"><el-input-number v-model="baseForm.height" :min="0" :precision="1" :controls="false" style="width: 100%" @change="recalcBmi" /></el-form-item>
          <el-form-item label="体重(kg)"><el-input-number v-model="baseForm.weight" :min="0" :precision="1" :controls="false" style="width: 100%" @change="recalcBmi" /></el-form-item>
          <el-form-item label="BMI"><el-input-number v-model="baseForm.bmi" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="残余牙齿"><el-input-number v-model="baseForm.alseToothNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="义齿"><dict-select v-model="baseForm.dentureStatus" :options="dicts.dentureStatus" /></el-form-item>
          <el-form-item label="听力情况"><dict-select v-model="baseForm.hearingDisorder" :options="dicts.hearingDisorder" /></el-form-item>
          <el-form-item label="视力情况"><dict-select v-model="baseForm.visualImpairmentStatus" :options="dicts.visualImpairmentStatus" /></el-form-item>
          <el-form-item label="尿失禁史"><dict-select v-model="baseForm.isUracratia" :options="dicts.isUracratia" /></el-form-item>
          <el-form-item label="便失禁史"><dict-select v-model="baseForm.isBowelProblem" :options="dicts.isBowelProblem" /></el-form-item>
          <el-form-item label="多重用药"><dict-select v-model="baseForm.isMultidrug" :options="dicts.isMultidrug" /></el-form-item>
          <el-form-item label="精神类药物"><dict-select v-model="baseForm.isUsePsychotropicDrugs" :options="dicts.isUsePsychotropicDrugs" /></el-form-item>
          <el-form-item label="影响进食"><dict-select v-model="baseForm.isAffectEating" :options="dicts.isAffectEating" /></el-form-item>
          <el-form-item label="疾病诊断" class="form-span-2">
            <el-input v-model.trim="baseForm.diseaseDiagnosis" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>

        <div class="base-med-header">
          <h3>当前用药</h3>
          <el-button :disabled="baseReadonly" @click="addMedicine">新增用药</el-button>
        </div>
        <div v-for="(item, index) in baseForm.msList" :key="index" class="medicine-row">
          <el-input v-model.trim="item.medication" :disabled="baseReadonly" placeholder="药物名称" />
          <el-input v-model.trim="item.dose" :disabled="baseReadonly" placeholder="剂量" />
          <el-input v-model.trim="item.frequency" :disabled="baseReadonly" placeholder="频次" />
          <el-input v-model.trim="item.way" :disabled="baseReadonly" placeholder="用法" />
          <el-button link type="danger" :disabled="baseReadonly" @click="removeMedicine(index)">删除</el-button>
        </div>
      </section>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="baseOpen = false">取消</el-button>
          <el-button type="primary" :disabled="baseSaveDisabled" :loading="baseSaving" @click="saveBaseForm">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="previewOpen" title="总报告预览" width="1080px" class="report-preview-dialog">
      <section v-loading="previewLoading" class="print-report">
        <div class="report-head">
          <h2>老年综合评估总报告</h2>
          <div class="subtle">评估日期：{{ dateText(previewVisit.visitDate || previewVisit.createTime) }}</div>
        </div>
        <el-descriptions :column="4" border>
          <el-descriptions-item label="姓名">{{ valueText(patient.name) }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ sexText(patient.sex) }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ valueText(patient.age) }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ valueText(patient.idNumber) }}</el-descriptions-item>
          <el-descriptions-item label="科室">{{ valueText(patient.deptName || user.dept?.deptName) }}</el-descriptions-item>
          <el-descriptions-item label="评估者">{{ valueText(user.nickName || user.userName || patient.doctorName) }}</el-descriptions-item>
          <el-descriptions-item label="门诊号">{{ valueText(patient.patientNumber) }}</el-descriptions-item>
          <el-descriptions-item label="住院号">{{ valueText(patient.admissionNumber) }}</el-descriptions-item>
          <el-descriptions-item label="床号">
            <el-input v-model.trim="previewBedNo" placeholder="/" class="print-hide" />
            <span class="print-only">{{ valueText(previewBedNo) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="电话">{{ valueText(patient.phone) }}</el-descriptions-item>
          <el-descriptions-item label="家庭住址" :span="2">{{ valueText(patient.homeAddress) }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="report-section-title">量表结果</h3>
        <el-table :data="previewTables" border stripe>
          <el-table-column prop="tableName" label="量表名称" min-width="230" />
          <el-table-column prop="scoreText" label="得分" width="90" />
          <el-table-column prop="remarkText" label="结论" min-width="220" />
          <el-table-column prop="exScoreText" label="上次得分" width="100" />
          <el-table-column prop="exRemarkText" label="上次结论" min-width="180" />
        </el-table>
      </section>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="previewOpen = false">关闭</el-button>
          <el-button @click="printPreview">打印预览页</el-button>
          <el-button type="success" @click="print(previewVisit)">打开 PDF</el-button>
        </span>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref, resolveComponent } from 'vue';
import { ElMessage } from 'element-plus';
import {
  getAssessmentTables,
  getBase,
  getBaseMedications,
  getDict,
  getPatient,
  getQuestionReport,
  openCompositePrint,
  saveBase,
  saveQuestionReport,
} from '../api/oca.js';
import { dateText, sexText, valueText } from '../format.js';
import { getUser } from '../session.js';
import { isReadOnlyMode, writeDisabledMessage } from '../config/runtime.js';

const props = defineProps({ id: { type: String, required: true } });
const user = getUser();
const DICT_FIELDS = {
  medicalInsuranceType: 'oca_medical_insurance_type',
  degree: 'oca_degree',
  careerStatus: 'oca_career_status',
  maritalStatus: 'oca_marital_status',
  isAlone: 'oca_is_alone',
  permanentHomeType: 'oca_permanent_home_type',
  childrenHomeType: 'oca_children_home_type',
  carerType: 'oca_carer_type',
  hearingDisorder: 'oca_hearing_disorder',
  visualImpairmentStatus: 'oca_visual_impairment_status',
  isUracratia: 'oca_is_uracratia',
  isMultidrug: 'oca_is_multidrug',
  isUsePsychotropicDrugs: 'oca_is_use_psychotropic_drugs',
  isAffectEating: 'oca_is_affect_eating',
};
const YES_NO_OPTIONS = [
  { dictLabel: '否', dictValue: 0 },
  { dictLabel: '是', dictValue: 1 },
];
const HAVE_NONE_OPTIONS = [
  { dictLabel: '无', dictValue: 0 },
  { dictLabel: '有', dictValue: 1 },
];
const FUNCTION_OPTIONS = [
  { dictLabel: '正常', dictValue: 1 },
  { dictLabel: '下降，但不影响生活', dictValue: 2 },
  { dictLabel: '下降，影响生活', dictValue: 3 },
];

const DictSelect = defineComponent({
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  setup(componentProps, { emit }) {
    const ElSelect = resolveComponent('ElSelect');
    const ElOption = resolveComponent('ElOption');
    return () =>
      h(
        ElSelect,
        {
          modelValue: componentProps.modelValue,
          placeholder: '请选择',
          clearable: true,
          style: 'width: 100%',
          'onUpdate:modelValue': (value) => emit('update:modelValue', value),
        },
        () =>
          componentProps.options.map((option) =>
            h(ElOption, {
              key: option.dictValue,
              label: option.dictLabel,
              value: option.dictValue,
            }),
          ),
      );
  },
});

const loading = ref(false);
const patient = ref({});
const assessmentOpen = ref(false);
const assessmentLoading = ref(false);
const currentOutpatientId = ref(null);
const tables = ref([]);
const reportOpen = ref(false);
const reportLoading = ref(false);
const reportSaving = ref(false);
const reportTitle = ref('量表明细');
const reportRows = ref([]);
const reportMeta = ref({});
const currentAssessmentState = ref(null);
const baseOpen = ref(false);
const baseLoading = ref(false);
const baseSaving = ref(false);
const baseOutpatientId = ref(null);
const baseAssessmentState = ref(null);
const baseAssociationWarning = ref('');
const previewOpen = ref(false);
const previewLoading = ref(false);
const previewVisit = ref({});
const previewTables = ref([]);
const previewBedNo = ref('');
const dicts = reactive({
  medicalInsuranceType: [],
  degree: [],
  careerStatus: [],
  maritalStatus: [],
  isAlone: [],
  permanentHomeType: [],
  childrenHomeType: [],
  carerType: [],
  hearingDisorder: FUNCTION_OPTIONS,
  visualImpairmentStatus: FUNCTION_OPTIONS,
  isUracratia: [],
  isMultidrug: [],
  isUsePsychotropicDrugs: [],
  isAffectEating: [],
  dentureStatus: HAVE_NONE_OPTIONS,
  hasElevator: YES_NO_OPTIONS,
  fallHistory: HAVE_NONE_OPTIONS,
  isBowelProblem: HAVE_NONE_OPTIONS,
});
const baseForm = reactive(defaultBaseForm());

const checks = computed(() => patient.value.checkList || []);

function mapTable(item) {
  const table = item.checkTable || {};
  return {
    ...item,
    tableName: table.name || '量表',
    scoreText: valueText(item.score),
    remarkText: valueText(item.remark),
    exScoreText: valueText(item.exScore),
    exRemarkText: valueText(item.exRemark),
  };
}

async function load() {
  loading.value = true;
  try {
    const result = await getPatient(props.id);
    patient.value = result || {};
  } catch (error) {
    ElMessage.error(error.message || '加载患者详情失败');
  } finally {
    loading.value = false;
  }
}

async function openAssessment(row) {
  currentOutpatientId.value = row.id;
  currentAssessmentState.value = row.state;
  assessmentOpen.value = true;
  assessmentLoading.value = true;
  try {
    const result = await getAssessmentTables(row.id);
    tables.value = (result.list || []).filter((item) => Number(item.checkTableId) !== 115).map(mapTable);
  } catch (error) {
    ElMessage.error(error.message || '加载量表失败');
  } finally {
    assessmentLoading.value = false;
  }
}

async function openReport(row) {
  reportTitle.value = row.tableName;
  reportMeta.value = row;
  reportOpen.value = true;
  reportLoading.value = true;
  try {
    const list = await getQuestionReport(row.checkTableId, row.id);
    reportRows.value = normalizeQuestions(list);
  } catch (error) {
    ElMessage.error(error.message || '加载明细失败');
  } finally {
    reportLoading.value = false;
  }
}

const reportReadonly = computed(() => isAssessmentSubmitted(currentAssessmentState.value) || isReportSubmitted(reportMeta.value));
const reportSaveDisabled = computed(() => isReadOnlyMode || reportReadonly.value);
const reportDisabledReason = computed(() =>
  isReadOnlyMode ? writeDisabledMessage : '该评估已提交，当前按只读方式查看，避免覆盖正式结果。',
);
const baseReadonly = computed(() => isReadOnlyMode || isAssessmentSubmitted(baseAssessmentState.value) || Boolean(baseAssociationWarning.value));
const baseSaveDisabled = computed(() => baseReadonly.value);
const baseDisabledReason = computed(() => {
  if (isReadOnlyMode) return writeDisabledMessage;
  if (isAssessmentSubmitted(baseAssessmentState.value)) return '该评估已提交，一般情况表当前按只读方式查看。';
  if (baseAssociationWarning.value) return baseAssociationWarning.value;
  return '';
});

function isAssessmentSubmitted(state) {
  return Number(state) === 1;
}

function isReportSubmitted(report = {}) {
  return [report.state, report.reportState, report.status, report.finishState].some((value) => Number(value) === 2);
}

function findAssessmentById(list = [], outpatientId) {
  if (!outpatientId) return null;
  return (list || []).find((item) => Number(item.id) === Number(outpatientId)) || null;
}

function normalizeQuestions(list) {
  return (list || []).map((item, index) => {
    const prev = index > 0 ? list[index - 1] : null;
    const checkItem = item.checkItem ? { ...item.checkItem } : { questionId: item.id };
    return {
      ...item,
      order: index + 1,
      displayContent: typeof item.content === 'string' ? item.content.replace(/^\s*\d+\s*[.、]\s*/, '') : '',
      showGroup: !!item.groupName && (!prev || prev.groupName !== item.groupName),
      checkItem,
      selectedOptionId: checkItem.optionId || null,
      inputValue: checkItem.input || '',
    };
  });
}

function buildQuestionPayload(questions) {
  return questions.map((item) => {
    const row = { ...item };
    delete row.order;
    delete row.displayContent;
    delete row.showGroup;
    delete row.selectedOptionId;
    delete row.inputValue;

    row.checkItem = null;
    if (Number(item.type) === 0 && item.selectedOptionId) {
      const option = (item.options || []).find((entry) => Number(entry.id) === Number(item.selectedOptionId));
      row.checkItem = {
        questionId: item.id,
        optionId: Number(item.selectedOptionId),
        score: option ? Number(option.optionScore ?? option.score ?? 0) : 0,
        question: item.content,
      };
    } else if (item.inputValue) {
      row.checkItem = {
        questionId: item.id,
        input: item.inputValue,
        question: item.content,
      };
    }
    return row;
  });
}

async function saveReport() {
  if (reportSaveDisabled.value) {
    ElMessage.warning(reportDisabledReason.value);
    return;
  }
  reportSaving.value = true;
  try {
    const freshState = await verifyReportWritable();
    if (!freshState) return;
    await saveQuestionReport(reportMeta.value.id, buildQuestionPayload(reportRows.value));
    ElMessage.success('量表已保存');
    reportOpen.value = false;
    if (currentOutpatientId.value) {
      const result = await getAssessmentTables(currentOutpatientId.value);
      tables.value = (result.list || []).filter((item) => Number(item.checkTableId) !== 115).map(mapTable);
    }
  } catch (error) {
    ElMessage.error(error.message || '保存量表失败');
  } finally {
    reportSaving.value = false;
  }
}

async function verifyReportWritable() {
  if (!currentOutpatientId.value) return true;
  const [result, freshPatient] = await Promise.all([getAssessmentTables(currentOutpatientId.value), getPatient(props.id)]);
  const list = result.list || [];
  const fresh = list.find(
    (item) =>
      Number(item.id) === Number(reportMeta.value.id) ||
      Number(item.reportId) === Number(reportMeta.value.id) ||
      Number(item.checkTableId) === Number(reportMeta.value.checkTableId),
  );
  const freshAssessment = findAssessmentById(freshPatient?.checkList, currentOutpatientId.value);
  const assessmentState = freshAssessment?.state ?? result.state ?? result.outpatientState ?? currentAssessmentState.value;
  const tableState = fresh?.state ?? fresh?.reportState ?? reportMeta.value.state;
  currentAssessmentState.value = assessmentState;
  if (fresh) reportMeta.value = { ...reportMeta.value, ...mapTable(fresh) };
  if (freshPatient) patient.value = freshPatient;
  if (isAssessmentSubmitted(assessmentState) || isReportSubmitted({ state: tableState })) {
    ElMessage.warning('评估已提交，禁止保存量表。');
    return false;
  }
  return true;
}

async function openCompositePreview(row) {
  previewVisit.value = row || {};
  previewBedNo.value = '';
  previewOpen.value = true;
  previewLoading.value = true;
  try {
    const result = await getAssessmentTables(row.id);
    previewTables.value = (result.list || [])
      .filter((item) => Number(item.checkTableId) !== 115)
      .map(mapTable);
  } catch (error) {
    ElMessage.error(error.message || '加载总报告预览失败');
  } finally {
    previewLoading.value = false;
  }
}

function emptyMedicine() {
  return { medication: '', dose: '', frequency: '', way: '' };
}

function defaultBaseForm() {
  return {
    id: null,
    patientId: Number(props.id),
    outpatientId: null,
    tableId: 4,
    nativePlace: '',
    medicalInsuranceType: '',
    degree: '',
    careerStatus: '',
    height: null,
    weight: null,
    bmi: null,
    smokingHistory: '',
    drinkingHistory: '',
    maritalStatus: '',
    permanentHomeType: '',
    permanentHomeName: '',
    sonNumber: null,
    daughtersNumber: null,
    isAlone: '',
    childrenHomeType: '',
    childrenHomingFreq: '',
    carerType: '',
    hearingDisorder: '',
    visualImpairmentStatus: '',
    isUracratia: '',
    isMultidrug: '',
    isUsePsychotropicDrugs: '',
    alseToothNumber: null,
    dentureStatus: '',
    livingFloor: null,
    hasElevator: '',
    fallHistory: '',
    isAffectEating: '',
    isBowelProblem: '',
    diseaseDiagnosis: '',
    msList: [emptyMedicine()],
  };
}

function normalizeMsList(list) {
  const rows = Array.isArray(list) ? list : [];
  const filtered = rows
    .map((item) => ({ ...emptyMedicine(), ...(item || {}) }))
    .filter((item) => item.medication || item.dose || item.frequency || item.way);
  return filtered.length ? filtered : [emptyMedicine()];
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function normalizeDictList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const numberValue = Number(item.dictValue);
    return {
      ...item,
      dictValue: Number.isNaN(numberValue) ? item.dictValue : numberValue,
    };
  });
}

function cleanPayload(payload, { keepEmpty = false } = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (keepEmpty ? value !== undefined : value !== '' && value !== null && value !== undefined)),
  );
}

async function loadBaseDicts() {
  const results = await Promise.all(
    Object.entries(DICT_FIELDS).map(async ([field, dictType]) => {
      try {
        return [field, await getDict(dictType)];
      } catch {
        return [field, []];
      }
    }),
  );
  results.forEach(([field, list]) => {
    dicts[field] = normalizeDictList(list);
  });
  dicts.hearingDisorder = FUNCTION_OPTIONS;
  dicts.visualImpairmentStatus = FUNCTION_OPTIONS;
  dicts.dentureStatus = HAVE_NONE_OPTIONS;
  dicts.hasElevator = YES_NO_OPTIONS;
  dicts.fallHistory = HAVE_NONE_OPTIONS;
  dicts.isBowelProblem = HAVE_NONE_OPTIONS;
}

async function openBase(row) {
  baseOutpatientId.value = row?.id || null;
  baseAssessmentState.value = row?.state ?? null;
  baseAssociationWarning.value = '';
  baseOpen.value = true;
  baseLoading.value = true;
  try {
    const [base, medications] = await Promise.all([
      getBase(props.id).catch(() => ({})),
      getBaseMedications(props.id).catch(() => []),
      loadBaseDicts(),
    ]);
    const selectedOutpatientId = row?.id || base?.outpatientId || null;
    if (base?.id && row?.id && !base?.outpatientId) {
      baseAssociationWarning.value = '后端仅按患者返回一般情况表，无法确认该记录是否属于当前评估，已禁止保存以避免误更新。';
    } else if (base?.id && row?.id && Number(base.outpatientId) !== Number(row.id)) {
      baseAssociationWarning.value = '当前一般情况表记录归属的评估与所选评估不一致，已禁止保存以避免误更新。';
    }
    Object.assign(baseForm, defaultBaseForm(), base || {}, {
      patientId: Number(props.id),
      outpatientId: selectedOutpatientId,
      tableId: row?.tableId || base?.tableId || 4,
      msList: normalizeMsList((Array.isArray(medications) && medications.length ? medications : base?.msList) || []),
    });
  } catch (error) {
    ElMessage.error(error.message || '加载一般情况失败');
  } finally {
    baseLoading.value = false;
  }
}

function recalcBmi() {
  const height = Number(baseForm.height);
  const weight = Number(baseForm.weight);
  if (!height || !weight) return;
  baseForm.bmi = Number((weight / (height / 100) ** 2).toFixed(2));
}

function addMedicine() {
  if (baseReadonly.value) return;
  baseForm.msList.push(emptyMedicine());
}

function removeMedicine(index) {
  if (baseReadonly.value) return;
  if (baseForm.msList.length <= 1) {
    baseForm.msList[0] = emptyMedicine();
    return;
  }
  baseForm.msList.splice(index, 1);
}

function printPreview() {
  window.print();
}

async function verifyBaseWritable() {
  const outpatientId = baseOutpatientId.value || baseForm.outpatientId;
  const [freshPatient, freshBase] = await Promise.all([
    getPatient(props.id),
    getBase(props.id).catch(() => null),
  ]);
  if (freshPatient) patient.value = freshPatient;
  const freshAssessment = findAssessmentById(freshPatient?.checkList, outpatientId);
  if (freshAssessment) baseAssessmentState.value = freshAssessment.state;
  if (isAssessmentSubmitted(baseAssessmentState.value)) {
    ElMessage.warning('评估已提交，禁止保存一般情况表。');
    return false;
  }
  if (freshBase?.id && outpatientId && !freshBase?.outpatientId) {
    baseAssociationWarning.value = '后端仅按患者返回一般情况表，无法确认该记录是否属于当前评估，已禁止保存以避免误更新。';
    ElMessage.warning(baseAssociationWarning.value);
    return false;
  }
  if (freshBase?.id && outpatientId && Number(freshBase.outpatientId) !== Number(outpatientId)) {
    baseAssociationWarning.value = '当前一般情况表记录归属的评估与所选评估不一致，已禁止保存以避免误更新。';
    ElMessage.warning(baseAssociationWarning.value);
    return false;
  }
  return true;
}

async function saveBaseForm() {
  if (baseSaveDisabled.value) {
    ElMessage.warning(baseDisabledReason.value);
    return;
  }
  if (!baseForm.id && !(baseOutpatientId.value || baseForm.outpatientId)) {
    ElMessage.warning('请先选择一条评估记录后再新增一般情况表');
    return;
  }
  baseSaving.value = true;
  try {
    const freshWritable = await verifyBaseWritable();
    if (!freshWritable) return;
    const msList = normalizeMsList(baseForm.msList).filter(
      (item) => item.medication || item.dose || item.frequency || item.way,
    );
    const payload = cleanPayload({
      ...baseForm,
      patientId: Number(props.id),
      outpatientId: baseOutpatientId.value || baseForm.outpatientId,
      tableId: baseForm.tableId || 4,
      height: toNumberOrNull(baseForm.height),
      weight: toNumberOrNull(baseForm.weight),
      bmi: toNumberOrNull(baseForm.bmi),
      sonNumber: toNumberOrNull(baseForm.sonNumber),
      daughtersNumber: toNumberOrNull(baseForm.daughtersNumber),
      alseToothNumber: toNumberOrNull(baseForm.alseToothNumber),
      dentureStatus: toNumberOrNull(baseForm.dentureStatus),
      livingFloor: toNumberOrNull(baseForm.livingFloor),
      hasElevator: toNumberOrNull(baseForm.hasElevator),
      fallHistory: toNumberOrNull(baseForm.fallHistory),
      isBowelProblem: toNumberOrNull(baseForm.isBowelProblem),
    }, { keepEmpty: Boolean(baseForm.id) });
    if (msList.length) {
      payload.msList = msList;
    }
    await saveBase(payload);
    ElMessage.success('一般情况已保存');
    baseOpen.value = false;
    await load();
  } catch (error) {
    ElMessage.error(error.message || '保存一般情况失败');
  } finally {
    baseSaving.value = false;
  }
}

async function print(row) {
  try {
    await openCompositePrint(row.id);
  } catch (error) {
    ElMessage.error(error.message || '打开打印报告失败');
  }
}

function answerText(row) {
  if (row.answer) return row.answer;
  if (row.checkItem?.input) return row.checkItem.input;
  const optionId = row.checkItem?.optionId;
  const option = (row.options || []).find((item) => Number(item.id) === Number(optionId));
  return option?.optionText || '/';
}

function scoreText(row) {
  if (row.score !== undefined && row.score !== null) return row.score;
  const optionId = row.selectedOptionId || row.checkItem?.optionId;
  const option = (row.options || []).find((item) => Number(item.id) === Number(optionId));
  return option?.optionScore ?? option?.score ?? '/';
}

onMounted(load);
</script>
