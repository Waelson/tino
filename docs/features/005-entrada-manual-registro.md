# Feature 005 — Entrada manual no registro

## 1. Objetivo

Permitir que o tech leader adicione anotações ao registro de um compromisso:
observações de checkpoint, decisões, bloqueios, mudanças de contexto. Fecha o loop
da "cobrança objetiva" — o histórico da delegação escreve-se junto com o uso.

## 2. Contrato da rota

```
POST /compromissos/:id/registro
Authorization: Bearer <token>
Content-Type: application/json

{ "texto": string (1–2000 chars), "data"?: "YYYY-MM-DD" }
```

- **201 Created** — retorna a entrada criada: `{ id, data, origem, texto, criadaEm }`
- **400** — `texto` vazio, acima de 2000 chars, ou `data` fora do padrão `YYYY-MM-DD`
- **401** — sem token válido
- **404** — compromisso não existe ou não pertence ao usuário

### Campos da resposta

| Campo | Tipo | Notas |
|---|---|---|
| `id` | number | Imutável após criação |
| `data` | string YYYY-MM-DD | Data do fato. Default: hoje (fuso `America/Sao_Paulo`) |
| `origem` | `'usuario'` | Sempre `'usuario'` para entradas manuais |
| `texto` | string | Exatamente o texto enviado (trimado) |
| `criadaEm` | ISO 8601 | Timestamp de criação no servidor |

## 3. Invariantes respeitadas

- **I-05** — Registro é append-only. Não existe `PATCH`, `PUT` ou `DELETE` para
  entradas. A rota criada é exclusivamente `POST`.
- **I-01** — Texto não pode ser vazio após trim. Validado no schema (minLength: 1)
  e como fallback no service (`TEXTO_OBRIGATORIO`).

## 4. Fora do escopo

- Edição ou exclusão de entradas (I-05 proíbe).
- Datas futuras não são bloqueadas — é responsabilidade do usuário.
- Menção a outros usuários ou notificações.
- Attachments, formatação rich-text.
