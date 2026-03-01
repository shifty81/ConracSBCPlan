'use strict';

var FormPanel = (function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function render(forms) {
    var body = document.getElementById('forms-body');
    if (!body) return;

    if (!forms || !forms.length) {
      body.innerHTML = '<tr><td colspan="4" class="placeholder">No form submissions</td></tr>';
      renderComplianceSummary(0, 0, 0);
      return;
    }

    var completed = 0, pending = 0, overdue = 0;
    forms.forEach(function (f) {
      var st = (f.status || '').toLowerCase();
      if (st === 'completed') completed++;
      else if (st === 'overdue') overdue++;
      else pending++;
    });

    renderComplianceSummary(completed, pending, overdue);

    // Populate template selector
    var templates = [];
    forms.forEach(function (f) {
      if (f.template && templates.indexOf(f.template) === -1) templates.push(f.template);
    });
    var sel = document.getElementById('form-template-select');
    if (sel) {
      var opts = '<option value="">All templates</option>';
      templates.forEach(function (t) {
        opts += '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      });
      sel.innerHTML = opts;
    }

    body.innerHTML = forms.map(function (f) {
      var st = (f.status || '').toLowerCase();
      return '<tr>' +
        '<td>' + esc(f.date || f.submittedAt || '') + '</td>' +
        '<td>' + esc(f.template || '') + '</td>' +
        '<td>' + esc(f.submittedBy || '') + '</td>' +
        '<td><span class="status-badge ' + st + '">' + esc(f.status || '') + '</span></td>' +
        '</tr>';
    }).join('');
  }

  function renderComplianceSummary(completed, pending, overdue) {
    var el = document.getElementById('compliance-summary');
    if (!el) return;
    el.innerHTML =
      '<div class="compliance-card"><div class="num" style="color:var(--green)">' + completed + '</div><div class="lbl">Completed</div></div>' +
      '<div class="compliance-card"><div class="num" style="color:var(--yellow)">' + pending + '</div><div class="lbl">Pending</div></div>' +
      '<div class="compliance-card"><div class="num" style="color:var(--red)">' + overdue + '</div><div class="lbl">Overdue</div></div>';
  }

  return { render: render };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormPanel;
}
