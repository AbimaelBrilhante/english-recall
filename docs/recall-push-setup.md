# Recall — notificações diárias (GitHub Pages + GitHub Actions)

**Escopo:** uso pessoal, uma inscrição push (um iPhone) e três notificações todos os dias em `America/Fortaleza`.

- 09h — desafio com frase em português selecionada do deck de inglês.
- 12h — desafio com frase em português selecionada do deck de alemão.
- 14h — lembrete fixo de estudo.
- Nenhum acesso ao progresso do SRS, `localStorage` ou histórico.
- Nenhum serviço pago ou servidor permanente.

## Ativar

1. Abra o Recall **pelo ícone da Tela de Início** no iPhone (iOS 16.4+).
2. Entre em **Configurações → Notificações do Recall**.
3. Toque em **Preparar chaves**, **Permitir notificações**, **Criar inscrição** e **Copiar configuração para GitHub Secret**. Os toques são separados por exigência de ativação do Safari.
4. No GitHub, abra o repositório `AbimaelBrilhante/english-recall`, depois **Settings → Secrets and variables → Actions → New repository secret**.
5. Nome do segredo: `RECALL_PUSH_CONFIG`. Cole o texto copiado do Recall em **Secret**. Salve.
6. Para testar imediatamente, abra **Actions → Recall · Notificações diárias → Run workflow** e selecione `english`, `german` ou `reminder`.

**Quem já ativou as notificações:** não precisa refazer inscrição nem alterar `RECALL_PUSH_CONFIG`; o agendamento novo usa o mesmo segredo.

**Não cole a configuração em issue, commit, arquivo público, chat ou README.** Ela contém uma chave privada VAPID e a inscrição do seu dispositivo. O GitHub Actions Secret é o único local em que esse pacote deve ser armazenado fora do dispositivo.

## Limitações

- Os envios programados dependem de `schedule` do GitHub Actions e podem atrasar alguns minutos ou, raramente, deixar de executar.
- Scheduled workflows de repositórios públicos podem ser desabilitados após 60 dias sem atividade.
- Notificações podem ser silenciadas por Foco/Não Perturbe, permissões do iOS ou expiração da inscrição.
- Sem sincronização remota de dados do Recall: os avisos são fixos e não verificam quantas revisões faltam.
- Esta versão suporta um único destinatário. Para outro iPhone, renove a inscrição e substitua o segredo.
- Para desativar, use o botão no iPhone **e remova o segredo `RECALL_PUSH_CONFIG`** do GitHub.

## Arquitetura

- `sw.js` recebe push e exibe uma notificação visível imediatamente (requisito do Safari).
- `recall-push-setup-v1.js` prepara uma chave VAPID no aparelho, solicita permissão e gera um único pacote JSON.
- `.github/workflows/recall-daily-push.yml` agenda os envios e oferece execução manual.
- `scripts/send-recall-push.cjs` envia via `web-push@3.6.7`, usando o segredo; nenhum dado da inscrição é gravado em código ou logs.

## Diagnóstico

Se o workflow informar ausência do segredo, configure `RECALL_PUSH_CONFIG`; isso não modifica o Recall.

Se o push retornar HTTP 404/410, a inscrição expirou. No iPhone, desative e faça a inscrição novamente, depois atualize o segredo no GitHub.

Se a opção de notificações não aparecer, feche e reabra o PWA para carregar o SW e módulo novos. Evite excluir dados do site ou reinstalar o Recall enquanto houver histórico local sem backup.
