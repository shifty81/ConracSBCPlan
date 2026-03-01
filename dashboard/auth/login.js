'use strict';

var AUTH_ENDPOINT = '/api/auth/login';

function login(username, password) {
  return fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  }).then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.token) {
        sessionStorage.setItem('nexus_token', data.token);
      }
      return data;
    });
}

function logout() {
  sessionStorage.removeItem('nexus_token');
}

function getToken() {
  return sessionStorage.getItem('nexus_token');
}

function isAuthenticated() {
  return !!getToken();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { login: login, logout: logout, getToken: getToken, isAuthenticated: isAuthenticated };
}
