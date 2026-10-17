/**
 * Alura Auto 4.0 - Automation & DOM Logic Automated Tests
 * Executa testes automatizados para:
 * - Teste 4: Ciclo e Transição de Estados da Automação
 * - Teste 5: Monitoramento de Vídeo (play, pause, timeupdate, ended)
 * - Teste 6: Identificação do Botão de Avanço e Proteção Anti-Clique Duplo
 * - Teste 8: Detecção Ética de Atividades e Exercícios
 */

import assert from 'assert';

console.log('====================================================');
console.log('   BATERIA DE TESTES DE AUTOMAÇÃO - ALURA AUTO 4.0');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------
// TESTE 4: CICLO E TRANSIÇÃO DE ESTADOS
// -----------------------------------------------------------------
console.log('--- TESTE 4: Máquina de Estados da Automação ---');

class AutomationStateMachine {
  constructor() {
    this.state = 'PARADO';
  }

  transition(action, payload = {}) {
    switch (this.state) {
      case 'PARADO':
        if (action === 'START') {
          if (!payload.hasAluraTab) {
            this.state = 'ERRO';
            this.error = 'Nenhuma aba encontrada';
          } else {
            this.state = 'INICIANDO';
          }
        }
        break;

      case 'INICIANDO':
        if (action === 'TAB_READY') {
          this.state = 'EXECUTANDO';
        } else if (action === 'TAB_ERROR') {
          this.state = 'ERRO';
        }
        break;

      case 'EXECUTANDO':
        if (action === 'PAUSE') {
          this.state = 'PAUSADO';
        } else if (action === 'STOP') {
          this.state = 'PARADO';
        } else if (action === 'TAB_CLOSED') {
          this.state = 'PARADO';
          this.error = 'Aba fechada';
        }
        break;

      case 'PAUSADO':
        if (action === 'RESUME') {
          this.state = 'EXECUTANDO';
        } else if (action === 'STOP') {
          this.state = 'PARADO';
        }
        break;

      case 'ERRO':
        if (action === 'RETRY') {
          this.state = 'PARADO';
          this.error = null;
        }
        break;
    }
    return this.state;
  }
}

runTest('Transição padrão: PARADO -> INICIANDO -> EXECUTANDO -> PAUSADO -> EXECUTANDO -> PARADO', () => {
  const fsm = new AutomationStateMachine();
  assert.strictEqual(fsm.state, 'PARADO');

  fsm.transition('START', { hasAluraTab: true });
  assert.strictEqual(fsm.state, 'INICIANDO');

  fsm.transition('TAB_READY');
  assert.strictEqual(fsm.state, 'EXECUTANDO');

  fsm.transition('PAUSE');
  assert.strictEqual(fsm.state, 'PAUSADO');

  fsm.transition('RESUME');
  assert.strictEqual(fsm.state, 'EXECUTANDO');

  fsm.transition('STOP');
  assert.strictEqual(fsm.state, 'PARADO');
});

runTest('Transição de erro: Tentar iniciar sem abas vai para ERRO', () => {
  const fsm = new AutomationStateMachine();
  fsm.transition('START', { hasAluraTab: false });
  assert.strictEqual(fsm.state, 'ERRO');
  assert.strictEqual(fsm.error, 'Nenhuma aba encontrada');
});

// -----------------------------------------------------------------
// TESTE 5: MONITORAMENTO DE VÍDEO
// -----------------------------------------------------------------
console.log('\n--- TESTE 5: Simulação de Eventos do Vídeo ---');

class MockVideoElement {
  constructor(duration = 300) {
    this.duration = duration;
    this.currentTime = 0;
    this.paused = true;
    this.ended = false;
    this.muted = false;
    this.listeners = {};
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  dispatchEvent(event) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb());
    }
  }

  play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent('play');
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }

  simulateTimeUpdate(newTime) {
    this.currentTime = newTime;
    this.dispatchEvent('timeupdate');
  }

  simulateEnd() {
    this.currentTime = this.duration;
    this.paused = true;
    this.ended = true;
    this.dispatchEvent('ended');
  }

  getProgress() {
    return Math.floor((this.currentTime / this.duration) * 100);
  }
}

runTest('Cálculo de progresso e eventos play/pause/timeupdate/ended', () => {
  const video = new MockVideoElement(200);
  let playFired = false;
  let endFired = false;

  video.addEventListener('play', () => { playFired = true; });
  video.addEventListener('ended', () => { endFired = true; });

  video.play();
  assert.ok(playFired, 'Evento play não disparou');
  assert.strictEqual(video.paused, false);

  video.simulateTimeUpdate(50);
  assert.strictEqual(video.getProgress(), 25, 'Progresso deveria ser 25%');

  video.simulateTimeUpdate(100);
  assert.strictEqual(video.getProgress(), 50, 'Progresso deveria ser 50%');

  video.simulateEnd();
  assert.ok(endFired, 'Evento ended não disparou');
  assert.strictEqual(video.getProgress(), 100, 'Progresso final deve ser 100%');
});

// -----------------------------------------------------------------
// TESTE 6: AVANÇO SEGURO E PROTEÇÃO ANTI-DUPLO CLIQUE
// -----------------------------------------------------------------
console.log('\n--- TESTE 6: Identificação de Avanço e Debouncing ---');

// Mock DOM estruturado
class MockDOM {
  constructor() {
    this.elements = [];
  }

  addElement(tag, props = {}, text = '') {
    const el = {
      tagName: tag.toUpperCase(),
      className: props.className || '',
      id: props.id || '',
      attributes: props.attributes || {},
      offsetParent: props.visible !== false ? {} : null, // simula visibilidade
      disabled: props.disabled || false,
      textContent: text,
      getAttribute(attr) { return this.attributes[attr] || null; },
      clicks: 0,
      click() { this.clicks++; }
    };
    this.elements.push(el);
    return el;
  }

  findNextButton() {
    const explicitSelectors = [
      'task-body-link--next',
      'task-actions-button--next',
      'bootcamp-next-button'
    ];

    // 1. Busca por classes explícitas
    for (const el of this.elements) {
      if (el.offsetParent === null || el.disabled) continue;
      for (const sel of explicitSelectors) {
        if (el.className.includes(sel)) return el;
      }
      if (el.getAttribute('data-action') === 'next') return el;
    }

    // 2. Busca por texto
    const nextTexts = ['avançar', 'próxima atividade', 'próxima aula', 'próximo', 'continuar'];
    for (const el of this.elements) {
      if (el.offsetParent === null || el.disabled) continue;
      const t = el.textContent.trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      for (const target of nextTexts) {
        if (t === target || t.startsWith(target) || aria.includes(target)) {
          return el;
        }
      }
    }

    return null;
  }
}

runTest('Localiza botão por classe oficial da Alura (task-body-link--next)', () => {
  const dom = new MockDOM();
  const nextBtn = dom.addElement('a', { className: 'task-body-link task-body-link--next', visible: true }, 'Próxima');
  const found = dom.findNextButton();
  assert.strictEqual(found, nextBtn);
});

runTest('Localiza botão por heurística semântica de texto ("Avançar")', () => {
  const dom = new MockDOM();
  dom.addElement('button', { className: 'btn-voltar', visible: true }, 'Voltar');
  const advanceBtn = dom.addElement('button', { className: 'btn-generic', visible: true }, 'Avançar');
  const found = dom.findNextButton();
  assert.strictEqual(found, advanceBtn);
});

runTest('Ignora botão invisível (offsetParent === null) e encontra o ativo', () => {
  const dom = new MockDOM();
  dom.addElement('a', { className: 'task-body-link--next', visible: false }, 'Invisível');
  const visibleBtn = dom.addElement('a', { className: 'task-actions-button--next', visible: true }, 'Visível');
  const found = dom.findNextButton();
  assert.strictEqual(found, visibleBtn);
});

runTest('Retorna null com segurança quando não há botão de próxima (fim de curso)', () => {
  const dom = new MockDOM();
  dom.addElement('div', {}, 'Parabéns, você concluiu este curso!');
  const found = dom.findNextButton();
  assert.strictEqual(found, null);
});

runTest('Proteção de Debounce de 3 segundos impede cliques duplos', () => {
  let isAdvancing = false;
  let lastTimestamp = 0;
  let clickCounter = 0;

  function triggerAdvance(now) {
    if (isAdvancing || now - lastTimestamp < 3000) {
      return false; // Bloqueado pelo debounce
    }
    isAdvancing = true;
    lastTimestamp = now;
    clickCounter++;
    // Simula cooldown de 3s
    setTimeout(() => { isAdvancing = false; }, 3000);
    return true;
  }

  const t0 = 10000;
  assert.ok(triggerAdvance(t0), 'Primeiro clique deve ser aceito');
  assert.strictEqual(clickCounter, 1);

  // Tentativa com 500ms (clique duplo rápido)
  assert.strictEqual(triggerAdvance(t0 + 500), false, 'Clique duplo dentro de 500ms DEVE ser bloqueado');
  assert.strictEqual(clickCounter, 1);

  // Tentativa com 2000ms (ainda dentro da janela de 3000ms)
  assert.strictEqual(triggerAdvance(t0 + 2000), false, 'Clique dentro de 2000ms DEVE ser bloqueado');
  assert.strictEqual(clickCounter, 1);

  // Tentativa após 3500ms
  isAdvancing = false;
  assert.ok(triggerAdvance(t0 + 3500), 'Clique após 3500ms deve ser aceito');
  assert.strictEqual(clickCounter, 2);
});

// -----------------------------------------------------------------
// TESTE 8: DETECÇÃO ÉTICA DE ATIVIDADES E EXERCÍCIOS
// -----------------------------------------------------------------
console.log('\n--- TESTE 8: Detecção Ética de Exercícios e Quizzes ---');

function inspectActivity(domNodes) {
  const hasAlternatives = domNodes.some(n => n.className?.includes('alternative-list') || n.className?.includes('task-body-quiz'));
  const hasTextarea = domNodes.some(n => n.tagName === 'TEXTAREA');

  if (hasAlternatives) {
    return {
      type: 'multipla_escolha',
      autoSubmitAllowed: false, // Regra ética: NUNCA submeter automaticamente
      requiresUserConfirmation: true
    };
  }

  if (hasTextarea) {
    return {
      type: 'pergunta_dissertativa',
      autoSubmitAllowed: false,
      requiresUserConfirmation: true
    };
  }

  return null;
}

runTest('Exercício de múltipla escolha detectado e com confirmação obrigatória', () => {
  const nodes = [
    { tagName: 'H1', textContent: 'Exercício sobre Closures' },
    { tagName: 'UL', className: 'alternative-list' }
  ];

  const activity = inspectActivity(nodes);
  assert.ok(activity !== null, 'Deveria detectar atividade');
  assert.strictEqual(activity.type, 'multipla_escolha');
  assert.strictEqual(activity.autoSubmitAllowed, false, 'Proibido submeter provas ou exercícios sem confirmação');
  assert.strictEqual(activity.requiresUserConfirmation, true);
});

console.log(`\n====================================================`);
console.log(`RESULTADO FINAL DE AUTOMAÇÃO: ${passedTests} de ${totalTests} testes APROVADOS.`);
console.log(`====================================================\n`);
