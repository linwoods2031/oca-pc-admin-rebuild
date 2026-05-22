<template>
  <section class="shell">
    <aside class="side">
      <div class="brand">老年综合<br />评估后台</div>
      <router-link class="nav-link" to="/patients">患者管理</router-link>
      <router-link class="nav-link" to="/follow-up">回访管理</router-link>
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <h1 class="page-title">电脑端后台重建版</h1>
          <div class="subtle">当前用于替代源码丢失后的可维护前端</div>
        </div>
        <div>
          <span class="subtle" style="margin-right: 14px">{{ user.nickName || user.userName || '已登录' }}</span>
          <el-button @click="logout">退出</el-button>
        </div>
      </header>
      <el-alert
        class="gray-warning"
        type="warning"
        :closable="false"
        show-icon
        :title="grayBannerTitle"
        :description="grayBannerMessage"
      />
      <router-view />
    </main>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { clearSession, getUser } from '../session.js';
import { grayBannerMessage, grayBannerTitle } from '../config/runtime.js';

const router = useRouter();
const user = getUser();

function logout() {
  clearSession();
  router.replace('/login');
}
</script>
