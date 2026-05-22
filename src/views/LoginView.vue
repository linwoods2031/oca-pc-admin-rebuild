<template>
  <main class="login-page">
    <section class="login-card">
      <h1 class="login-title">老年综合评估后台</h1>
      <p class="subtle">源码重建版，接入当前生产 API。</p>
      <el-form :model="form" label-position="top" @keyup.enter="submit">
        <el-form-item label="账号">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" show-password />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="submit">
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { getInfo, login } from '../api/oca.js';
import { setToken, setUser } from '../session.js';

const router = useRouter();
const loading = ref(false);
const form = reactive({ username: '', password: '' });

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  loading.value = true;
  try {
    const result = await login(form.username, form.password);
    setToken(result.token);
    const info = await getInfo();
    setUser(info.user || {});
    router.replace('/patients');
  } catch (error) {
    ElMessage.error(error.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>
