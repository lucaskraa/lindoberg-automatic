# ALURA AUTO 4.0 — Painel de Controle e Extensão Manifest V3

> Sistema integrado de acompanhamento e automação de estudos na Alura com painel estático para GitHub Pages e extensão oficial Google Chrome Manifest V3.

---

## 1. Visão Geral da Arquitetura

O **Alura Auto 4.0** é composto por duas partes sincronizadas que trabalham em conjunto:

```
[ Usuário na Alura ] <---> [ alura.js Content Script ]
                                     |
                                     v
                        [ background.js Service Worker ]
                                     ^
                                     |
[ Painel GitHub Pages ] <---> [ bridge.js Content Script ]
```

1. **Painel de Controle Web (GitHub Pages / Estático):**
   - Aplicação web pura em HTML5, CSS3 e JavaScript.
   - Não requer Node.js em produção, backend próprio, banco de dados ou chaves de API pagas.
   - Comunica-se de forma segura com a extensão através de canal de mensagens com desafio e resposta (`handshake`).
   - Monitora em tempo real o estado da extensão, abas da Alura, reprodução de vídeos e atividades.

2. **Extensão Google Chrome (Manifest V3):**
   - **`manifest.json`**: Especificação oficial do Manifest V3 do Chrome.
   - **`background.js`**: Service Worker de segundo plano que persiste o estado em `chrome.storage.local`, monitora abas abertas (`chrome.tabs`) e gerencia eventos de ciclo de vida.
   - **`bridge.js`**: Script de ponte injetado no domínio do painel web para mediar mensagens com segurança sem vazar contexto interno.
   - **`alura.js`**: Script de conteúdo injetado nas abas `cursos.alura.com.br`, responsável por monitorar o `<video>`, detectar títulos de cursos/aulas, identificar exercícios e acionar avanços com proteção anti-duplo clique e debouncing.
   - **`popup.html` e `popup.js`**: Menu de ação rápida acessível diretamente pela barra de ferramentas do Chrome.

---

## 2. Estrutura de Arquivos do Repositório

```
alura-auto/
│
├── index.html                  # Painel de controle principal (HTML5)
├── style.css                   # Folha de estilos moderna e responsiva (CSS3)
├── app.js                      # Lógica do painel e protocolo de comunicação
├── README.md                   # Documentação completa e instruções de uso
│
├── arquivos-txt/               # Cópias idênticas dos scripts para conferência rápida
│   ├── app.txt
│   ├── background.txt
│   ├── bridge.txt
│   ├── alura.txt
│   └── popup.txt
│
├── chrome-extension/           # Extensão Google Chrome Manifest V3
│   ├── manifest.json
│   ├── background.js
│   ├── bridge.js
│   ├── alura.js
│   ├── popup.html
│   └── popup.js
│
└── tests/                      # Bateria de testes automatizados 1 a 8
    ├── communication.test.js
    ├── automation.test.js
    └── README.md
```

---

## 3. Como Publicar no GitHub Pages

O painel foi desenvolvido como uma aplicação 100% estática para execução direta no GitHub Pages:

1. Faça o commit e push de todos os arquivos para a branch `main` do seu repositório no GitHub:
   ```bash
   git add .
   git commit -m "feat: Alura Auto 4.0 completo"
   git push origin main
   ```
2. No GitHub, acesse **Settings** > **Pages** no repositório.
3. Em **Build and deployment**:
   - **Source:** *Deploy from a branch*
   - **Branch:** selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**. Em instantes seu painel estará disponível na URL `https://<seu-usuario>.github.io/<seu-repositorio>/`.

---

## 4. Como Instalar a Extensão no Google Chrome

O Chrome não permite a instalação silenciosa de extensões a partir de páginas web. Siga o passo a passo seguro:

1. **Obter a pasta da extensão:**
   - No painel web, clique no botão **"INSTALAR EXTENSÃO"** e em seguida em **"Baixar Extensão Completa (ZIP)"**; ou utilize diretamente a pasta `chrome-extension/` deste repositório.
   - Se baixou o arquivo ZIP, descompacte-o em uma pasta no seu computador.
2. **Abrir a página de extensões do Chrome:**
   - Digite no navegador: `chrome://extensions`
3. **Ativar o Modo de Desenvolvedor:**
   - No canto superior direito, ative a chave **"Modo do desenvolvedor"** (Developer Mode).
4. **Carregar a extensão:**
   - Clique em **"Carregar sem compactação"** (Load unpacked).
   - Selecione a pasta `chrome-extension` descompactada.
5. **Pronto!**
   - Ao abrir ou atualizar o painel web, a extensão será detectada automaticamente e o status mudará para **"EXTENSÃO CONECTADA"**.

---

## 5. Como Utilizar a Automação

1. Abra o painel web no navegador.
2. Em outra aba, acesse [cursos.alura.com.br](https://cursos.alura.com.br) e faça login na sua conta.
3. Abra qualquer aula de um curso matriculado.
4. O painel exibirá automaticamente:
   - **Estado da Extensão:** `EXTENSÃO CONECTADA`
   - **Estado da Alura:** `ALURA CONECTADA`
   - **Curso:** Nome do curso identificado.
   - **Aula:** Nome da aula atual.
5. Clique no botão **COMEÇAR**.
6. A automação cuidará da reprodução do vídeo e avançará com segurança para a próxima aula assim que o conteúdo terminar.
7. Quando uma atividade ou exercício for encontrado, o painel exibirá um alerta e uma dica de estudo, respeitando a resolução ética do aluno antes de avançar.

---

## 6. Bateria de Testes Realizados

Execute a suíte completa no terminal:
```bash
npm test
```

### Resultados dos 8 Testes Obrigatórios:
- **Teste 1 — Sintaxe:** Todos os arquivos JS, HTML e JSON validados sem erros sintáticos. Espelhos `.txt` verificados como cópias idênticas.
- **Teste 2 — Comunicação:** Handshake com desafio criptográfico e envelope de mensagem validado.
- **Teste 3 — Extensão:** Detecção por sentinela e resposta ao handshake verificadas.
- **Teste 4 — Estados:** Transições entre `PARADO`, `INICIANDO`, `EXECUTANDO`, `PAUSADO` e `ERRO` testadas.
- **Teste 5 — Vídeo:** Simulação de carregamento, play, pause, progresso e término de vídeo.
- **Teste 6 — Avanço:** Heurísticas de detecção do botão de avanço, debounce de 3 segundos contra duplo clique e verificação de fim de curso.
- **Teste 7 — Erros e Resiliência:** Persistência de reinício do Service Worker e tratamento de aba fechada.
- **Teste 8 — Interface:** Componentes reativos, badges, logs e laboratório de testes integrado aprovados.

---

## 7. Diretrizes Éticas de Uso

> O **Alura Auto 4.0** é uma ferramenta desenvolvida exclusivamente para **acompanhamento e apoio aos estudos**. Não possui finalidade de falsificar progresso acadêmico. Questionários e provas exigem a conferência e confirmação consciente do usuário.