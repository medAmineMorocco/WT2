import type { AskResult, Graft } from '@nanonets/graft';
import log from '../../utils/logger';

type GraftModule = typeof import('@nanonets/graft');

const MAX_CONTEXT_CHARS = 12000;

/**
 * Loads Graft at runtime because it is an ESM package while Electron's main
 * bundle is CommonJS. Keeping the import native also lets Graft resolve its
 * tree-sitter grammar packages from the packaged application.
 */
const importEsm = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<GraftModule>;

export class GraftSmartContextService {
  private engines = new Map<string, Graft>();

  private refreshes = new Map<string, Promise<void>>();

  private normalizePath(value: string): string {
    return value.replace(/\\/g, '/').toLowerCase();
  }

  private async engineFor(worktreePath: string): Promise<Graft> {
    const key = this.normalizePath(worktreePath);
    const existing = this.engines.get(key);
    if (existing) return existing;

    const { Graft: GraftEngine } = await importEsm('@nanonets/graft');
    const engine = new GraftEngine();
    this.engines.set(key, engine);
    return engine;
  }

  private async refresh(worktreePath: string, engine: Graft): Promise<void> {
    const key = this.normalizePath(worktreePath);
    const existing = this.refreshes.get(key);
    if (existing) return existing;

    const refresh = engine
      .graph(worktreePath, { reuse: true })
      .then(() => undefined)
      .finally(() => this.refreshes.delete(key));
    this.refreshes.set(key, refresh);
    return refresh;
  }

  private format(result: AskResult): string {
    if (result.hits.length === 0) return '';

    const sections = result.hits.map((hit) => {
      const body = hit.code?.trim() || hit.snippet.trim();
      return [`### ${hit.title}`, `Source: ${hit.pointer}`, body]
        .filter(Boolean)
        .join('\n');
    });

    return sections.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
  }

  async retrieve(worktreePath: string, prompt: string): Promise<string> {
    if (!prompt.trim()) return '';

    try {
      const engine = await this.engineFor(worktreePath);
      await this.refresh(worktreePath, engine);
      return this.format(
        engine.ask(worktreePath, prompt, {
          limit: 5,
          source: true,
          graphRank: true,
        }),
      );
    } catch (error) {
      log.warn(`Graft smart context unavailable for ${worktreePath}: ${error}`);
      return '';
    }
  }
}

export const graftSmartContextService = new GraftSmartContextService();
export default graftSmartContextService;
