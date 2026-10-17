/**
 * Alura Auto 4.0 - Background Service Worker (Manifest V3)
 * Gerencia ciclo de vida, persistência, comunicação de abas e automação.
 */

const EXTENSION_VERSION = '4.0.0';

// Estado em memória (reidratado via chrome.storage.local ao acordar)
let appState = {
  automationState: 'PARADO', // 'PARADO' | 'INICIANDO' | 'EXECUTANDO' | 'PAUSADO' | 'ERRO'
  targetTabId: null,
  courseTitle: '',
  lessonTitle: '',
  videoStatus: {
    state: 'idle', // 'idle' | 'playing' | 'paused' | 'ended'
    currentTime: 0,
    duration: 0,
    progress: 0,
    muted: false
  },
  currentActivity: null,
  lastError: null,
  lastHeartbeat: Date.now()
};

// Carrega estado persistido
async function initStorage() {
  try {
    const data = await chrome.storage.local.get(['aluraAutoState']);
    if (data && data.aluraAutoState) {
      appState = { ...appState, ...data.aluraAutoState };
      // Se estava executando antes de suspensão, verificar se a aba ainda existe
      if (appState.targetTabId) {
        try {
          const tab = await chrome.tabs.get(appState.targetTabId);
          if (!tab || !tab.url || !tab.url.includes('alura.com.br')) {
            appState.targetTabId = null;
            if (appState.automationState === 'EXECUTANDO') {
              appState.automationState = 'PARADO';
            }
          }
        } catch {
          appState.targetTabId = null;
          if (appState.automationState === 'EXECUTANDO') {
            appState.automationState = 'PARADO';
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Alura Auto BG] Falha ao recuperar storage:', err);
  }
}

async function persistState() {
  try {
    await chrome.storage.local.set({ aluraAutoState: appState });
  } catch (err) {
    console.warn('[Alura Auto BG] Falha ao persistir storage:', err);
  }
}

// Procura abas da Alura
async function findAluraTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: ['*://*.alura.com.br/*', '*://cursos.alura.com.br/*']
    });
    return tabs || [];
  } catch (err) {
    console.error('[Alura Auto BG] Erro ao buscar abas da Alura:', err);
    return [];
  }
}

// Envia mensagem para todas as abas que têm o script de ponte (painel)
async function broadcastToBridges(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, {
          source: 'ALURA_AUTO_BACKGROUND',
          ...message
        }).catch(() => {
          // Ignora abas sem content script da ponte
        });
      }
    }
  } catch (err) {
    console.warn('[Alura Auto BG] Erro ao transmitir para bridge:', err);
  }
}

// Processador de mensagens do runtime
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsyncMessage = async () => {
    const action = request.action || request.type;

    switch (action) {
      case 'HANDSHAKE': {
        const aluraTabs = await findAluraTabs();
        const activeAluraTab = aluraTabs.length > 0 ? aluraTabs[0] : null;

        sendResponse({
          success: true,
          version: EXTENSION_VERSION,
          extensionState: 'EXTENSÃO CONECTADA',
          aluraTabsCount: aluraTabs.length,
          activeAluraTab: activeAluraTab ? {
            id: activeAluraTab.id,
            title: activeAluraTab.title,
            url: activeAluraTab.url
          } : null,
          automationState: appState.automationState,
          courseTitle: appState.courseTitle,
          lessonTitle: appState.lessonTitle,
          videoStatus: appState.videoStatus,
          timestamp: Date.now()
        });
        break;
      }

      case 'PING': {
        const aluraTabs = await findAluraTabs();
        appState.lastHeartbeat = Date.now();
        sendResponse({
          success: true,
          type: 'PONG',
          version: EXTENSION_VERSION,
          aluraTabsCount: aluraTabs.length,
          activeTabId: appState.targetTabId,
          automationState: appState.automationState,
          timestamp: Date.now()
        });
        break;
      }

      case 'QUERY_ALURA_STATUS': {
        const aluraTabs = await findAluraTabs();
        const activeTab = aluraTabs.length > 0 ? aluraTabs[0] : null;
        sendResponse({
          success: true,
          tabsCount: aluraTabs.length,
          activeTab: activeTab ? { id: activeTab.id, title: activeTab.title, url: activeTab.url } : null,
          automationState: appState.automationState
        });
        break;
      }

      case 'START_AUTOMATION': {
        const aluraTabs = await findAluraTabs();
        if (aluraTabs.length === 0) {
          appState.automationState = 'ERRO';
          appState.lastError = 'Nenhuma aba da Alura encontrada para iniciar a automação.';
          await persistState();
          sendResponse({
            success: false,
            error: appState.lastError,
            automationState: appState.automationState
          });
          return;
        }

        // Seleciona a aba alvo (preferencialmente cursos.alura.com.br/course/)
        let chosenTab = aluraTabs.find(t => t.url && t.url.includes('/course/')) || aluraTabs[0];
        appState.targetTabId = chosenTab.id;
        appState.automationState = 'INICIANDO';
        appState.lastError = null;
        await persistState();

        try {
          // Notifica a aba da Alura para iniciar observação e reprodução
          const tabResponse = await chrome.tabs.sendMessage(chosenTab.id, {
            action: 'START_MONITORING'
          });

          appState.automationState = 'EXECUTANDO';
          await persistState();

          sendResponse({
            success: true,
            automationState: appState.automationState,
            targetTab: { id: chosenTab.id, title: chosenTab.title, url: chosenTab.url },
            details: tabResponse
          });

          broadcastToBridges({
            type: 'AUTOMATION_STATE_CHANGED',
            automationState: 'EXECUTANDO',
            targetTabId: chosenTab.id
          });
        } catch (tabErr) {
          console.warn('[Alura Auto BG] Não foi possível contatar content script da aba:', tabErr);
          // O script pode ainda estar carregando, manter em execução e tentar
          appState.automationState = 'EXECUTANDO';
          await persistState();
          sendResponse({
            success: true,
            automationState: 'EXECUTANDO',
            warning: 'Aba da Alura conectada. Aguardando prontidão do player.',
            targetTab: { id: chosenTab.id, title: chosenTab.title }
          });
        }
        break;
      }

      case 'PAUSE_AUTOMATION': {
        appState.automationState = 'PAUSADO';
        await persistState();

        if (appState.targetTabId) {
          try {
            await chrome.tabs.sendMessage(appState.targetTabId, {
              action: 'PAUSE_MONITORING'
            });
          } catch {
            // Ignora se a aba já não responde
          }
        }

        sendResponse({
          success: true,
          automationState: 'PAUSADO'
        });

        broadcastToBridges({
          type: 'AUTOMATION_STATE_CHANGED',
          automationState: 'PAUSADO'
        });
        break;
      }

      case 'STOP_AUTOMATION': {
        appState.automationState = 'PARADO';
        await persistState();

        if (appState.targetTabId) {
          try {
            await chrome.tabs.sendMessage(appState.targetTabId, {
              action: 'STOP_MONITORING'
            });
          } catch {
            // Ignora erro
          }
        }

        sendResponse({
          success: true,
          automationState: 'PARADO'
        });

        broadcastToBridges({
          type: 'AUTOMATION_STATE_CHANGED',
          automationState: 'PARADO'
        });
        break;
      }

      // Mensagens vindas do content script alura.js
      case 'ALURA_TELEMETRY': {
        if (request.courseTitle) appState.courseTitle = request.courseTitle;
        if (request.lessonTitle) appState.lessonTitle = request.lessonTitle;
        if (request.videoStatus) appState.videoStatus = request.videoStatus;
        if (request.activity !== undefined) appState.currentActivity = request.activity;
        if (sender.tab && sender.tab.id) appState.targetTabId = sender.tab.id;

        await persistState();

        // Propaga evento para o painel de controle
        broadcastToBridges({
          type: 'ALURA_TELEMETRY_UPDATE',
          courseTitle: appState.courseTitle,
          lessonTitle: appState.lessonTitle,
          videoStatus: appState.videoStatus,
          activity: appState.currentActivity,
          tabId: sender.tab ? sender.tab.id : null,
          tabUrl: sender.tab ? sender.tab.url : null
        });

        sendResponse({ received: true });
        break;
      }

      case 'ALURA_LESSON_ADVANCED': {
        broadcastToBridges({
          type: 'LESSON_ADVANCED_EVENT',
          previousLesson: request.previousLesson,
          nextLesson: request.nextLesson,
          timestamp: Date.now()
        });
        sendResponse({ acknowledged: true });
        break;
      }

      case 'ALURA_ACTIVITY_DETECTED': {
        appState.currentActivity = request.activity;
        await persistState();

        broadcastToBridges({
          type: 'ACTIVITY_ALERT',
          activity: request.activity
        });
        sendResponse({ acknowledged: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Ação não reconhecida: ' + action });
        break;
    }
  };

  handleAsyncMessage();
  return true; // Mantém o canal aberto para resposta assíncrona
});

// Trata fechamento de abas
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === appState.targetTabId) {
    appState.targetTabId = null;
    const remainingAlura = await findAluraTabs();

    if (remainingAlura.length > 0) {
      appState.targetTabId = remainingAlura[0].id;
      broadcastToBridges({
        type: 'ALURA_TAB_CHANGED',
        message: 'Aba anterior fechada. Alternado para outra aba da Alura aberta.',
        newTabId: appState.targetTabId
      });
    } else {
      if (appState.automationState === 'EXECUTANDO') {
        appState.automationState = 'PARADO';
        appState.lastError = 'Aba da Alura foi fechada. Automação interrompida.';
      }
      await persistState();

      broadcastToBridges({
        type: 'ALURA_TAB_CLOSED',
        automationState: appState.automationState,
        error: appState.lastError
      });
    }
  }
});

// Trata recarregamento / navegação de abas
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('alura.com.br')) {
    if (changeInfo.status === 'complete') {
      if (tabId === appState.targetTabId && appState.automationState === 'EXECUTANDO') {
        // Envia comando para reativar monitoramento após recarregamento da página
        try {
          await chrome.tabs.sendMessage(tabId, { action: 'START_MONITORING' });
        } catch (e) {
          console.log('[Alura Auto BG] Aguardando injeção do content script na nova URL...');
        }
      }

      broadcastToBridges({
        type: 'ALURA_TAB_UPDATED',
        tabId: tab.id,
        url: tab.url,
        title: tab.title
      });
    }
  }
});

// Inicialização
initStorage();
console.log('[Alura Auto 4.0] Background Service Worker inicializado com sucesso.');
