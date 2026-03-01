'use strict';

var NexusWebSocket = (function () {
  var ws = null;
  var listeners = {};
  var reconnectDelay = 2000;
  var maxReconnectDelay = 30000;
  var currentDelay = reconnectDelay;
  var fallbackTimer = null;

  function connect() {
    try {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/ws');

      ws.onopen = function () {
        currentDelay = reconnectDelay;
        stopFallback();
      };

      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);
          emit(msg.type, msg.data);
        } catch (_) { /* ignore */ }
      };

      ws.onclose = function () {
        scheduleReconnect();
      };

      ws.onerror = function () {
        if (ws) ws.close();
      };
    } catch (_) {
      startFallback();
    }
  }

  function scheduleReconnect() {
    setTimeout(function () {
      currentDelay = Math.min(currentDelay * 2, maxReconnectDelay);
      connect();
    }, currentDelay);
  }

  function emit(type, data) {
    if (listeners[type]) {
      listeners[type].forEach(function (fn) { fn(data); });
    }
  }

  function on(type, fn) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  }

  function off(type, fn) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter(function (f) { return f !== fn; });
  }

  // Polling fallback
  function startFallback() {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(function () {
      if (typeof NexusApp !== 'undefined' && NexusApp.isAuthenticated()) {
        NexusApp.refreshAll();
      }
    }, 5000);
  }

  function stopFallback() {
    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  }

  return { connect: connect, on: on, off: off };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexusWebSocket;
}
