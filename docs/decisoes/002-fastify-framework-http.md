# ADR 002 — Fastify como framework HTTP da API

**Data:** 2026-06-12
**Status:** Aceito

---

## Contexto

A API segue modularização por agregado (`compromissos/`, `auth/`, `registro/`),
requer validação de entrada com resposta 422 e ID de invariante, e deve ser
TypeScript-first. Candidatos avaliados:

1. **Express:** muito familiar, ecossistema imenso. Sem validação built-in — exige
   Zod/Joi como middleware. Tipagem do `Request`/`Response` requer extensões manuais
   para cada decorator (ex.: `req.usuario`).
2. **Fastify:** plugin-first, validação JSON Schema nativa (schema declarado no
   handler), serialização automática, TypeScript first-class com `FastifyInstance`
   genérico. O sistema de plugins (`fastify-plugin`) permite compartilhar decorators
   entre módulos sem acoplamento.

---

## Decisão

Adotar **Fastify v4** como framework HTTP.

---

## Justificativa

- O sistema de plugins casa com a modularização por agregado: cada módulo exporta
  um plugin registrado com `fastify.register(compromissosRoutes, { prefix: '/compromissos' })`.
- Validação declarativa no schema do handler elimina middleware de validação
  separado, mantendo o contrato próximo do código.
- Decorators tipados (`fastify.decorate`, `request.usuario`) são nativamente
  suportados via augmentation do tipo `FastifyRequest`.
- Performance superior ao Express em benchmarks (não é o critério primário, mas
  não custa).

---

## Consequências

- Handlers recebem `FastifyRequest` e `FastifyReply` em vez de `Request`/`Response`.
- O decorator `request.usuario` (usuário autenticado) é adicionado via plugin de
  autenticação (`@fastify/jwt`) e declarado em `src/auth/types.d.ts` para
  augmentation de tipo.
- Plugins registrados com `fastify-plugin` compartilham o scope; plugins sem ele
  criam scope isolado — usar conforme a intenção de encapsulamento.
- Validação de negócio (invariantes I-0x) é responsabilidade da camada de serviço,
  não do schema JSON Schema do Fastify — o schema cuida apenas de tipos e presença;
  as regras condicionais (ex.: I-02 checkpoint antes do prazo) ficam no service.
