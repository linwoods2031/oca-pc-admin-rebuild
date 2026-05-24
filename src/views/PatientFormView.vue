<template>
  <section v-loading="loading" class="panel">
    <div class="form-header">
      <div>
        <el-button link @click="cancel">返回</el-button>
        <h2>{{ isEdit ? '编辑患者' : '新增患者' }}</h2>
      </div>
      <el-tooltip :disabled="!saveDisabledReason" :content="saveDisabledReason" placement="top">
        <span>
          <el-button type="primary" :disabled="saveDisabled" :loading="saving" @click="submit">保存</el-button>
        </span>
      </el-tooltip>
    </div>

    <el-alert
      v-if="createPatientWriteNotice"
      type="error"
      :closable="false"
      title="新增患者将写入生产 API，仅限测试或正式变更窗口。"
      style="margin-top: 14px"
    />

    <el-alert
      v-if="saveDisabledReason"
      type="warning"
      :closable="false"
      :title="saveDisabledReason"
      style="margin-top: 14px"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="patient-form" :disabled="saveDisabled">
      <el-form-item label="姓名" prop="name">
        <el-input v-model.trim="form.name" maxlength="30" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="性别" prop="sex">
        <el-select v-model="form.sex" placeholder="请选择性别" style="width: 100%">
          <el-option label="男" :value="0" />
          <el-option label="女" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="身份证号" prop="idNumber">
        <el-input v-model.trim="form.idNumber" maxlength="18" placeholder="请输入身份证号" />
      </el-form-item>
      <el-form-item label="生日" prop="birthday">
        <el-date-picker
          v-model="form.birthday"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="请选择生日"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="电话" prop="phone">
        <el-input v-model.trim="form.phone" maxlength="20" placeholder="请输入电话" />
      </el-form-item>
      <el-form-item label="家属姓名" prop="guardianName">
        <el-input v-model.trim="form.guardianName" maxlength="30" placeholder="请输入家属姓名" />
      </el-form-item>
      <el-form-item label="家属电话" prop="guardianPhone">
        <el-input v-model.trim="form.guardianPhone" maxlength="20" placeholder="请输入家属电话" />
      </el-form-item>
      <el-form-item label="门诊号" prop="patientNumber">
        <el-input v-model.trim="form.patientNumber" maxlength="40" placeholder="请输入门诊号" />
      </el-form-item>
      <el-form-item label="住院号" prop="admissionNumber">
        <el-input v-model.trim="form.admissionNumber" maxlength="40" placeholder="请输入住院号" />
      </el-form-item>
      <el-form-item label="病房号" prop="sickroomNumber">
        <el-input v-model.trim="form.sickroomNumber" maxlength="40" placeholder="请输入病房号" />
      </el-form-item>
      <el-form-item label="病床号" prop="sickbedNumber">
        <el-input v-model.trim="form.sickbedNumber" maxlength="40" placeholder="请输入病床号" />
      </el-form-item>
      <el-form-item label="家庭住址" prop="homeAddress" class="form-span-2">
        <el-input v-model.trim="form.homeAddress" maxlength="120" placeholder="请输入家庭住址" />
      </el-form-item>
    </el-form>
  </section>
</template>

<script setup>
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { addPatient, getInfo, getPatient, updatePatient } from '../api/oca.js';
import {
  assertCreatePatientAllowed,
  assertPatientWriteAllowed,
  allowCreatePatient,
  hasPatientWriteId,
  isAllowListEnabled,
  isReadOnlyMode,
  isWriteEnabled,
  writeGuardMessage,
  writeDisabledMessage,
} from '../config/runtime.js';
import { getUser } from '../session.js';
import { buildPatientPayload, inferArchiveOwner } from '../utils/patientPayload.js';

const props = defineProps({ id: { type: String, default: '' } });
const router = useRouter();
const isEdit = computed(() => Boolean(props.id));
const loading = ref(false);
const saving = ref(false);
const formRef = ref(null);
const original = ref({});
const initialForm = ref({});
const ownerDefaults = ref({});
const ownerDefaultsReady = ref(false);
const createPatientWriteNotice = computed(() => !isEdit.value && allowCreatePatient);
const ownerDefaultsComplete = computed(() =>
  Boolean(ownerDefaults.value.deptId && ownerDefaults.value.hospitalId && ownerDefaults.value.attendingDoctor),
);
const saveDisabledReason = computed(() => {
  if (isReadOnlyMode) return writeDisabledMessage;
  if (isWriteEnabled && !isAllowListEnabled) return writeGuardMessage;
  if (isEdit.value && !hasPatientWriteId(props.id)) return '当前患者不在写入灰度 allow-list，禁止编辑患者';
  if (!isEdit.value && !allowCreatePatient) return '写入灰度默认禁止新增患者，必须显式设置 VITE_ALLOW_CREATE_PATIENT=true';
  if (!isEdit.value && allowCreatePatient && !ownerDefaultsReady.value) return '正在确认患者归属字段，请稍后再保存。';
  if (!isEdit.value && allowCreatePatient && ownerDefaultsReady.value && !ownerDefaultsComplete.value) {
    return '无法从当前用户信息推导患者归属，已停止新增；请先由后端确认归属字段。';
  }
  return '';
});
const saveDisabled = computed(() => Boolean(saveDisabledReason.value));

const form = reactive({
  name: '',
  sex: 0,
  idNumber: '',
  birthday: '',
  phone: '',
  guardianName: '',
  guardianPhone: '',
  patientNumber: '',
  admissionNumber: '',
  sickroomNumber: '',
  sickbedNumber: '',
  homeAddress: '',
});

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  sex: [{ required: true, message: '请选择性别', trigger: 'change' }],
  idNumber: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  birthday: [{ required: true, message: '请选择生日', trigger: 'change' }],
  phone: [{ required: true, message: '请输入电话', trigger: 'blur' }],
  guardianName: [{ required: true, message: '请输入家属姓名', trigger: 'blur' }],
  guardianPhone: [{ required: true, message: '请输入家属电话', trigger: 'blur' }],
  patientNumber: [{ required: true, message: '请输入门诊号', trigger: 'blur' }],
  admissionNumber: [{ required: true, message: '请输入住院号', trigger: 'blur' }],
};

function normalizeDate(value) {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

function fillForm(patient) {
  const guardian = (patient.guardianList || [])[0] || {};
  original.value = patient || {};
  const nextForm = {
    name: patient.name || '',
    sex: patient.sex === null || patient.sex === undefined ? 0 : Number(patient.sex),
    idNumber: patient.idNumber || '',
    birthday: normalizeDate(patient.birthday),
    phone: patient.phone || '',
    guardianName: guardian.name || '',
    guardianPhone: guardian.phone || '',
    patientNumber: patient.patientNumber || '',
    admissionNumber: patient.admissionNumber || '',
    sickroomNumber: patient.sickroomNumber || '',
    sickbedNumber: patient.sickbedNumber || '',
    homeAddress: patient.homeAddress || '',
  };
  Object.assign(form, nextForm);
  initialForm.value = { ...nextForm };
}

async function loadOwnerDefaults() {
  if (isEdit.value || isReadOnlyMode) {
    ownerDefaultsReady.value = true;
    return;
  }
  try {
    const info = await getInfo();
    ownerDefaults.value = inferArchiveOwner(info);
  } catch {
    ownerDefaults.value = inferArchiveOwner(getUser());
  } finally {
    ownerDefaultsReady.value = true;
  }
}

function buildPayload() {
  return buildPatientPayload({
    form,
    original: original.value,
    patientId: props.id,
    ownerDefaults: ownerDefaults.value,
    isEdit: isEdit.value,
  });
}

async function load() {
  if (!props.id) return;
  loading.value = true;
  try {
    const result = await getPatient(props.id);
    fillForm(result || {});
  } catch (error) {
    ElMessage.error(error.message || '加载患者失败');
  } finally {
    loading.value = false;
  }
}

function cancel() {
  if (props.id) {
    router.push(`/patients/${props.id}`);
    return;
  }
  router.push('/patients');
}

async function submit() {
  if (saveDisabled.value) {
    ElMessage.warning(saveDisabledReason.value);
    return;
  }
  try {
    if (isEdit.value) {
      assertPatientWriteAllowed(props.id, '当前患者不在写入灰度 allow-list，禁止编辑患者');
    } else {
      assertCreatePatientAllowed();
    }
  } catch (error) {
    ElMessage.warning(error.message || '写入灰度 guard 未通过');
    return;
  }
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload = buildPayload();
    if (!isEdit.value && (!payload.deptId || !payload.hospitalId || !payload.attendingDoctor)) {
      ElMessage.error('无法从当前用户信息推导患者归属，已停止新增；请先由后端确认归属字段。');
      return;
    }
    const result = isEdit.value ? await updatePatient(payload) : await addPatient(payload);
    ElMessage.success(isEdit.value ? '患者已更新' : '患者已新增');
    const targetId = props.id || (typeof result === 'number' || typeof result === 'string' ? result : result?.id);
    router.push(targetId ? `/patients/${targetId}` : '/patients');
  } catch (error) {
    ElMessage.error(error.message || '保存患者失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([load(), loadOwnerDefaults()]);
});
</script>
