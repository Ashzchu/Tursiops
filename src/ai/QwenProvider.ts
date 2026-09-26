import { AiProvider } from './AiProvider';
import { FileMemory } from '../memory/MemorySchema';

const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const OLLAMA_BASE = 'http://localhost:11434';

export class QwenProvider implements AiProvider {
  constructor(private readonly modelName: string = DEFAULT_MODEL) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(OLLAMA_BASE, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }

  async summarize(content: string, language: string): Promise<string> {
    // Truncate content to 4000 chars to avoid huge prompts
    const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n...(truncated)' : content;
    const prompt = `Summarise this ${language} file in 3-5 sentences focusing on purpose, key functions, and important constraints:\n\n${truncated}`;
    return this._generate(prompt);
  }

  async compress(memory: FileMemory): Promise<FileMemory> {
    const eventSummaries = memory.events.slice(-10).map(e => `[${e.type}] ${e.summary}`).join('\n');
    const prompt = `You are compressing a file memory record. Return ONLY a JSON object with these keys: "summary" (string), "decisions" (string[]), "constraints" (string[]), "knownFlaws" (string[]).

Current summary: ${memory.summary}
Recent events:
${eventSummaries}

Compress and update. Return valid JSON only.`;

    const raw = await this._generate(prompt);
    try {
      const parsed = JSON.parse(raw.trim());
      return {
        ...memory,
        summary: typeof parsed.summary === 'string' ? parsed.summary : memory.summary,
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : memory.decisions,
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : memory.constraints,
        knownFlaws: Array.isArray(parsed.knownFlaws) ? parsed.knownFlaws : memory.knownFlaws,
        events: memory.events.slice(-5), // keep only last 5 after compression
      };
    } catch {
      // If JSON parse fails, return original memory unchanged
      return memory;
    }
  }

  private async _generate(prompt: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.modelName, prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new Error('Ollama is not running. Start Ollama to use local AI features.');
    }
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}. Make sure the model "${this.modelName}" is pulled.`);
    }
    const data = await response.json() as { response?: string };
    if (!data.response) {
      throw new Error('Ollama returned an empty response.');
    }
    return data.response;
  }
}
