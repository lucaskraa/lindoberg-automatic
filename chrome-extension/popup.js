/**
 * Alura Auto 4.0 - Popup Script
 * Interface de ação rápida da extensão no navegador.
 */

document.addEventListener('DOMContentLoaded', () => {
  const extStatus = document.getElementById('extStatus');
  const aluraStatus = document.getElementById('aluraStatus');
  const autoStatus = document.getElementById('autoStatus');
  const courseTitle = document.getElementById('courseTitle');
  const lessonTitle = document.getElementById('lessonTitle');
  const toggleBtn = document.getElementById('toggleBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');

  let currentAutomationState = 'PARADO';

  function refreshState() {
    chrome.runtime.sendMessage({ action: 'HANDSHAKE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        extStatus.textContent = 'ERRO';
        extStatus.className = 'badge badge-danger';
        return;
      }

      extStatus.textContent = 'CONECTADA';
      extStatus.className = 'badge badge-ok';

      if (response.aluraTabsCount > 0) {
        aluraStatus.textContent = `${response.aluraTabsCount} ABA(S)`;
        aluraStatus.className = 'badge badge-ok';
      } else {
        aluraStatus.textContent = 'NENHUMA ABA';
        aluraStatus.className = 'badge badge-danger';
      }

      currentAutomationState = response.automationState || 'PARADO';
      autoStatus.textContent = currentAutomationState;

      if (currentAutomationState === 'EXECUTANDO') {
        autoStatus.className = 'badge badge-ok';
        toggleBtn.textContent = 'PAUSAR AUTOMAÇÃO';
        toggleBtn.className = 'btn-secondary';
      } else if (currentAutomationState === 'PAUSADO') {
        autoStatus.className = 'badge badge-warn';
        toggleBtn.textContent = 'RETOMAR AUTOMAÇÃO';
        toggleBtn.className = 'btn-primary';
      } else {
        autoStatus.className = 'badge';
        toggleBtn.textContent = 'COMEÇAR AUTOMAÇÃO';
        toggleBtn.className = 'btn-primary';
      }

      if (response.courseTitle) {
        courseTitle.textContent = response.courseTitle;
      }
      if (response.lessonTitle) {
        lessonTitle.textContent = response.lessonTitle;
      }
    });
  }

  // Ação de Iniciar / Pausar
  toggleBtn.addEventListener('click', () => {
    if (currentAutomationState === 'EXECUTANDO') {
      chrome.runtime.sendMessage({ action: 'PAUSE_AUTOMATION' }, () => {
        refreshState();
      });
    } else {
      chrome.runtime.sendMessage({ action: 'START_AUTOMATION' }, (res) => {
        if (res && !res.success) {
          alert('Aviso: ' + (res.error || 'Não foi possível iniciar a automação.'));
        }
        refreshState();
      });
    }
  });

  // Ação de Abrir Painel
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.query({}, (tabs) => {
      // Procura por aba existente do painel ou abre nova
      const dashboardTab = tabs.find(t => t.url && (t.url.includes('github.io') || t.url.includes('run.app') || t.url.includes('localhost:3000')));
      if (dashboardTab && dashboardTab.id) {
        chrome.tabs.update(dashboardTab.id, { active: true });
      } else {
        chrome.tabs.create({ url: 'https://cursos.alura.com.br' });
      }
    });
  });

  // Atualização inicial e intervalo contínuo
  refreshState();
  setInterval(refreshState, 2000);
});
