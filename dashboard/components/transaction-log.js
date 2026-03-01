'use strict';

var TransactionLog = (function () {
  var transactions = [];
  var sortField = 'time';
  var sortAsc = false;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function render(txns) {
    if (txns) transactions = txns;
    var filter = (document.getElementById('txn-search').value || '').toLowerCase();
    var filtered = transactions.filter(function (t) {
      if (!filter) return true;
      return (t.user || '').toLowerCase().indexOf(filter) !== -1 ||
             (t.company || '').toLowerCase().indexOf(filter) !== -1 ||
             (t.pump || '').toLowerCase().indexOf(filter) !== -1 ||
             (t.status || '').toLowerCase().indexOf(filter) !== -1;
    });

    // Sort
    filtered.sort(function (a, b) {
      var va = a[sortField] || '', vb = b[sortField] || '';
      if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    var body = document.getElementById('txn-body');
    if (!body) return;

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="7" class="placeholder">No transactions</td></tr>';
      return;
    }

    body.innerHTML = filtered.map(function (t) {
      return '<tr>' +
        '<td>' + esc(t.time || t.timestamp || '') + '</td>' +
        '<td>' + esc(t.pump || '') + '</td>' +
        '<td>' + esc(t.user || '') + '</td>' +
        '<td>' + esc(t.company || '') + '</td>' +
        '<td>' + esc(t.gallons || '') + '</td>' +
        '<td>' + esc(t.amount != null ? '$' + Number(t.amount).toFixed(2) : '') + '</td>' +
        '<td><span class="status-badge ' + esc((t.status || '').toLowerCase()) + '">' + esc(t.status || '') + '</span></td>' +
        '</tr>';
    }).join('');
  }

  function init() {
    // Sort headers
    document.querySelectorAll('#txn-table th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var field = this.getAttribute('data-sort');
        if (sortField === field) { sortAsc = !sortAsc; } else { sortField = field; sortAsc = true; }
        render();
      });
    });
  }

  return { render: render, init: init };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TransactionLog;
}
