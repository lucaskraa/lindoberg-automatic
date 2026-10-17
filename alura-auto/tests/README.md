# Relatório de Testes e Documentação de Verificação — Alura Auto 4.0

Este diretório contém as suítes de testes automatizados e o detalhamento dos 8 testes obrigatórios definidos no projeto **Alura Auto 4.0**.

---

## 1. Como Executar os Testes Automatizados

No terminal, execute:

```bash
npm test
```

Ou execute individualmente:

```bash
# Testes de Comunicação, Handshake e Integridade de Arquivos
node tests/communication.test.js

# Testes de Automação, Vídeo, Seletores e Debouncing
node tests/automation.test.js
```

Os testes também podem ser disparados visualmente no **Painel de Controle web**, clicando no botão **"Executar Testes 1 a 8"** na seção *Laboratório de Testes & Simulador Alura*.

---

## 2. Matriz dos 8 Testes Obrigatórios

| Teste | Nome | Escopo | Método | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Teste 1** | **Sintaxe e Integridade** | Validação sintática de todos os arquivos JS (`app.js`, `background.js`, `bridge.js`, `alura.js`, `popup.js`), do `manifest.json` (V3) e espelhos idênticos em `.txt`. | Automatizado (`tests/communication.test.js`) | **APROVADO** |
| **Teste 2** | **Comunicação** | Envelopes de mensagem, isolamento de fontes (`ALURA_AUTO_PAGE` vs `ALURA_AUTO_CONTENT_BRIDGE`), IDs de mensagem e ACK assíncrono. | Automatizado (`tests/communication.test.js`) | **APROVADO** |
| **Teste 3** | **Extensão** | Detecção via sentinela no DOM, Handshake Challenge-Response (`HANDSHAKE_REQUEST` / `ACK`) e Heartbeat periódico (`PING` / `PONG`). | Automatizado (`tests/communication.test.js`) | **APROVADO** |
| **Teste 4** | **Estados** | Ciclo de transição de estados: `PARADO` → `INICIANDO` → `EXECUTANDO` → `PAUSADO` → `ERRO`. Validação das regras de habilitação/desabilitação de botões. | Automatizado (`tests/automation.test.js`) | **APROVADO** |
| **Teste 5** | **Vídeo** | Monitoramento de ciclo de vida do elemento `<video>`: `play`, `pause`, `timeupdate`, cálculo percentual de progresso, `ended` e fallback para áudio mudo em caso de bloqueio de autoplay pelo navegador. | Automatizado (`tests/automation.test.js`) | **APROVADO** |
| **Teste 6** | **Avanço Seguro** | Resolução do botão de próxima aula por seletores CSS Alura (`task-body-link--next`), texto semântico ("Avançar", "Próxima atividade"), atributos ARIA, proteção de debounce (3 segundos) e detecção segura quando o botão não existe. | Automatizado (`tests/automation.test.js`) | **APROVADO** |
| **Teste 7** | **Erros e Resiliência** | Persistência do Service Worker através de suspensão e reinício via `chrome.storage.local`, fechamento de aba Alura (`chrome.tabs.onRemoved`), timeout de comunicação e recuperação. | Automatizado (`tests/communication.test.js`) | **APROVADO** |
| **Teste 8** | **Interface e Atividades** | Reatividade completa dos componentes do painel web, console de logs, modal de instalação e detecção ética de atividades/exercícios sem envio automático não autorizado. | Automatizado + UI (`tests/automation.test.js`) | **APROVADO** |

---

## 3. Diferenciação: Testes Simulados vs Validação Real no Chrome/Alura

### A. Testes Simulados (100% Validados no Ambiente de Desenvolvimento)
1. **Sintaxe e parsing de código:** Verificado e executado pelo Node.js.
2. **Handshake e protocolo de mensagens:** Verificado via Mock de barramento de mensagens.
3. **Máquina de estados:** Validação lógica de todas as transições e guardas.
4. **Algoritmos de avanço e seletores:** Verificados em árvore DOM simulada com 6 variações reais da Alura.
5. **Debouncing e prevenção de cliques duplos:** Comprovado temporização e bloqueio em janela de 3000ms.
6. **Detecção ética de atividades:** Garantia de que nenhuma submissão de respostas ocorre sem confirmação.

### B. Funcionalidades que Dependem de Validação Real no Chrome e Sessão Alura
Para que as funcionalidades abaixo ocorram em produção, o usuário deve carregar a extensão no Google Chrome e estar autenticado na Alura:
1. **Instalação Real da Extensão no Navegador:**
   O Chrome restringe a instalação silenciosa de extensões via JavaScript de páginas web. O usuário deve ativar o **Modo do Desenvolvedor** em `chrome://extensions` e selecionar a pasta `chrome-extension/`.
2. **Sessão Ativa e Token de Usuário na Alura:**
   A extensão monitora as abas reais do domínio `cursos.alura.com.br`. O usuário precisa estar logado na sua conta Alura e com um curso aberto.
3. **Reprodução com Som do Vídeo:**
   A política de áudio e autoplay do Google Chrome pode bloquear reprodução com som sem interação prévia do usuário. O script `alura.js` possui fallback automático para reprodução silenciosa (`video.muted = true`), mas a liberação do som com interação depende do navegador do usuário.
4. **Navegações SPA proprietárias da Alura:**
   O `MutationObserver` e os ouvintes de URL observam as transições de rota da Alura. Caso a Alura altere completamente suas classes de frontend em futuras atualizações, os seletores heurísticos semânticos garantem a continuidade, mas requererão checagem contínua.
