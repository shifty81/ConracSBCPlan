'use strict';

var TankGauges = (function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function gaugeColor(pct) {
    if (pct > 50) return '#3fb950';
    if (pct > 25) return '#d29922';
    return '#f85149';
  }

  function render(tanks) {
    var el = document.getElementById('tank-gauges');
    if (!el) return;

    if (!tanks || !tanks.length) {
      el.innerHTML = '<p class="placeholder">No tank data</p>';
      return;
    }

    el.innerHTML = tanks.map(function (t) {
      var capacity = t.capacity || 1;
      var level = t.level || 0;
      var pct = Math.min(100, Math.max(0, Math.round((level / capacity) * 100)));
      var color = gaugeColor(pct);
      var h = 80, w = 60;
      var fill = h * pct / 100;

      return '<div class="tank-card">' +
        '<div class="tank-label">' + esc(t.name || 'Tank') + '</div>' +
        '<svg class="gauge-svg" width="' + w + '" height="' + (h + 4) + '" viewBox="0 0 ' + w + ' ' + (h + 4) + '" role="img" aria-label="' + esc(t.name) + ' at ' + pct + '%">' +
        '<rect x="1" y="2" width="' + (w - 2) + '" height="' + h + '" rx="4" fill="none" stroke="#30363d" stroke-width="2"/>' +
        '<rect x="3" y="' + (h + 2 - fill) + '" width="' + (w - 6) + '" height="' + fill + '" rx="2" fill="' + color + '" opacity="0.85"/>' +
        '<text x="' + (w / 2) + '" y="' + (h / 2 + 4) + '" text-anchor="middle" fill="#e6edf3" font-size="14" font-weight="bold">' + pct + '%</text>' +
        '</svg>' +
        '<div class="tank-value" style="color:' + color + '">' + esc(level) + ' / ' + esc(capacity) + ' gal</div>' +
        '</div>';
    }).join('');
  }

  return { render: render, gaugeColor: gaugeColor };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TankGauges;
}
