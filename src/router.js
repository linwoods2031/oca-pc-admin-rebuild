import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from './session.js';
import LoginView from './views/LoginView.vue';
import LayoutView from './views/LayoutView.vue';
import PatientsView from './views/PatientsView.vue';
import FollowUpView from './views/FollowUpView.vue';
import PatientDetailView from './views/PatientDetailView.vue';
import PatientFormView from './views/PatientFormView.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: LayoutView,
      children: [
        { path: '', redirect: '/patients' },
        { path: 'patients', component: PatientsView },
        { path: 'follow-up', component: FollowUpView },
        { path: 'patients/new', component: PatientFormView },
        { path: 'patients/:id/edit', component: PatientFormView, props: true },
        { path: 'patients/:id', component: PatientDetailView, props: true },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.path !== '/login' && !getToken()) return '/login';
  if (to.path === '/login' && getToken()) return '/patients';
  return true;
});
