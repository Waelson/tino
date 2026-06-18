import OpenAI from 'openai'
import { config } from '../infra/config.js'
import type { ItemRiscoContexto } from '../compromissos/compromissos.repo.js'

const SYSTEM_PROMPT = `Você é um assistente de gestão para tech leaders. Analisa compromissos em risco (prazo em até 3 dias, sem atualização há 5+ dias) e produz um briefing objetivo em português (pt-BR).

Regras obrigatórias:
- Use sempre a linguagem do domínio: "compromisso" (nunca "tarefa"), "dono", "registro", "prazo".
- Briefing: máximo 3 frases. Identifique padrão (quem, o quê, urgência relativa).
- Ação prioritária: 1 frase concreta e específica — o item mais crítico e o que fazer agora.
- Não invente dados. Use somente o que está no JSON fornecido.
- Se a lista estiver vazia, informe que não há compromissos em risco.
- Responda APENAS com JSON válido. Sem texto fora do JSON.

Formato de resposta:
{
  "briefing": "<string com até 3 frases>",
  "acaoPrioritaria": "<1 frase concreta>"
}`

interface IaRiscoResponse {
  briefing: string
  acaoPrioritaria: string
}

class IaResponseInvalidaError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'IaResponseInvalidaError'
  }
}

function parsearResposta(raw: string): IaRiscoResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match?.[1]) {
      try {
        parsed = JSON.parse(match[1])
      } catch {
        throw new IaResponseInvalidaError('Resposta da IA não é JSON válido.')
      }
    } else {
      throw new IaResponseInvalidaError('Resposta da IA não é JSON válido.')
    }
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['briefing'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['acaoPrioritaria'] !== 'string'
  ) {
    throw new IaResponseInvalidaError('Resposta da IA está fora do formato esperado.')
  }

  const obj = parsed as Record<string, unknown>
  return {
    briefing: obj['briefing'] as string,
    acaoPrioritaria: obj['acaoPrioritaria'] as string,
  }
}

export async function gerarBriefingRisco(
  itens: ItemRiscoContexto[],
): Promise<{ briefing: string; acaoPrioritaria: string; modeloUsado: string }> {
  const apiKey = config.OPENAI_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('OPENAI_API_KEY não configurada.'), { statusCode: 503, erro: 'IA_INDISPONIVEL' })
  }

  const openai = new OpenAI({ apiKey })
  const modelo = config.OPENAI_MODEL

  const userPrompt = `Compromissos em risco (${itens.length} item${itens.length !== 1 ? 's' : ''}):

${JSON.stringify(itens, null, 2)}

Gere o briefing de risco seguindo as regras do sistema.`

  let raw: string
  try {
    const completion = await openai.chat.completions.create({
      model: modelo,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    })
    raw = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const e = err as { message?: string }
    throw Object.assign(
      new Error(`OpenAI indisponível: ${e.message ?? 'erro desconhecido'}`),
      { statusCode: 503, erro: 'IA_INDISPONIVEL' },
    )
  }

  const resultado = parsearResposta(raw)
  return { ...resultado, modeloUsado: modelo }
}
