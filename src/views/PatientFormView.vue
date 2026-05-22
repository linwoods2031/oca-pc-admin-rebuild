<template>
  <section v-loading="loading" class="panel">
    <div class="form-header">
      <div>
        <el-button link @click="cancel">返回</el-button>
        <h2>{{ isEdit ? '编辑患者' : '新增患者' }}</h2>
      </div>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="patient-form">
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
import { addPatient, getPatient, updatePatient } from '../api/oca.js';

const props = defineProps({ id: { type: String, default: '' } });
const router = useRouter();
const isEdit = computed(() => Boolean(props.id));
const loading = ref(false);
const saving = ref(false);
const formRef = ref(null);
const original = ref({});
const initialForm = ref({});
const fixedArchiveOwner = { deptId: 103, hospitalId: 100, attendingDoctor: 1 };

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

function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}

function buildPayload() {
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
    deptId: original.value.deptId ?? fixedArchiveOwner.deptId,
    hospitalId: original.value.hospitalId ?? fixedArchiveOwner.hospitalId,
    attendingDoctor: original.value.attendingDoctor ?? fixedArchiveOwner.attendingDoctor,
    guardianList: [
      compact({
        id: original.value.guardianList?.[0]?.id,
        patientId: original.value.guardianList?.[0]?.patientId ?? (props.id ? Number(props.id) : undefined),
        name: form.guardianName,
        phone: form.guardianPhone,
      }),
    ],
  });

  if (!isEdit.value || form.sickroomNumber !== initialForm.value.sickroomNumber) {
    payload.sickroomNumber = form.sickroomNumber;
  }
  if (!isEdit.value || form.sickbedNumber !== initialForm.value.sickbedNumber) {
    payload.sickbedNumber = form.sickbedNumber;
  }
  return compact(payload);
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
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload = buildPayload();
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

onMounted(load);
</script>
