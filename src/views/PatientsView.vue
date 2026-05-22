<template>
  <section class="panel">
    <div class="toolbar">
      <el-input v-model="query.name" placeholder="姓名" clearable @keyup.enter="load" />
      <el-input v-model="query.patientNumber" placeholder="门诊号" clearable @keyup.enter="load" />
      <el-input v-model="query.admissionNumber" placeholder="住院号" clearable @keyup.enter="load" />
      <el-button type="primary" :loading="loading" @click="load">搜索</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button type="success" @click="$router.push('/patients/new')">新增患者</el-button>
    </div>
    <el-table v-loading="loading" :data="rows" stripe height="calc(100vh - 238px)">
      <el-table-column prop="name" label="姓名" min-width="110" fixed />
      <el-table-column label="性别" width="80">
        <template #default="{ row }">{{ sexText(row.sex) }}</template>
      </el-table-column>
      <el-table-column prop="age" label="年龄" width="80" />
      <el-table-column prop="patientNumber" label="门诊号" min-width="130" />
      <el-table-column prop="admissionNumber" label="住院号" min-width="130" />
      <el-table-column prop="sickroomNumber" label="病房号" min-width="110" />
      <el-table-column prop="sickbedNumber" label="病床号" min-width="110" />
      <el-table-column prop="phone" label="电话" min-width="140" />
      <el-table-column label="预计复诊" min-width="130">
        <template #default="{ row }">{{ dateText(row.nextVisitDate) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/patients/${row.id}`)">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="query.pageNum"
      v-model:page-size="query.pageSize"
      layout="total, sizes, prev, pager, next"
      :total="total"
      style="margin-top: 16px"
      @change="load"
    />
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getPatients } from '../api/oca.js';
import { dateText, sexText } from '../format.js';

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const query = reactive({ pageNum: 1, pageSize: 20, name: '', patientNumber: '', admissionNumber: '' });

async function load() {
  loading.value = true;
  try {
    const result = await getPatients(query);
    rows.value = result.rows || [];
    total.value = result.total || 0;
  } catch (error) {
    ElMessage.error(error.message || '加载患者失败');
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(query, { pageNum: 1, name: '', patientNumber: '', admissionNumber: '' });
  load();
}

onMounted(load);
</script>
