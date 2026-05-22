<template>
  <section v-loading="loading" class="panel">
    <div class="form-header">
      <div>
        <el-button link @click="cancel">返回</el-button>
        <h2>{{ isEdit ? '编辑患者' : '新增患者' }}</h2>
      </div>
      <el-tooltip :disabled="!isReadOnlyMode" :content="writeDisabledMessage" placement="top">
        <span>
          <el-button type="primary" :disabled="isReadOnlyMode" :loading="saving" @click="submit">保存</el-button>
        </span>
      </el-tooltip>
    </div>

    <el-alert
      v-if="isReadOnlyMode"
      type="warning"
      :closable="false"
      :title="writeDisabledMessage"
      style="margin-top: 14px"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="patient-form" :disabled="isReadOnlyMode">
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
import { isReadOnlyMode, writeDisabledMessage } from '../config/runtime.js';
import { getUser } from '../session.js';

const props = defineProps({ id: { type: String, default: '' } });
const router = useRouter();
const isEdit = computed(() => Boolean(props.id));
const loading = ref(false);
const saving = ref(false);
const formRef = ref(null);
const original = ref({});
const initialForm = ref({});
const ownerDefaults = ref({});

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

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function compact(payload, { keepEmpty = false } = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (keepEmpty ? value !== undefined : value !== '' && value !== null && value !== undefined)),
  );
}

function inferArchiveOwner(source = {}) {
  const user = source.user || source;
  const dept = source.dept || user.dept || (Array.isArray(source.depts) ? source.depts[0] : null);
  return compact({
    deptId: firstDefined(user.deptId, dept?.deptId, dept?.id),
    hospitalId: firstDefined(user.hospitalId, dept?.hospitalId, source.hospitalId),
    attendingDoctor: firstDefined(user.attendingDoctor, user.userId, user.id),
  });
}

async function loadOwnerDefaults() {
  if (isEdit.value || isReadOnlyMode) return;
  try {
    const info = await getInfo();
    ownerDefaults.value = inferArchiveOwner(info);
  } catch {
    ownerDefaults.value = inferArchiveOwner(getUser());
  }
}

function buildPayload() {
  const owner = {
    deptId: firstDefined(original.value.deptId, ownerDefaults.value.deptId),
    hospitalId: firstDefined(original.value.hospitalId, ownerDefaults.value.hospitalId),
    attendingDoctor: firstDefined(original.value.attendingDoctor, ownerDefaults.value.attendingDoctor),
  };
  const payload = compact({
    id: props.id ? Number(props.id) : undefined,
    name: form.name,
    sex: form.sex,
    idNumber: form.idNumber,
    birthday: form.birthday,
    phone: form.phone,
    patientNumber: form.patientNumber,
    admissionNumber: form.admissionNumber,
    homeAddress: form.homeAddress,
    deptId: owner.deptId,
    hospitalId: owner.hospitalId,
    attendingDoctor: owner.attendingDoctor,
    guardianList: [
      compact({
        id: original.value.guardianList?.[0]?.id,
        patientId: original.value.guardianList?.[0]?.patientId ?? (props.id ? Number(props.id) : undefined),
        name: form.guardianName,
        phone: form.guardianPhone,
      }, { keepEmpty: isEdit.value }),
    ],
  }, { keepEmpty: isEdit.value });

  payload.sickroomNumber = form.sickroomNumber;
  payload.sickbedNumber = form.sickbedNumber;
  return compact(payload, { keepEmpty: isEdit.value });
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
  if (isReadOnlyMode) {
    ElMessage.warning(writeDisabledMessage);
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
