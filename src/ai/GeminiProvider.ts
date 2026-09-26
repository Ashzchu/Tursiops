import { ApiKeyManager } from './ApiKeyManager';
import { AgentResponseSchema, AgentResponse } from './AiSchemas';

// Use the ContextPacket shape inline to avoid circular dep (Agent 7 defines it formally)
interface MinimalContextPacket {
  filePath: string;
  language: string;
  userPrompt: string;
  currentFile: { content: string; hash: string };
  memory: { summary: string; constraints: string[]; decisions: string[]; knownFlaws: string[] };
  relatedFiles: Array<{ path: string; content: string }>;
}

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class GeminiProvider {
  constructor(private readonly apiKeyManager: ApiKeyManager) {}

  async requestChange(userPrompt: string, packet: MinimalContextPacket): Promise<AgentResponse> {
    const key = await this.apiKeyManager.getGeminiKey();
    if (!key) {
      throw new Error('Gemini API key not set. Use "Tursiops: Set Gemini Key" command.');
    }

    const systemPrompt = `You are a code editing assistant. You MUST respond with a single valid JSON object and nothing else — no markdown, no explanation, no code fences. The JSON must have exactly these fields:
{
  "updatedFile": "<complete new file content as a string>",
  "summary": "<one sentence describing the change>",
  "decisions": ["<decision made>"],
  "warnings": ["<any warning or concern>"],
  "testsToRun": ["<test commands to run>"],
  "confidence": <number between 0 and 1>
}`;

    const relatedContext = packet.relatedFiles.length > 0
      ? '\n\nRelated files:\n' + packet.relatedFiles.map(f => `// ${f.path}\n${f.content}`).join('\n\n')
      : '';

    const userMessage = `File: ${packet.filePath} (${packet.language})
Memory summary: ${packet.memory.summary || 'none'}
Constraints: ${packet.memory.constraints.join(', ') || 'none'}
Known flaws: ${packet.memory.knownFlaws.join(', ') || 'none'}

Current file content:
${packet.currentFile.content}${relatedContext}

Task: ${userPrompt}`;

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    };

    let response: Response;
    try {
      response = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      throw new Error('Failed to reach Gemini API. Check your internet connection.');
    }

    if (!response.ok) {
      // Do NOT include the key in error messages
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    // Strip markdown fences if Gemini wraps the JSON anyway
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('Gemini returned invalid JSON. Try again.');
    }

    const result = AgentResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Gemini response failed validation: ${result.error.message}`);
    }

    return result.data;
  }
}
