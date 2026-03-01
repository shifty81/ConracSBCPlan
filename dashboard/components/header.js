'use strict';

var HeaderComponent = (function () {
  function update(data) {
    if (!data) return;

    if (data.dailyFuel != null) {
      document.getElementById('daily-fuel').textContent =
        Number(data.dailyFuel).toLocaleString() + ' gal';
    }

    var alarms = data.alarms || [];
    var count = alarms.length;
    var severity = 'green';
    alarms.forEach(function (a) {
      if (a.severity === 'critical') severity = 'red';
      else if (a.severity === 'warning' && severity !== 'red') severity = 'yellow';
    });

    document.getElementById('alert-count').textContent =
      count + ' Alert' + (count !== 1 ? 's' : '');
    var dot = document.querySelector('.alert-dot');
    if (dot) dot.className = 'alert-dot ' + severity;
  }

  function setUser(username) {
    document.getElementById('current-user').textContent = username || '—';
  }

  return { update: update, setUser: setUser };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeaderComponent;
}
