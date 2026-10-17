/**
 * Alura Auto 4.0 - Bridge Content Script
 * Faz a ponte de comunicação segura entre a página do painel (GitHub Pages/local)
 * e o Background Service Worker da extensão Chrome.
 */

(function () {
  const BRIDGE_VERSION = '4.0.0';

  // Injeta elemento sentinela no DOM para detecção de presença imediata
  function injectSentinel() {
    if (document.getElementById('alura-auto-extension-bridge')) return;
    const sentinel = document.createElement('div');
    sentinel.id = 'alura-auto-extension-bridge';
    sentinel.setAttribute('data-version', BRIDGE_VERSION);
    sentinel.setAttribute('data-installed', 'true');
    sentinel.setAttribute('data-timestamp', Date.now().toString());
    sentinel.style.display = 'none';
    (document.head || document.documentElement).appendChild(sentinel);
  }

  // Tenta injetar logo no início
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSentinel);
  } else {
    injectSentinel();
  }

  // Envia anúncio inicial para a página
  window.postMessage({
    source: 'ALURA_AUTO_CONTENT_BRIDGE',
    type: 'EXTENSION_DETECTED',
    payload: {
      version: BRIDGE_VERSION,
      installed: true,
      timestamp: Date.now()
    }
  }, '*');

  // Escuta requisições vindas da página web do painel
  window.addEventListener('message', async (event) => {
    // Valida origem da mensagem
    if (!event.data || event.data.source !== 'ALURA_AUTO_PAGE') {
      return;
    }

    const { type, messageId, payload } = event.data;

    // Verifica integridade do runtime do Chrome
    if (!chrome.runtime || !chrome.runtime.id) {
      window.postMessage({
        source: 'ALURA_AUTO_CONTENT_BRIDGE',
        type: 'ERROR',
        messageId: messageId,
        error: 'Extensão descarregada ou recarregada no Chrome. Recarregue a página.'
      }, '*');
      return;
    }

    try {
      let bgAction = '';
      let bgData = {};

      switch (type) {
        case 'HANDSHAKE_REQUEST':
          bgAction = 'HANDSHAKE';
          bgData = payload || {};
          break;

        case 'PING':
          bgAction = 'PING';
          break;

        case 'START_AUTOMATION':
          bgAction = 'START_AUTOMATION';
          break;

        case 'PAUSE_AUTOMATION':
          bgAction = 'PAUSE_AUTOMATION';
          break;

        case 'STOP_AUTOMATION':
          bgAction = 'STOP_AUTOMATION';
          break;

        case 'QUERY_STATUS':
          bgAction = 'QUERY_ALURA_STATUS';
          break;

        default:
          bgAction = type;
          bgData = payload || {};
      }

      // Envia para o background service worker
      chrome.runtime.sendMessage({
        action: bgAction,
        ...bgData,
        messageId: messageId,
        sourceOrigin: window.location.origin
      }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            source: 'ALURA_AUTO_CONTENT_BRIDGE',
            type: 'RESPONSE_ERROR',
            replyTo: messageId,
            error: chrome.runtime.lastError.message
          }, '*');
          return;
        }

        window.postMessage({
          source: 'ALURA_AUTO_CONTENT_BRIDGE',
          type: type + '_ACK',
          replyTo: messageId,
          payload: response || {}
        }, '*');
      });
    } catch (err) {
      window.postMessage({
        source: 'ALURA_AUTO_CONTENT_BRIDGE',
        type: 'RESPONSE_ERROR',
        replyTo: messageId,
        error: err.message || 'Erro interno na ponte da extensão.'
      }, '*');
    }
  });

  // Escuta mensagens vindas do Background Service Worker e repassa para a página
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.source === 'ALURA_AUTO_BACKGROUND') {
      window.postMessage({
        source: 'ALURA_AUTO_CONTENT_BRIDGE',
        type: message.type,
        payload: message
      }, '*');
      sendResponse({ receivedByBridge: true });
    }
  });

  console.log('[Alura Auto 4.0] Bridge content script inicializado.');
})();
