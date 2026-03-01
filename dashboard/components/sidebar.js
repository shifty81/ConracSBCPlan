'use strict';

var SidebarComponent = (function () {
  function init() {
    var links = document.querySelectorAll('.nav-link');
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var tab = this.getAttribute('data-tab');
        setActive(tab);
        if (typeof NexusApp !== 'undefined') {
          NexusApp.switchTab(tab);
        }
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
      });
    });
  }

  function setActive(tabName) {
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === tabName);
    });
  }

  return { init: init, setActive: setActive };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SidebarComponent;
}
