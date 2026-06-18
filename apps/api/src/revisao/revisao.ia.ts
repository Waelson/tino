import OpenAI from 'openai'
import { config } from '../infra/config.js'
import type { RevisaoSemanaData } from './revisao.service.js'

const SYSTEM_PROMPT = `Você é um assistente de gestão para tech leaders. Analisa dados de compromissos e produz retrospectivas objetivas em português (pt-BR).

Regras obrigatórias:
- Use sempre a linguagem do domínio: "compromisso" (nunca "tarefa"), "dono", "checkpoint", "triagem", "carga", "delegada", "fazer", "adiada".
- Seja direto e objetivo. Máximo de 4 frases na narrativa.
- As sugestões devem ser ações concretas e específicas (quem, o quê, quando). Máximo de 3 sugestões.
- Não invente dados. Use somente o que está no JSON fornecido.
- Se não houver dados relevantes (listas vazias), diga que foi uma semana tranquila e sugira ações preventivas.
- Responda APENAS com JSON válido no formato especificado. Sem texto fora do JSON.

Formato de resposta:
{
  "narrativa": "<string com até 4 frases>",
  "sugestoes": ["<ação concreta 1>", "<ação concreta 2>", "<ação concreta 3>"]
}`

interface IaResponse {
  narrativa: string
  sugestoes: string[]
}

class IaResponseInvalidaError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'IaResponseInvalidaError'
  }
}

function parsearResposta(raw: string): IaResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // tenta extrair JSON de dentro de blocos ```json ... ```
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
    typeof (parsed as Record<string, unknown>)['narrativa'] !== 'string' ||
    !Array.isArray((parsed as Record<string, unknown>)['sugestoes'])
  ) {
    throw new IaResponseInvalidaError('Resposta da IA está fora do formato esperado.')
  }

  const obj = parsed as Record<string, unknown>
  return {
    narrativa: obj['narrativa'] as string,
    sugestoes: (obj['sugestoes'] as unknown[]).map(String),
  }
}

export async function gerarNarrativa(
  dados: RevisaoSemanaData,
): Promise<{ narrativa: string; sugestoes: string[]; modeloUsado: string }> {
  const apiKey = config.OPENAI_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('OPENAI_API_KEY não configurada.'), { statusCode: 503, erro: 'IA_INDISPONIVEL' })
  }

  const openai = new OpenAI({ apiKey })
  const modelo = config.OPENAI_MODEL

  const userPrompt = `Dados da semana ${dados.semana} (${dados.periodo.inicio} a ${dados.periodo.fim}):

${JSON.stringify(
    {
      resumo: dados.resumo,
      concluidos: dados.concluidos.map((c) => ({ titulo: c.titulo, dono: c.dono, concluidoEm: c.concluidoEm })),
      paralisados: dados.paralisados.map((c) => ({ titulo: c.titulo, dono: c.dono, prazo: c.prazo, diasSemAtualizacao: c.diasSemAtualizacao })),
      redelegados: dados.redelegados.map((c) => ({ titulo: c.titulo, donoAtual: c.donoAtual, dataRedelegacao: c.dataRedelegacao })),
      donosEmSilencio: dados.donosEmSilencio,
    },
    null,
    2,
  )}

Gere a retrospectiva seguindo as regras do sistema.`

  let raw: string
  try {
    const completion = await openai.chat.completions.create({
      model: modelo,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
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
