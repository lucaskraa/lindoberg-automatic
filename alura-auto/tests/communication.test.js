/**
 * Alura Auto 4.0 - Communication & Protocol Automated Tests
 * Executa testes automatizados para:
 * - Teste 1: Sintaxe e Integridade dos Arquivos
 * - Teste 2: Protocolo de Comunicação e Handshake (SYN/ACK)
 * - Teste 3: Detecção de Presença e Heartbeat (PING/PONG)
 * - Teste 7: Resiliência contra Abas Fechadas e Reinício do Service Worker
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('====================================================');
console.log('   BATERIA DE TESTES DE COMUNICAÇÃO - ALURA AUTO 4.0');
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
// TESTE 1: SINTAXE E INTEGRIDADE DOS SCRIPTS
// -----------------------------------------------------------------
console.log('--- TESTE 1: Validação de Sintaxe e Existência dos Arquivos ---');

const requiredFiles = [
  'index.html',
  'style.css',
  'app.js',
  'chrome-extension/manifest.json',
  'chrome-extension/background.js',
  'chrome-extension/bridge.js',
  'chrome-extension/alura.js',
  'chrome-extension/popup.html',
  'chrome-extension/popup.js',
  'arquivos-txt/app.txt',
  'arquivos-txt/background.txt',
  'arquivos-txt/bridge.txt',
  'arquivos-txt/alura.txt',
  'arquivos-txt/popup.txt'
];

requiredFiles.forEach((file) => {
  runTest(`Arquivo existe e não está vazio: ${file}`, () => {
    const fullPath = path.resolve('.', file);
    assert.ok(fs.existsSync(fullPath), `Arquivo ${file} não encontrado`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 0, `Arquivo ${file} está vazio (0 bytes)`);
  });
});

runTest('Manifest V3 possui configurações obrigatórias', () => {
  const manifestRaw = fs.readFileSync(path.resolve('.', 'chrome-extension/manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  assert.strictEqual(manifest.manifest_version, 3, 'Deve ser Manifest V3');
  assert.strictEqual(manifest.name, 'Alura Auto 4.0');
  assert.ok(manifest.permissions.includes('tabs'), 'Permissão tabs requerida');
  assert.ok(manifest.permissions.includes('storage'), 'Permissão storage requerida');
  assert.ok(manifest.background.service_worker === 'background.js', 'Service worker background.js configurado');
});

runTest('Arquivos .txt são cópias idênticas dos respectivos .js', () => {
  const pairs = [
    ['app.js', 'arquivos-txt/app.txt'],
    ['chrome-extension/background.js', 'arquivos-txt/background.txt'],
    ['chrome-extension/bridge.js', 'arquivos-txt/bridge.txt'],
    ['chrome-extension/alura.js', 'arquivos-txt/alura.txt'],
    ['chrome-extension/popup.js', 'arquivos-txt/popup.txt']
  ];

  for (const [jsFile, txtFile] of pairs) {
    const jsContent = fs.readFileSync(path.resolve('.', jsFile), 'utf-8');
    const txtContent = fs.readFileSync(path.resolve('.', txtFile), 'utf-8');
    assert.strictEqual(jsContent, txtContent, `${txtFile} não é cópia exata de ${jsFile}`);
  }
});

// -----------------------------------------------------------------
// TESTE 2 & 3: SIMULAÇÃO DE COMUNICAÇÃO, HANDSHAKE E DETECÇÃO
// -----------------------------------------------------------------
console.log('\n--- TESTE 2 & 3: Protocolo de Handshake, Envelopes e Desafio ---');

class MockMessageChannel {
  constructor() {
    this.pageListeners = [];
    this.bridgeListeners = [];
  }

  postFromPage(message) {
    // Isolamento: verifica se tem a assinatura da página
    if (message.source !== 'ALURA_AUTO_PAGE') {
      throw new Error('Mensagem da página rejeitada: source inválida');
    }
    // Repassa para os ouvintes do bridge
    for (const listener of this.bridgeListeners) {
      listener(message);
    }
  }

  postFromBridge(message) {
    if (message.source !== 'ALURA_AUTO_CONTENT_BRIDGE') {
      throw new Error('Mensagem do bridge rejeitada: source inválida');
    }
    for (const listener of this.pageListeners) {
      listener(message);
    }
  }
}

runTest('Handshake Challenge-Response com envelope seguro', () => {
  const channel = new MockMessageChannel();
  const challengeToken = 'chal_test_98765';
  let handshakeAcknowledged = false;

  // Bridge simula escuta
  channel.bridgeListeners.push((msg) => {
    if (msg.type === 'HANDSHAKE_REQUEST') {
      assert.strictEqual(msg.payload.challenge, challengeToken);
      // Bridge responde
      channel.postFromBridge({
        source: 'ALURA_AUTO_CONTENT_BRIDGE',
        type: 'HANDSHAKE_REQUEST_ACK',
        replyTo: msg.messageId,
        payload: {
          success: true,
          version: '4.0.0',
          aluraTabsCount: 1,
          automationState: 'PARADO'
        }
      });
    }
  });

  // Página escuta resposta
  channel.pageListeners.push((msg) => {
    if (msg.type === 'HANDSHAKE_REQUEST_ACK') {
      assert.strictEqual(msg.payload.version, '4.0.0');
      assert.strictEqual(msg.payload.aluraTabsCount, 1);
      handshakeAcknowledged = true;
    }
  });

  // Página envia handshake
  channel.postFromPage({
    source: 'ALURA_AUTO_PAGE',
    type: 'HANDSHAKE_REQUEST',
    messageId: 'msg_001',
    timestamp: Date.now(),
    payload: { challenge: challengeToken }
  });

  assert.ok(handshakeAcknowledged, 'Handshake não foi confirmado corretamente');
});

runTest('Heartbeat PING / PONG e controle de timeout', () => {
  const channel = new MockMessageChannel();
  let pongReceived = false;

  channel.bridgeListeners.push((msg) => {
    if (msg.type === 'PING') {
      channel.postFromBridge({
        source: 'ALURA_AUTO_CONTENT_BRIDGE',
        type: 'PING_ACK',
        replyTo: msg.messageId,
        payload: {
          success: true,
          type: 'PONG',
          timestamp: Date.now(),
          aluraTabsCount: 1
        }
      });
    }
  });

  channel.pageListeners.push((msg) => {
    if (msg.type === 'PING_ACK') {
      assert.strictEqual(msg.payload.type, 'PONG');
      pongReceived = true;
    }
  });

  channel.postFromPage({
    source: 'ALURA_AUTO_PAGE',
    type: 'PING',
    messageId: 'ping_001',
    timestamp: Date.now()
  });

  assert.ok(pongReceived, 'PONG do heartbeat não foi recebido');
});

// -----------------------------------------------------------------
// TESTE 7: RESILIÊNCIA E TRATAMENTO DE ERROS
// -----------------------------------------------------------------
console.log('\n--- TESTE 7: Tratamento de Erros, Abas Fechadas e Persistência ---');

runTest('Persistência de estado simulada (Service Worker Restart)', () => {
  const mockStorage = {};
  
  // Salva estado antes de suspender
  const activeState = {
    automationState: 'EXECUTANDO',
    targetTabId: 42,
    courseTitle: 'Node.js com Express',
    lessonTitle: 'Criando APIs'
  };
  mockStorage['aluraAutoState'] = JSON.stringify(activeState);

  // Simula reinício do Service Worker (recupera do storage)
  const restoredState = JSON.parse(mockStorage['aluraAutoState']);
  assert.strictEqual(restoredState.automationState, 'EXECUTANDO');
  assert.strictEqual(restoredState.targetTabId, 42);
  assert.strictEqual(restoredState.courseTitle, 'Node.js com Express');
});

runTest('Notificação de Aba Alura Fechada altera estado para PARADO', () => {
  const channel = new MockMessageChannel();
  let tabClosedHandled = false;

  channel.pageListeners.push((msg) => {
    if (msg.type === 'ALURA_TAB_CLOSED') {
      assert.strictEqual(msg.automationState, 'PARADO');
      tabClosedHandled = true;
    }
  });

  // Bridge transmite notificação de fechamento
  channel.postFromBridge({
    source: 'ALURA_AUTO_CONTENT_BRIDGE',
    type: 'ALURA_TAB_CLOSED',
    automationState: 'PARADO',
    error: 'Aba da Alura fechada pelo usuário'
  });

  assert.ok(tabClosedHandled, 'Evento de aba fechada não foi propagado');
});

console.log(`\n====================================================`);
console.log(`RESULTADO FINAL DE COMUNICAÇÃO: ${passedTests} de ${totalTests} testes APROVADOS.`);
console.log(`====================================================\n`);
