'use strict';

var ApiClient = (function () {
  var baseUrl = '';

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var token = sessionStorage.getItem('nexus_token');
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function handleResponse(res) {
    if (res.status === 401) {
      sessionStorage.removeItem('nexus_token');
      if (typeof NexusApp !== 'undefined') {
        document.getElementById('login-overlay').hidden = false;
        document.getElementById('dashboard').hidden = true;
      }
      throw new Error('Unauthorized');
    }
    return res.json();
  }

  function get(path) {
    return fetch(baseUrl + path, { method: 'GET', headers: headers() }).then(handleResponse);
  }

  function post(path, data) {
    return fetch(baseUrl + path, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse);
  }

  return {
    get: get,
    post: post,
    getDevices:        function () { return get('/api/telemetry/devices'); },
    getEvents:         function () { return get('/api/events'); },
    getTransactions:   function () { return get('/api/events/transactions'); },
    getTankStatus:     function () { return get('/api/telemetry/tanks'); },
    getForms:          function () { return get('/api/forms'); },
    getVendors:        function () { return get('/api/vendors'); },
    getWorkforceStatus:function () { return get('/api/workforce'); }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
}
