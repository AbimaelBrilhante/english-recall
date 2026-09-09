# Instruções para os projetos de estudo

Repositório: `AbimaelBrilhante/english-recall`

## Projeto de inglês
Adicione às instruções do projeto:

> Quando eu disser "add to deck", "adicionar ao deck", "mande para o Recall" ou pedir para salvar frases estudadas, use o GitHub conectado e atualize `decks/english.json` no repositório `AbimaelBrilhante/english-recall`.
> Preserve o JSON existente e todos os IDs. Antes de adicionar, verifique duplicatas por frase em inglês e tradução.
> Para cada nova frase, crie um ID sequencial no padrão `en-###`, sem reutilizar IDs antigos.
> Use `front` para a frase em inglês e `back` para a tradução natural em português.
> Use `initial_due_days: 0` para novas frases.
> Não adicione automaticamente tudo que aparecer na aula. Só grave quando eu pedir ou quando eu solicitar as frases mais importantes da sessão.
> Depois da alteração, diga quantas frases foram adicionadas e quais foram ignoradas como duplicatas.

## Projeto de alemão
Adicione às instruções do projeto:

> Quando eu disser "add to deck", "adicionar ao deck", "mande para o Recall" ou pedir para salvar frases estudadas, use o GitHub conectado e atualize `decks/german.json` no repositório `AbimaelBrilhante/english-recall`.
> Preserve o JSON existente e todos os IDs. Antes de adicionar, verifique duplicatas por frase em alemão e tradução.
> Para cada nova frase, crie um ID sequencial no padrão `de-###`, sem reutilizar IDs antigos.
> Use `front` para a frase em alemão e `back` para a tradução natural em português.
> Use `initial_due_days: 0` para novas frases.
> Meu alemão está no início do A1: priorize frases curtas, úteis e compatíveis com iniciante absoluto. Não aumente a dificuldade só para variar.
> Não adicione automaticamente tudo que aparecer na aula. Só grave quando eu pedir ou quando eu solicitar as frases mais importantes da sessão.
> Depois da alteração, diga quantas frases foram adicionadas e quais foram ignoradas como duplicatas.

## Formato de uma nova frase
```json
{
  "id": "en-062",
  "front": "I need to check the data first.",
  "back": "Preciso verificar os dados primeiro.",
  "initial_due_days": 0
}
```

O app busca esses arquivos no GitHub e incorpora somente as frases novas, preservando o progresso local.


## Recall V4
O app agora pode apresentar a mesma frase nos dois sentidos. Isso não muda o formato dos JSONs do GitHub:
- `front` continua sendo o idioma estudado.
- `back` continua sendo português.
- Não crie uma segunda frase invertida para Português → idioma-alvo.
O próprio app gera o exercício de produção e mantém o progresso de cada direção separadamente.
