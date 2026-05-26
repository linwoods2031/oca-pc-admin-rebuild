<template>
  <section v-loading="loading">
    <div class="panel" style="margin-bottom: 18px">
      <div class="detail-actions">
        <el-button link @click="$router.back()">返回</el-button>
        <div>
          <el-button @click="openBase(checks[0] || {})">一般情况表</el-button>
          <el-button
            v-if="showTestAssessmentCreate"
            type="warning"
            :loading="creatingTestAssessment"
            @click="createTestAssessment"
          >
            创建测试评估
          </el-button>
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
            <el-button type="primary" link @click="openAssessment(row)">查看评估量表结果</el-button>
            <el-button type="warning" link @click="openCompositePreview(row)">总报告预览</el-button>
            <el-button type="success" link @click="print(row)">总报告打印</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="assessmentOpen" title="量表结果" width="1040px">
      <section class="assessment-print-report print-report">
        <div class="report-head">
          <h2>评估量表结果报告单</h2>
          <div class="subtle">评估日期：{{ dateText(assessmentVisit.visitDate || assessmentVisit.createTime) }}</div>
        </div>
        <el-descriptions :column="4" border class="assessment-print-meta">
          <el-descriptions-item label="姓名">{{ valueText(patient.name) }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ sexText(patient.sex) }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ valueText(patient.age) }}</el-descriptions-item>
          <el-descriptions-item label="住院号">{{ valueText(patient.admissionNumber) }}</el-descriptions-item>
        </el-descriptions>
        <el-table v-loading="assessmentLoading" :data="tables" stripe max-height="520">
          <el-table-column prop="tableName" label="量表名称" min-width="230" />
          <el-table-column prop="scoreText" label="得分" width="140" class-name="pre-line-cell" />
          <el-table-column prop="remarkText" label="结论" min-width="180" class-name="pre-line-cell" />
          <el-table-column prop="exScoreText" label="上次得分" width="140" class-name="pre-line-cell" />
          <el-table-column prop="exRemarkText" label="上次结论" min-width="160" class-name="pre-line-cell" />
          <el-table-column label="操作" width="120" class-name="print-hide" label-class-name="print-hide">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="row.previousOnly" @click="openReport(row)">
                {{ row.previousOnly ? '本次未选' : '明细' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="assessmentOpen = false">关闭</el-button>
          <el-button @click="printAssessmentResults">打印量表结果</el-button>
        </span>
      </template>
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
          <el-form-item label="医保类型"><dict-select v-model="baseForm.medicalInsuranceType" :options="dicts.medicalInsuranceType" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="文化程度"><dict-select v-model="baseForm.degree" :options="dicts.degree" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="目前工作"><dict-select v-model="baseForm.careerStatus" :options="dicts.careerStatus" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="吸烟情况"><el-input v-model.trim="baseForm.smokingHistory" /></el-form-item>
          <el-form-item label="饮酒情况"><el-input v-model.trim="baseForm.drinkingHistory" /></el-form-item>
          <el-form-item label="婚姻状态"><dict-select v-model="baseForm.maritalStatus" :options="dicts.maritalStatus" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="是否独居"><dict-select v-model="baseForm.isAlone" :options="dicts.isAlone" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="居住楼层"><el-input-number v-model="baseForm.livingFloor" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="电梯房"><dict-select v-model="baseForm.hasElevator" :options="dicts.hasElevator" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="跌倒史"><dict-select v-model="baseForm.fallHistory" :options="dicts.fallHistory" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="常住类型"><dict-select v-model="baseForm.permanentHomeType" :options="dicts.permanentHomeType" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="常住地点" class="form-span-2"><el-input v-model.trim="baseForm.permanentHomeName" /></el-form-item>
          <el-form-item label="儿子人数"><el-input-number v-model="baseForm.sonNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="女儿人数"><el-input-number v-model="baseForm.daughtersNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="子女居住类型"><dict-select v-model="baseForm.childrenHomeType" :options="dicts.childrenHomeType" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="子女探视频率"><el-input v-model.trim="baseForm.childrenHomingFreq" /></el-form-item>
          <el-form-item label="照料者"><dict-select v-model="baseForm.carerType" :options="dicts.carerType" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="身高(cm)"><el-input-number v-model="baseForm.height" :min="0" :precision="1" :controls="false" style="width: 100%" @change="recalcBmi" /></el-form-item>
          <el-form-item label="体重(kg)"><el-input-number v-model="baseForm.weight" :min="0" :precision="1" :controls="false" style="width: 100%" @change="recalcBmi" /></el-form-item>
          <el-form-item label="BMI"><el-input-number v-model="baseForm.bmi" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="残余牙齿"><el-input-number v-model="baseForm.alseToothNumber" :min="0" :controls="false" style="width: 100%" /></el-form-item>
          <el-form-item label="义齿"><dict-select v-model="baseForm.dentureStatus" :options="dicts.dentureStatus" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="听力情况"><dict-select v-model="baseForm.hearingDisorder" :options="dicts.hearingDisorder" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="视力情况"><dict-select v-model="baseForm.visualImpairmentStatus" :options="dicts.visualImpairmentStatus" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="尿失禁史"><dict-select v-model="baseForm.isUracratia" :options="dicts.isUracratia" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="便失禁史"><dict-select v-model="baseForm.isBowelProblem" :options="dicts.isBowelProblem" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="多重用药"><dict-select v-model="baseForm.isMultidrug" :options="dicts.isMultidrug" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="精神类药物"><dict-select v-model="baseForm.isUsePsychotropicDrugs" :options="dicts.isUsePsychotropicDrugs" :disabled="baseReadonly" /></el-form-item>
          <el-form-item label="影响进食"><dict-select v-model="baseForm.isAffectEating" :options="dicts.isAffectEating" :disabled="baseReadonly" /></el-form-item>
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
          <el-button type="primary" :disabled="baseSaveDisabled" @click="saveBaseForm">保存</el-button>
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
            <el-input v-model.trim="previewBedNo" placeholder="" class="print-hide" />
            <span class="print-only">{{ previewBedNo || '' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="是否独居">{{ baseValueText(previewBase.isAlone, dicts.isAlone) }}</el-descriptions-item>
          <el-descriptions-item label="家庭住址" :span="2">{{ valueText(patient.homeAddress) }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="report-section-title">患者基本情况</h3>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="文化程度">{{ baseValueText(previewBase.degree, dicts.degree) }}</el-descriptions-item>
          <el-descriptions-item label="婚姻状况">{{ baseValueText(previewBase.maritalStatus, dicts.maritalStatus) }}</el-descriptions-item>
          <el-descriptions-item label="是否独居">{{ baseValueText(previewBase.isAlone, dicts.isAlone) }}</el-descriptions-item>
          <el-descriptions-item label="照料者">{{ baseValueText(previewBase.carerType, dicts.carerType) }}</el-descriptions-item>
          <el-descriptions-item label="残余牙齿">{{ valueText(previewBase.alseToothNumber) }}</el-descriptions-item>
          <el-descriptions-item label="义齿">{{ baseValueText(previewBase.dentureStatus, dicts.dentureStatus) }}</el-descriptions-item>
          <el-descriptions-item label="居住楼层">{{ valueText(previewBase.livingFloor) }}</el-descriptions-item>
          <el-descriptions-item label="电梯房">{{ baseValueText(previewBase.hasElevator, dicts.hasElevator) }}</el-descriptions-item>
          <el-descriptions-item label="跌倒史">{{ baseValueText(previewBase.fallHistory, dicts.fallHistory) }}</el-descriptions-item>
          <el-descriptions-item label="影响进食">{{ baseValueText(previewBase.isAffectEating, dicts.isAffectEating) }}</el-descriptions-item>
          <el-descriptions-item label="视力情况">{{ baseValueText(previewBase.visualImpairmentStatus, dicts.visualImpairmentStatus) }}</el-descriptions-item>
          <el-descriptions-item label="听力情况">{{ baseValueText(previewBase.hearingDisorder, dicts.hearingDisorder) }}</el-descriptions-item>
          <el-descriptions-item label="尿失禁史">{{ baseValueText(previewBase.isUracratia, dicts.isUracratia) }}</el-descriptions-item>
          <el-descriptions-item label="便失禁史">{{ baseValueText(previewBase.isBowelProblem, dicts.isBowelProblem) }}</el-descriptions-item>
          <el-descriptions-item label="多重用药">{{ baseValueText(previewBase.isMultidrug, dicts.isMultidrug) }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="report-section-title">评估量表</h3>
        <el-table :data="previewReportRows" border stripe>
          <el-table-column prop="leftName" label="量表名称" width="180" />
          <el-table-column prop="leftResult" label="评估结果" min-width="260" class-name="pre-line-cell" />
          <el-table-column prop="rightName" label="量表名称" width="180" />
          <el-table-column prop="rightResult" label="评估结果" min-width="260" class-name="pre-line-cell" />
        </el-table>

        <h3 class="report-section-title">体能评测</h3>
        <el-table :data="previewPhysicalRows" border stripe>
          <el-table-column prop="leftName" label="项目" width="180" />
          <el-table-column prop="leftResult" label="结果" min-width="260" />
          <el-table-column prop="rightName" label="项目" width="180" />
          <el-table-column prop="rightResult" label="结果" min-width="260" />
        </el-table>

        <h3 class="report-section-title">与上次评估对比</h3>
        <el-table :data="previewCompareRows" border stripe>
          <el-table-column prop="tableName" label="量表名称" min-width="230" />
          <el-table-column prop="scoreText" label="本次得分" width="140" class-name="pre-line-cell" />
          <el-table-column prop="remarkText" label="本次结论" min-width="220" class-name="pre-line-cell" />
          <el-table-column prop="exScoreText" label="上次得分" width="140" class-name="pre-line-cell" />
          <el-table-column prop="exRemarkText" label="上次结论" min-width="180" class-name="pre-line-cell" />
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
import { computed, defineComponent, h, onMounted, reactive, ref, resolveComponent, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  createAssessment,
  getAssessmentTables,
  getBase,
  getBaseMedications,
  getDict,
  getPatient,
  getQuestionReport,
  openCompositePrint,
  saveQuestionReport,
} from '../api/oca.js';
import { dateText, sexText, valueText } from '../format.js';
import { getUser } from '../session.js';
import {
  assertOutpatientWriteAllowed,
  assertPatientWriteAllowed,
  assertReportWriteAllowed,
  allowSessionWriteIds,
  baseWriteDisabledMessage,
  hasOutpatientWriteId,
  hasPatientWriteId,
  isBaseWriteEnabled,
  isReadOnlyMode,
  isWriteEnabled,
  rememberWriteAllowIds,
  writeDisabledMessage,
} from '../config/runtime.js';
import { emptyMedicine, normalizeMsList } from '../utils/basePayload.js';
import { verifyBaseAssociation } from '../utils/baseWritable.js';
import { buildNrsPainDetails, buildSppbPhysicalDetails, nrsDetailText, nrsScoreText } from '../utils/reportDetails.js';
import { reportDisplayText } from '../utils/reportDisplay.js';
import { buildQuestionPayload, isAssessmentSubmitted, isReportSubmitted, scoreText } from '../utils/reportPayload.js';
import { decideReportWritable } from '../utils/reportWritable.js';

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
const TEST_ASSESSMENT_TABLES = [102];

const DictSelect = defineComponent({
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
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
          disabled: componentProps.disabled,
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
const assessmentVisit = ref({});
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
const baseOutpatientId = ref(null);
const baseAssessmentState = ref(null);
const baseAssociationWarning = ref('');
const previewOpen = ref(false);
const previewLoading = ref(false);
const previewVisit = ref({});
const previewTables = ref([]);
const previewBase = ref({});
const previewDetails = ref({ sppb: {}, nrs: {} });
const previewBedNo = ref('');
const creatingTestAssessment = ref(false);
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

const REPORT_SUMMARY_LAYOUT = [
  [{ label: 'Tinetti\n平衡', tableId: 13 }, { label: 'ADL\n(功能)', tableId: 101 }],
  [{ label: 'Tinetti\n步态', tableId: 14 }, { label: 'IADL\n(生活)', tableId: 102 }],
  [{ label: 'MMSE\n(认知)', tableId: 105 }, { label: 'SAS\n(焦虑)', tableId: 103 }],
  [{ label: 'Mini Cog\n(认知)', handwrite: true }, { label: 'SDS\n(抑郁)', tableId: 104 }],
  [{ label: 'NRS2002\n(营养)', handwrite: true }, { label: 'CAM\n(谵妄)', handwrite: true }],
  [{ label: 'MNA-SF\n(营养)', tableId: 107 }, { label: 'AIS\n(睡眠)', tableId: 109 }],
  [{ label: 'CFS-09\n(衰弱)', tableId: 112 }, { label: 'EAT-10\n(吞咽)', tableId: 111 }],
  [{ label: 'FRIED\n(衰弱)', tableId: 117 }, { label: 'SARC-F\n(简易五项)', tableId: 108 }],
  [{ label: 'Frail\n(衰弱)', tableId: 110 }, { label: '中医体质\n辨识', tableId: 116 }],
  [{ label: 'FRA\n(跌倒)', tableId: 106 }, { label: 'SPPB', tableId: 114 }],
  [{ label: 'NRS\n(疼痛)', tableId: 113 }, { label: '疼痛信息', detail: 'nrs' }],
];

const checks = computed(() => patient.value.checkList || []);
const showTestAssessmentCreate = computed(
  () => allowSessionWriteIds && isWriteEnabled && hasPatientWriteId(props.id),
);
const previewTableById = computed(() => new Map(previewTables.value.map((row) => [Number(row.checkTableId), row])));
const previewReportRows = computed(() =>
  REPORT_SUMMARY_LAYOUT.map(([left, right]) => ({
    leftName: left?.label || '',
    leftResult: previewSlotResult(left),
    rightName: right?.label || '',
    rightResult: previewSlotResult(right),
  })),
);
const previewCompareRows = computed(() => previewTables.value.filter((row) => row.hasCompare));
const previewPhysicalRows = computed(() => {
  const sppb = previewDetails.value.sppb || {};
  return [
    { leftName: '4米步速试验', leftResult: sppb.fourMeter || '', rightName: '3米来回试验', rightResult: '' },
    { leftName: '5次起坐', leftResult: sppb.fiveRise || '', rightName: '并足站立', rightResult: sppb.feetTogether || '' },
    { leftName: '串联站立', leftResult: sppb.tandem || '', rightName: '半串联站立', rightResult: sppb.semiTandem || '' },
    { leftName: '握力（左）', leftResult: '', rightName: '握力（右）', rightResult: '' },
    { leftName: '小腿围（左）', leftResult: '', rightName: '小腿围（右）', rightResult: '' },
    { leftName: '腰围', leftResult: '', rightName: '臀围', rightResult: '' },
    { leftName: '体力状况', leftResult: '', rightName: '', rightResult: '' },
  ];
});

function mapTable(item) {
  const table = item.checkTable || {};
  const displayText = reportDisplayText(item);
  const hasCompare = hasPreviousResult(item);
  const previousOnly = !item.id && hasCompare;
  return {
    ...item,
    tableName: table.name || '量表',
    previousOnly,
    hasCompare,
    ...displayText,
  };
}

function hasPreviousResult(item = {}) {
  const remark = String(item.exRemark || '').trim();
  return (item.exScore !== null && item.exScore !== undefined) || (remark && remark !== '-' && remark !== '/');
}

function previewSlotResult(slot) {
  if (!slot) return '';
  if (slot.detail === 'nrs') return nrsDetailText(previewDetails.value.nrs);
  if (slot.handwrite) return '';
  const row = previewTableById.value.get(Number(slot.tableId));
  if (!row || row.previousOnly) return '/';
  const scoreTextValue = Number(slot.tableId) === 113 ? nrsScoreText(row, previewDetails.value.nrs) : row.scoreText;
  const score = scoreTextValue && scoreTextValue !== '/' ? `得分：${scoreTextValue}` : '';
  const remark = row.remarkText && row.remarkText !== '/' ? `结论：${row.remarkText}` : '';
  return [score, remark].filter(Boolean).join('\n') || '/';
}

function baseValueText(value, options = []) {
  const matched = (options || []).find((item) => String(item.dictValue) === String(value));
  return matched ? matched.dictLabel : valueText(value);
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

function resetTransientState() {
  assessmentOpen.value = false;
  assessmentVisit.value = {};
  reportOpen.value = false;
  baseOpen.value = false;
  previewOpen.value = false;
  currentOutpatientId.value = null;
  currentAssessmentState.value = null;
  tables.value = [];
  reportRows.value = [];
  reportMeta.value = {};
  baseOutpatientId.value = null;
  baseAssessmentState.value = null;
  baseAssociationWarning.value = '';
  previewVisit.value = {};
  previewTables.value = [];
  previewBase.value = {};
  previewDetails.value = { sppb: {}, nrs: {} };
  previewBedNo.value = '';
  Object.assign(baseForm, defaultBaseForm());
}

async function openAssessment(row) {
  assessmentVisit.value = row || {};
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

function ensureSessionAssessmentRow(outpatientId) {
  if (!outpatientId) return;
  const checkList = Array.isArray(patient.value.checkList) ? [...patient.value.checkList] : [];
  if (checkList.some((item) => String(item?.id) === String(outpatientId))) return;
  checkList.unshift({
    id: outpatientId,
    state: 0,
    visitDate: new Date().toISOString(),
    createTime: new Date().toISOString(),
  });
  patient.value = { ...patient.value, checkList };
}

async function createTestAssessment() {
  if (!showTestAssessmentCreate.value) {
    ElMessage.warning('当前患者不在写入测试范围，禁止创建测试评估。');
    return;
  }
  creatingTestAssessment.value = true;
  try {
    const outpatientId = await createAssessment(props.id, TEST_ASSESSMENT_TABLES);
    const result = await getAssessmentTables(outpatientId);
    rememberWriteAllowIds({
      outpatientIds: [outpatientId],
      reportIds: (result.list || []).map((item) => item.id || item.reportId).filter(Boolean),
    });
    await load();
    // 当前恢复后端的患者详情接口可能不回显本次未提交评估；本会话测试创建后补一条临时行，便于继续量表填写。
    ensureSessionAssessmentRow(outpatientId);
    ElMessage.success('测试评估已创建');
  } catch (error) {
    ElMessage.error(error.message || '创建测试评估失败');
  } finally {
    creatingTestAssessment.value = false;
  }
}

async function openReport(row) {
  if (row.previousOnly) {
    ElMessage.info('本次未选择该量表，仅展示上次评估结果。');
    return;
  }
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
const baseReadonly = computed(
  () => !isBaseWriteEnabled || isReadOnlyMode || isAssessmentSubmitted(baseAssessmentState.value) || Boolean(baseAssociationWarning.value),
);
const baseSaveDisabled = computed(() => baseReadonly.value);
const baseDisabledReason = computed(() => {
  if (!isBaseWriteEnabled) return baseWriteDisabledMessage;
  if (isReadOnlyMode) return writeDisabledMessage;
  if (isAssessmentSubmitted(baseAssessmentState.value)) return '该评估已提交，一般情况表当前按只读方式查看。';
  if (baseAssociationWarning.value) return baseAssociationWarning.value;
  return '';
});

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
      selectedOptionId: checkItem.optionId !== null && checkItem.optionId !== undefined && checkItem.optionId !== '' ? checkItem.optionId : null,
      inputValue: checkItem.input || '',
    };
  });
}

async function saveReport() {
  if (reportSaveDisabled.value) {
    ElMessage.warning(reportDisabledReason.value);
    return;
  }
  reportSaving.value = true;
  try {
    assertPatientWriteAllowed(props.id, '当前患者不在写入灰度 allow-list，禁止保存量表');
    assertOutpatientWriteAllowed(currentOutpatientId.value, '当前评估不在写入灰度 allow-list，禁止保存量表');
    assertReportWriteAllowed(reportMeta.value.id, '当前量表报告不在写入灰度 allow-list，禁止保存量表');
    const freshState = await verifyReportWritable();
    if (!freshState) return;
    await saveQuestionReport(reportMeta.value.id, buildQuestionPayload(reportRows.value), {
      patientId: props.id,
      outpatientId: currentOutpatientId.value,
    });
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
  if (!currentOutpatientId.value) {
    ElMessage.warning('保存前无法确认当前评估，已禁止保存量表。');
    return false;
  }
  const sessionAssessmentAllowed = allowSessionWriteIds && hasOutpatientWriteId(currentOutpatientId.value);
  const [result, freshPatient] = await Promise.all([getAssessmentTables(currentOutpatientId.value), getPatient(props.id)]);
  const decision = decideReportWritable({
    freshPatient,
    assessmentTables: result,
    currentOutpatientId: currentOutpatientId.value,
    reportMeta: reportMeta.value,
    allowSessionAssessment: sessionAssessmentAllowed,
  });
  currentAssessmentState.value = decision.assessmentState ?? currentAssessmentState.value;
  if (decision.freshReport) reportMeta.value = { ...decision.mergedReport, ...mapTable(decision.freshReport) };
  if (freshPatient) {
    patient.value = freshPatient;
    if (sessionAssessmentAllowed) ensureSessionAssessmentRow(currentOutpatientId.value);
  }
  if (!decision.allowed) {
    ElMessage.warning(decision.reason);
    return false;
  }
  return true;
}

async function openCompositePreview(row) {
  previewVisit.value = row || {};
  previewBedNo.value = '';
  previewDetails.value = { sppb: {}, nrs: {} };
  previewOpen.value = true;
  previewLoading.value = true;
  try {
    const [result, base] = await Promise.all([
      getAssessmentTables(row.id),
      getBase(props.id).catch(() => ({})),
      loadBaseDicts(),
    ]);
    previewBase.value = base || {};
    const mappedTables = (result.list || [])
      .filter((item) => Number(item.checkTableId) !== 115)
      .map(mapTable);
    previewTables.value = mappedTables;
    previewDetails.value = await loadPreviewReportDetails(mappedTables);
  } catch (error) {
    ElMessage.error(error.message || '加载总报告预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function loadPreviewReportDetails(mappedTables) {
  const detail = { sppb: {}, nrs: {} };
  await Promise.all(
    [
      { tableId: 114, key: 'sppb' },
      { tableId: 113, key: 'nrs' },
    ].map(async ({ tableId, key }) => {
      const row = mappedTables.find((item) => Number(item.checkTableId) === tableId && !item.previousOnly);
      const reportId = row?.id || row?.reportId;
      if (!reportId) return;
      try {
        const items = await getQuestionReport(tableId, reportId);
        detail[key] = tableId === 114 ? buildSppbPhysicalDetails(items) : buildNrsPainDetails(items);
      } catch {
        detail[key] = {};
      }
    }),
  );
  return detail;
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
  dicts.isUracratia = HAVE_NONE_OPTIONS;
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
    const medicineRows = normalizeMsList((Array.isArray(medications) && medications.length ? medications : base?.msList) || []);
    if (base?.id && row?.id) {
      const association = verifyBaseAssociation({
        freshBase: base,
        baseFormId: base.id,
        outpatientId: row.id,
        isCreateBase: false,
      });
      if (!association.allowed) baseAssociationWarning.value = association.reason;
    }
    Object.assign(baseForm, defaultBaseForm(), base || {}, {
      patientId: Number(props.id),
      outpatientId: selectedOutpatientId,
      tableId: row?.tableId || base?.tableId || 4,
      msList: medicineRows.length ? medicineRows : [emptyMedicine()],
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

function printAssessmentResults() {
  window.print();
}

function saveBaseForm() {
  ElMessage.warning(baseDisabledReason.value || baseWriteDisabledMessage);
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
  const option = (row.options || []).find((item) => String(item.id) === String(optionId));
  return option?.optionText || '/';
}

onMounted(load);
watch(
  () => props.id,
  () => {
    resetTransientState();
    load();
  },
);
</script>
