'use strict';

var PumpPanel = (function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function render(devices) {
    var el = document.getElementById('pump-list');
    if (!el) return;

    if (!devices || !devices.length) {
      el.innerHTML = '<p class="placeholder">No pumps found</p>';
      return;
    }

    el.innerHTML = devices.map(function (d) {
      var status = (d.status || 'idle').toLowerCase();
      var detail = '';
      if (status === 'active') {
        detail = esc(d.user || '') + ' — ' + esc(d.gallons || 0) + ' gal';
      }
      return '<div class="pump-item" data-id="' + esc(d.id) + '">' +
        '<div>' +
        '<div class="pump-name">' + esc(d.name || 'Pump ' + d.id) + '</div>' +
        (detail ? '<div class="pump-detail">' + detail + '</div>' : '') +
        '</div>' +
        '<span class="pump-status ' + status + '">' + status + '</span>' +
        '</div>';
    }).join('');

    // Click handler for detail view
    el.querySelectorAll('.pump-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        showDetail(id, devices);
      });
    });
  }

  function showDetail(id, devices) {
    var pump = devices.find(function (d) { return String(d.id) === String(id); });
    if (!pump) return;
    // Simple detail - could be expanded to a modal
    var el = document.getElementById('pump-list');
    var existing = el.querySelector('.pump-detail-view');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'pump-detail-view panel';
    div.style.marginTop = '8px';
    div.innerHTML = '<h3>Pump ' + esc(pump.id) + '</h3>' +
      '<p>Status: ' + esc(pump.status) + '</p>' +
      (pump.user ? '<p>User: ' + esc(pump.user) + '</p>' : '') +
      (pump.gallons ? '<p>Gallons: ' + esc(pump.gallons) + '</p>' : '') +
      '<button class="btn btn-small pump-detail-close">Close</button>';
    el.appendChild(div);
    div.querySelector('.pump-detail-close').addEventListener('click', function () { div.remove(); });
  }

  return { render: render };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PumpPanel;
}
