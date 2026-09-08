# Recall V3 — Multi Deck

Estrutura:

```text
english-recall/
├── index.html
├── sw.js
├── manifest.webmanifest
├── icon-192.png
├── icon-512.png
├── .nojekyll
├── decks/
│   ├── english.json
│   └── german.json
├── PROJECT_INSTRUCTIONS.md
└── README.md
```

## O que mudou
- Decks separados: English e Deutsch.
- Progresso de repetição espaçada independente por deck.
- Streak global.
- Migração automática do armazenamento da V1 (`englishRecallPwaV1`) para a V3.
- Voz configurável separadamente por idioma.
- Auto-play do próximo card após avaliar.
- `decks/*.json` sincronizados do GitHub sem reinstalar o app.
- Frases adicionadas manualmente no app continuam salvas apenas no iPhone.
- Backup local inclui todos os decks e histórico.

## Atualizar o GitHub
Substitua os arquivos atuais pelos arquivos deste pacote e crie a pasta `decks/`.

O GitHub Pages pode continuar em:
- branch: `main`
- folder: `/ (root)`

Não desinstale o app do iPhone. A V3 migra o progresso da V1 automaticamente.

## Adicionar frases pelo GitHub
Edite somente:
- `decks/english.json`
- `decks/german.json`

Depois de um commit, abra o app e toque em **Sincronizar GitHub**. O app também tenta sincronizar automaticamente ao abrir e ao recuperar conexão.

### Regra importante
Nunca altere um `id` já existente. Novas frases recebem novos IDs.
