const TOKEN_KEY = 'oca_admin_token';
const USER_KEY = 'oca_admin_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  } catch {
    return {};
  }
}
