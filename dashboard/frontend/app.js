'use strict';

var NexusApp = (function () {
  var API_BASE = window.NEXUS_API_BASE || '';
  var refreshInterval = null;
  var REFRESH_MS = 5000;

  /* ---- Auth helpers ---- */
  function getToken() { return sessionStorage.getItem('nexus_token'); }
  function setToken(t) { sessionStorage.setItem('nexus_token', t); }
  function clearToken() { sessionStorage.removeItem('nexus_token'); }
  function isAuthenticated() { return !!getToken(); }

  /* ---- API client ---- */
  function apiHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  function apiFetch(method, path, body) {
    var opts = { method: method, headers: apiHeaders() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API_BASE + path, opts).then(function (res) {
      if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
      return res.json();
    });
  }

  function apiGet(path) { return apiFetch('GET', path); }
  function apiPost(path, data) { return apiFetch('POST', path, data); }

  /* ---- API methods ---- */
  function getDevices()        { return apiGet('/api/telemetry/devices'); }
  function getEvents()         { return apiGet('/api/events'); }
  function getTransactions()   { return apiGet('/api/events/transactions'); }
  function getTankStatus()     { return apiGet('/api/telemetry/tanks'); }
  function getForms()          { return apiGet('/api/forms'); }
  function getVendors()        { return apiGet('/api/vendors'); }
  function getWorkforceStatus(){ return apiGet('/api/workforce'); }
  function getCards()          { return apiGet('/api/cards'); }

  /* ---- WebSocket ---- */
  var ws = null;
  var wsListeners = {};

  function wsConnect() {
    try {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/ws');
      ws.onmessage = function (e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type && wsListeners[msg.type]) {
            wsListeners[msg.type].forEach(function (fn) { fn(msg.data); });
          }
        } catch (_) { /* ignore parse errors */ }
      };
      ws.onclose = function () { setTimeout(wsConnect, 5000); };
      ws.onerror = function () { ws.close(); };
    } catch (_) {
      /* WebSocket unavailable — fallback to polling only */
    }
  }

  function onWsEvent(type, fn) {
    if (!wsListeners[type]) wsListeners[type] = [];
    wsListeners[type].push(fn);
  }

  /* ---- Login / Logout ---- */
  function showLogin() {
    document.getElementById('login-overlay').hidden = false;
    document.getElementById('dashboard').hidden = true;
    stopRefresh();
  }

  function showDashboard() {
    document.getElementById('login-overlay').hidden = true;
    document.getElementById('dashboard').hidden = false;
    startRefresh();
  }

  function handleLogin(e) {
    e.preventDefault();
    var user = document.getElementById('username').value;
    var pass = document.getElementById('password').value;
    var errEl = document.getElementById('login-error');
    errEl.hidden = true;

    apiPost('/api/auth/login', { username: user, password: pass })
      .then(function (data) {
        if (data.token) {
          setToken(data.token);
          document.getElementById('current-user').textContent = user;
          showDashboard();
          refreshAll();
        } else {
          errEl.textContent = data.error || 'Login failed';
          errEl.hidden = false;
        }
      })
      .catch(function () {
        errEl.textContent = 'Unable to connect to server';
        errEl.hidden = false;
      });
  }

  function handleLogout() {
    clearToken();
    showLogin();
  }

  /* ---- Tab Navigation ---- */
  function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.hidden = true; });
    var target = document.getElementById('tab-' + tabName);
    if (target) target.hidden = false;

    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === tabName);
    });
  }

  /* ---- Render Helpers ---- */
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /* ---- Pump Panel ---- */
  function renderPumps(devices) {
    var el = document.getElementById('pump-list');
    if (!devices || !devices.length) { el.innerHTML = '<p class="placeholder">No pumps found</p>'; return; }
    el.innerHTML = devices.map(function (d) {
      var st = (d.status || 'idle').toLowerCase();
      var detail = st === 'active' ? esc(d.user || '') + ' — ' + esc(d.gallons || 0) + ' gal' : '';
      return '<div class="pump-item" data-id="' + esc(d.id) + '">' +
        '<div><div class="pump-name">' + esc(d.name || 'Pump ' + d.id) + '</div>' +
        (detail ? '<div class="pump-detail">' + detail + '</div>' : '') +
        '</div><span class="pump-status ' + st + '">' + st + '</span></div>';
    }).join('');
  }

  /* ---- Tank Gauges ---- */
  function gaugeColor(pct) { return pct > 50 ? '#3fb950' : pct > 25 ? '#d29922' : '#f85149'; }

  function renderTanks(tanks) {
    var el = document.getElementById('tank-gauges');
    if (!tanks || !tanks.length) { el.innerHTML = '<p class="placeholder">No tank data</p>'; return; }
    el.innerHTML = tanks.map(function (t) {
      var pct = Math.round((t.level / (t.capacity || 1)) * 100);
      var color = gaugeColor(pct);
      var h = 80, w = 60, fill = h * pct / 100;
      return '<div class="tank-card">' +
        '<div class="tank-label">' + esc(t.name || 'Tank') + '</div>' +
        '<svg class="gauge-svg" width="' + w + '" height="' + (h + 4) + '" viewBox="0 0 ' + w + ' ' + (h + 4) + '">' +
        '<rect x="1" y="2" width="' + (w - 2) + '" height="' + h + '" rx="4" fill="none" stroke="#30363d" stroke-width="2"/>' +
        '<rect x="3" y="' + (h + 2 - fill) + '" width="' + (w - 6) + '" height="' + fill + '" rx="2" fill="' + color + '" opacity="0.85"/>' +
        '</svg>' +
        '<div class="tank-value" style="color:' + color + '">' + pct + '% (' + esc(t.level) + ' gal)</div></div>';
    }).join('');
  }

  /* ---- Transaction Log ---- */
  var allTransactions = [];

  function renderTransactions(txns) {
    if (txns) allTransactions = txns;
    var filter = (document.getElementById('txn-search').value || '').toLowerCase();
    var rows = allTransactions.filter(function (t) {
      if (!filter) return true;
      return (t.user || '').toLowerCase().indexOf(filter) !== -1 ||
             (t.company || '').toLowerCase().indexOf(filter) !== -1 ||
             (t.pump || '').toLowerCase().indexOf(filter) !== -1;
    });
    var body = document.getElementById('txn-body');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="placeholder">No transactions</td></tr>'; return; }
    body.innerHTML = rows.map(function (t) {
      return '<tr>' +
        '<td>' + esc(t.time || t.timestamp || '') + '</td>' +
        '<td>' + esc(t.pump || '') + '</td>' +
        '<td>' + esc(t.user || '') + '</td>' +
        '<td>' + esc(t.company || '') + '</td>' +
        '<td>' + esc(t.gallons || '') + '</td>' +
        '<td>' + esc(t.amount != null ? '$' + Number(t.amount).toFixed(2) : '') + '</td>' +
        '<td><span class="status-badge ' + esc((t.status || '').toLowerCase()) + '">' + esc(t.status || '') + '</span></td></tr>';
    }).join('');
  }

  /* ---- Header Stats ---- */
  function renderHeaderStats(events) {
    if (!events) return;
    var alarms = (events.alarms || []);
    var cnt = alarms.length;
    var sev = 'green';
    alarms.forEach(function (a) {
      if (a.severity === 'critical') sev = 'red';
      else if (a.severity === 'warning' && sev !== 'red') sev = 'yellow';
    });
    document.getElementById('alert-count').textContent = cnt + ' Alert' + (cnt !== 1 ? 's' : '');
    var dot = document.querySelector('.alert-dot');
    dot.className = 'alert-dot ' + sev;
    if (events.dailyFuel != null) {
      document.getElementById('daily-fuel').textContent = Number(events.dailyFuel).toLocaleString() + ' gal';
    }
  }

  /* ---- Forms Panel ---- */
  function renderForms(forms) {
    var body = document.getElementById('forms-body');
    if (!forms || !forms.length) { body.innerHTML = '<tr><td colspan="4" class="placeholder">No forms</td></tr>'; return; }

    var completed = 0, pending = 0, overdue = 0;
    forms.forEach(function (f) {
      if (f.status === 'completed') completed++;
      else if (f.status === 'overdue') overdue++;
      else pending++;
    });
    document.getElementById('compliance-summary').innerHTML =
      '<div class="compliance-card"><div class="num" style="color:var(--green)">' + completed + '</div><div class="lbl">Completed</div></div>' +
      '<div class="compliance-card"><div class="num" style="color:var(--yellow)">' + pending + '</div><div class="lbl">Pending</div></div>' +
      '<div class="compliance-card"><div class="num" style="color:var(--red)">' + overdue + '</div><div class="lbl">Overdue</div></div>';

    body.innerHTML = forms.map(function (f) {
      return '<tr><td>' + esc(f.date || '') + '</td><td>' + esc(f.template || '') + '</td>' +
        '<td>' + esc(f.submittedBy || '') + '</td>' +
        '<td><span class="status-badge ' + esc((f.status || '').toLowerCase()) + '">' + esc(f.status || '') + '</span></td></tr>';
    }).join('');
  }

  /* ---- Vendors Panel ---- */
  function renderVendors(vendors) {
    var body = document.getElementById('vendors-body');
    if (!vendors || !vendors.length) { body.innerHTML = '<tr><td colspan="5" class="placeholder">No vendors</td></tr>'; return; }
    body.innerHTML = vendors.map(function (v) {
      return '<tr><td>' + esc(v.company || '') + '</td><td>' + esc(v.contact || '') + '</td>' +
        '<td>' + esc(v.serviceType || '') + '</td><td>' + esc(v.insuranceExpiry || '') + '</td>' +
        '<td><span class="status-badge ' + esc((v.status || '').toLowerCase()) + '">' + esc(v.status || '') + '</span></td></tr>';
    }).join('');
  }

  /* ---- Workforce Panel ---- */
  function renderWorkforce(staff) {
    var body = document.getElementById('workforce-body');
    if (!staff || !staff.length) { body.innerHTML = '<tr><td colspan="5" class="placeholder">No workforce data</td></tr>'; return; }
    body.innerHTML = staff.map(function (s) {
      return '<tr><td>' + esc(s.name || '') + '</td><td>' + esc(s.role || '') + '</td>' +
        '<td><span class="status-badge ' + esc((s.status || '').toLowerCase()) + '">' + esc(s.status || '') + '</span></td>' +
        '<td>' + esc(s.clockIn || '') + '</td><td>' + esc(s.currentTask || '') + '</td></tr>';
    }).join('');
  }

  /* ---- Facility Systems ---- */
  function renderFacility(systems) {
    var el = document.getElementById('facility-systems');
    if (!systems || !systems.length) { el.innerHTML = '<p class="placeholder">No facility data</p>'; return; }
    el.innerHTML = systems.map(function (s) {
      return '<div class="facility-card"><h3>' + esc(s.name || '') + '</h3>' +
        '<div class="status-line">Status: <span class="status-badge ' + esc((s.status || '').toLowerCase()) + '">' + esc(s.status || '') + '</span></div>' +
        (s.detail ? '<div class="status-line">' + esc(s.detail) + '</div>' : '') + '</div>';
    }).join('');
  }

  /* ---- Card Management ---- */
  function renderCards(cards) {
    var el = document.getElementById('card-management');
    if (!cards || !cards.length) { el.innerHTML = '<p class="placeholder">No cards</p>'; return; }
    el.innerHTML = cards.map(function (c) {
      return '<div class="card-item"><span class="card-id">' + esc(c.cardNumber || c.id || '') +
        '</span><span class="card-holder">' + esc(c.holder || c.user || '') + '</span></div>';
    }).join('');
  }

  /* ---- Data Refresh ---- */
  function refreshAll() {
    getDevices().then(renderPumps).catch(function () {});
    getTankStatus().then(renderTanks).catch(function () {});
    getTransactions().then(renderTransactions).catch(function () {});
    getEvents().then(renderHeaderStats).catch(function () {});
    getForms().then(renderForms).catch(function () {});
    getVendors().then(renderVendors).catch(function () {});
    getWorkforceStatus().then(renderWorkforce).catch(function () {});
    getCards().then(renderCards).catch(function () {});
  }

  function startRefresh() {
    stopRefresh();
    refreshInterval = setInterval(refreshAll, REFRESH_MS);
  }

  function stopRefresh() {
    if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  }

  /* ---- Init ---- */
  function init() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Tab navigation
    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        switchTab(this.getAttribute('data-tab'));
      });
    });

    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Transaction search
    document.getElementById('txn-search').addEventListener('input', function () {
      renderTransactions();
    });

    // Check existing auth
    if (isAuthenticated()) {
      showDashboard();
      refreshAll();
      wsConnect();
    } else {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getToken: getToken,
    isAuthenticated: isAuthenticated,
    switchTab: switchTab,
    refreshAll: refreshAll,
    apiGet: apiGet,
    apiPost: apiPost,
    getDevices: getDevices,
    getEvents: getEvents,
    getTransactions: getTransactions,
    getTankStatus: getTankStatus,
    getForms: getForms,
    getVendors: getVendors,
    getWorkforceStatus: getWorkforceStatus
  };
})();
