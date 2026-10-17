/**
 * Alura Auto 4.0 - Alura Content Script
 * Injetado nas abas da Alura (*://*.alura.com.br/*)
 * Monitora DOM, controla reprodução do vídeo, detecta atividades e avança aulas com segurança.
 */

(function () {
  console.log('[Alura Auto 4.0] Content script injetado na Alura.');

  // Estado local do monitor
  let isAutomationActive = false;
  let isAdvancing = false;
  let lastAdvanceTimestamp = 0;
  let currentVideoElement = null;
  let videoListenersAttached = false;
  let lastReportedTime = 0;
  let currentUrl = window.location.href;

  // Heurísticas de Seleção de Curso
  function detectCourseTitle() {
    const candidates = [
      '.course-header-banner-title',
      '.course-header-banner-info-title',
      '.title-section .course-name',
      '.courseContent-title',
      '.course-name',
      '.breadcrumb-item:nth-last-child(2)'
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    // Tenta obter do title
    if (document.title) {
      const parts = document.title.split('|');
      if (parts.length > 1) {
        return parts[1].replace('Alura', '').trim();
      }
      return parts[0].trim();
    }

    return 'Curso Alura (Não identificado)';
  }

  // Heurísticas de Seleção de Aula/Atividade
  function detectLessonTitle() {
    const candidates = [
      '.task-body-header-title',
      '.formatted-task-title',
      '.task-title',
      '.section-task-title',
      '.title-task',
      'h1.task-header',
      '[data-task-title]'
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) {
      return h1.textContent.trim();
    }

    return 'Aula atual';
  }

  // Detecta Atividades, Exercícios ou Questionários
  function detectActivity() {
    // Procura lista de alternativas (múltipla escolha)
    const alternativeList = document.querySelector('.alternative-list, .task-body-quiz, .quiz-form, ul.task-alternatives');
    if (alternativeList) {
      const questionEl = document.querySelector('.task-body-header-title, .task-body-text, .quiz-question') || document.querySelector('h1');
      const options = Array.from(alternativeList.querySelectorAll('li, label, .alternative-item')).map(li => li.textContent.trim()).filter(Boolean);

      return {
        type: 'multipla_escolha',
        title: questionEl ? questionEl.textContent.trim() : 'Exercício de Múltipla Escolha',
        optionsCount: options.length,
        options: options.slice(0, 5),
        instructions: 'Exercício de múltipla escolha detectado. Revise e confirme antes de responder.'
      };
    }

    // Procura campo de resposta dissertativa ou código
    const textarea = document.querySelector('textarea.form-textarea, .task-body-opinion textarea, .task-body-code textarea, textarea');
    if (textarea && textarea.offsetParent !== null) {
      const promptEl = document.querySelector('.task-body-text, .task-body-header-title') || document.querySelector('h1');
      return {
        type: 'pergunta_dissertativa',
        title: promptEl ? promptEl.textContent.trim().slice(0, 100) : 'Atividade com Resposta Escrita',
        instructions: 'Exercício dissertativo ou de código detectado. Digite sua resposta e submeta.'
      };
    }

    return null;
  }

  // Encontra o elemento de vídeo na página
  function findVideoElement() {
    const video = document.querySelector('video, .video-player video, .vjs-tech');
    return video;
  }

  // Envia telemetria atualizada para o background
  function sendTelemetry(extraData = {}) {
    if (!chrome.runtime || !chrome.runtime.id) return;

    const course = detectCourseTitle();
    const lesson = detectLessonTitle();
    const video = currentVideoElement || findVideoElement();
    const activity = detectActivity();

    const videoStatus = video ? {
      state: video.ended ? 'ended' : video.paused ? 'paused' : 'playing',
      currentTime: Math.floor(video.currentTime || 0),
      duration: Math.floor(video.duration || 0),
      progress: video.duration ? Math.min(100, Math.floor((video.currentTime / video.duration) * 100)) : 0,
      muted: video.muted || false
    } : {
      state: activity ? 'exercise_mode' : 'not_found',
      currentTime: 0,
      duration: 0,
      progress: 0,
      muted: false
    };

    chrome.runtime.sendMessage({
      action: 'ALURA_TELEMETRY',
      courseTitle: course,
      lessonTitle: lesson,
      videoStatus: videoStatus,
      activity: activity,
      url: window.location.href,
      ...extraData
    }).catch(() => {
      // Ignora desconexões temporárias
    });
  }

  // Identifica com precisão o botão de próxima aula
  function findNextLessonButton() {
    // 1. Seletores específicos clássicos da Alura
    const explicitSelectors = [
      'a.task-body-link--next',
      'a.task-actions-button--next',
      'button[data-action="next"]',
      'a[data-action="next"]',
      'a.bootcamp-next-button',
      '.task-body-actions a.button--primary',
      'a[href*="/task/"][class*="next"]'
    ];

    for (const sel of explicitSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !el.disabled) {
        return el;
      }
    }

    // 2. Busca por texto nos links e botões visíveis
    const candidates = Array.from(document.querySelectorAll('a, button'));
    const nextTexts = ['avançar', 'próxima atividade', 'próxima aula', 'próximo', 'continuar'];

    for (const el of candidates) {
      if (el.offsetParent === null || el.disabled) continue; // ignora elementos invisíveis
      const text = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();

      for (const targetText of nextTexts) {
        if (text === targetText || text.startsWith(targetText) || aria.includes(targetText)) {
          // Não avançar se for link externo ou de download
          if (el.getAttribute('download') || el.href?.includes('/download/')) continue;
          return el;
        }
      }
    }

    // 3. Busca no menu lateral de tarefas: próximo item após o atual ativo
    const activeMenuItem = document.querySelector('.task-menu-nav-item--selected, [aria-current="true"]');
    if (activeMenuItem) {
      const nextSibling = activeMenuItem.nextElementSibling;
      if (nextSibling) {
        const link = nextSibling.querySelector('a');
        if (link) return link;
      }
    }

    return null;
  }

  // Avança para a próxima aula com validação anti-clique duplo e debouncing
  function advanceToNextLesson() {
    const now = Date.now();
    if (isAdvancing || now - lastAdvanceTimestamp < 3000) {
      console.log('[Alura Auto 4.0] Tentativa de avanço bloqueada pelo debounce de segurança.');
      return;
    }

    const nextBtn = findNextLessonButton();
    if (!nextBtn) {
      console.warn('[Alura Auto 4.0] Próximo botão não localizado ou final de curso atingido.');
      sendTelemetry({ warning: 'Botão de próxima aula não localizado. Verifique se o módulo foi concluído.' });
      return;
    }

    isAdvancing = true;
    lastAdvanceTimestamp = now;

    console.log('[Alura Auto 4.0] Avançando para próxima aula...');
    const currentLesson = detectLessonTitle();

    chrome.runtime.sendMessage({
      action: 'ALURA_LESSON_ADVANCED',
      previousLesson: currentLesson
    }).catch(() => {});

    // Dispara clique no elemento
    try {
      nextBtn.click();
    } catch (err) {
      console.error('[Alura Auto 4.0] Falha ao acionar clique de avanço:', err);
    }

    setTimeout(() => {
      isAdvancing = false;
      sendTelemetry();
    }, 3000);
  }

  // Tenta reproduzir o vídeo com fallback para mudo em caso de bloqueio do navegador
  async function attemptPlayVideo(video) {
    if (!video || video.ended) return;

    try {
      await video.play();
      console.log('[Alura Auto 4.0] Vídeo reproduzindo normalmente com áudio.');
    } catch (playErr) {
      if (playErr.name === 'NotAllowedError') {
        console.warn('[Alura Auto 4.0] Autoplay com som bloqueado pelo Chrome. Aplicando modo silencioso.');
        video.muted = true;
        try {
          await video.play();
          console.log('[Alura Auto 4.0] Vídeo reproduzindo em modo silencioso (fallback autoplay).');
        } catch (silentErr) {
          console.error('[Alura Auto 4.0] Falha ao reproduzir mesmo em silêncio:', silentErr);
        }
      } else {
        console.warn('[Alura Auto 4.0] Erro ao reproduzir vídeo:', playErr);
      }
    }
  }

  // Conecta ouvintes de eventos no elemento <video>
  function attachVideoListeners() {
    const video = findVideoElement();
    if (!video) {
      currentVideoElement = null;
      videoListenersAttached = false;
      return false;
    }

    if (currentVideoElement === video && videoListenersAttached) {
      return true;
    }

    currentVideoElement = video;
    videoListenersAttached = true;

    video.addEventListener('play', () => {
      sendTelemetry();
    });

    video.addEventListener('pause', () => {
      sendTelemetry();
    });

    video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastReportedTime > 1000) {
        lastReportedTime = now;
        sendTelemetry();
      }
    });

    video.addEventListener('ended', () => {
      console.log('[Alura Auto 4.0] Vídeo finalizado!');
      sendTelemetry({ videoEnded: true });

      if (isAutomationActive) {
        // Aguarda 1.5s antes de avançar para garantir gravação de progresso na Alura
        setTimeout(() => {
          if (isAutomationActive) {
            advanceToNextLesson();
          }
        }, 1500);
      }
    });

    console.log('[Alura Auto 4.0] Ouvintes de vídeo anexados com sucesso.');

    if (isAutomationActive && video.paused && !video.ended) {
      attemptPlayVideo(video);
    }

    sendTelemetry();
    return true;
  }

  // Observa mudanças no DOM da Alura (suporta navegações SPA sem reload)
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('[Alura Auto 4.0] URL alterada na Alura:', currentUrl);
      videoListenersAttached = false;
      setTimeout(() => {
        attachVideoListeners();
        sendTelemetry();
      }, 1000);
      return;
    }

    if (!currentVideoElement || !document.contains(currentVideoElement)) {
      attachVideoListeners();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Escuta comandos vindos do Background Service Worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'START_MONITORING':
        isAutomationActive = true;
        console.log('[Alura Auto 4.0] Automação ativada nesta aba.');
        const hasVideo = attachVideoListeners();

        if (hasVideo && currentVideoElement && currentVideoElement.paused) {
          attemptPlayVideo(currentVideoElement);
        }

        const act = detectActivity();
        if (act) {
          console.log('[Alura Auto 4.0] Atividade encontrada:', act);
        }

        sendTelemetry();
        sendResponse({
          success: true,
          course: detectCourseTitle(),
          lesson: detectLessonTitle(),
          hasVideo: hasVideo,
          activity: act
        });
        break;

      case 'PAUSE_MONITORING':
        isAutomationActive = false;
        console.log('[Alura Auto 4.0] Automação pausada nesta aba.');
        if (currentVideoElement && !currentVideoElement.paused) {
          currentVideoElement.pause();
        }
        sendTelemetry();
        sendResponse({ success: true });
        break;

      case 'STOP_MONITORING':
        isAutomationActive = false;
        console.log('[Alura Auto 4.0] Automação parada nesta aba.');
        if (currentVideoElement && !currentVideoElement.paused) {
          currentVideoElement.pause();
        }
        sendTelemetry();
        sendResponse({ success: true });
        break;

      case 'TRIGGER_ADVANCE':
        advanceToNextLesson();
        sendResponse({ success: true });
        break;

      case 'QUERY_DOM_INFO':
        sendResponse({
          course: detectCourseTitle(),
          lesson: detectLessonTitle(),
          activity: detectActivity(),
          videoFound: Boolean(findVideoElement())
        });
        break;

      default:
        sendResponse({ success: false, reason: 'Comando desconhecido' });
    }
  });

  // Inicialização inicial
  window.addEventListener('load', () => {
    attachVideoListeners();
    sendTelemetry();
  });

  // Tenta anexar imediatamente se a página já carregou
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    attachVideoListeners();
    sendTelemetry();
  }
})();
