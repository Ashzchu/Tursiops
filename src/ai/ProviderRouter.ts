import { AiProvider } from './AiProvider';
import { QwenProvider } from './QwenProvider';
import { GeminiProvider } from './GeminiProvider';

export class ProviderRouter {
  constructor(
    private readonly qwen: QwenProvider,
    private readonly gemini: GeminiProvider
  ) {}

  routeToLocal(_task: 'summarize' | 'compress'): AiProvider {
    return this.qwen;
  }

  routeToCloud(_task: 'change'): GeminiProvider {
    return this.gemini;
  }
}
