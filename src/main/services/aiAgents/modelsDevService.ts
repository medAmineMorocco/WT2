import { net } from 'electron';
import https from 'https';
import { spawn } from 'child_process';
import {
  AiAgentId,
  AiAgentModel,
  getAgentModels,
} from '../../../shared/aiAgents';
import log from '../../utils/logger';
import { detectAiAgent, getAugmentedEnv } from './aiAgentDetectionService';

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Executes an HTTP GET request using Electron's native `net.request`.
 * In environments where Electron `net` is unavailable (e.g. Node test runners),
 * gracefully falls back to Node's built-in `https.get`.
 */
function fetchJsonViaElectronNet<T>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    // 1. Electron native way using net.request
    if (net && typeof net.request === 'function') {
      const request = net.request({
        method: 'GET',
        url,
      });

      request.setHeader('Accept', 'application/json');
      request.setHeader('User-Agent', 'WorktreeWise-Desktop');

      const timer = setTimeout(() => {
        request.abort();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      request.on('response', (response: any) => {
        const statusCode = response.statusCode;
        if (statusCode && (statusCode < 200 || statusCode >= 300)) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        let body = '';
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
        });

        response.on('end', () => {
          clearTimeout(timer);
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (err: any) {
            reject(new Error(`Failed to parse response JSON: ${err.message}`));
          }
        });

        response.on('error', (err: any) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      request.on('error', (err: any) => {
        clearTimeout(timer);
        reject(err);
      });

      request.end();
      return;
    }

    // 2. Node native fallback for non-Electron test runner environments
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'WorktreeWise-Desktop',
        },
      },
      (res) => {
        const statusCode = res.statusCode;
        if (statusCode && (statusCode < 200 || statusCode >= 300)) {
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString('utf8');
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err: any) {
            reject(err);
          }
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
  });
}

const AGENT_PROVIDER_MAP: Record<AiAgentId, string[]> = {
  claude: ['anthropic'],
  codex: ['openai'],
  cursor: ['anthropic', 'openai'],
  antigravity: ['google'],
  qwen: ['alibaba'],
  kimi: ['moonshotai', 'moonshotai-cn'],
  opencode: ['anthropic', 'openai', 'deepseek'],
};

interface ModelsDevModelEntry {
  name?: string;
  description?: string;
  release_date?: string;
  last_updated?: string;
}

interface ModelsDevProviderEntry {
  name?: string;
  models?: Record<string, ModelsDevModelEntry>;
}

type ModelsDevResponse = Record<string, ModelsDevProviderEntry>;

export function sortModelsNewestFirst(models: AiAgentModel[]): AiAgentModel[] {
  return [...models].sort((left, right) => {
    const leftDate = left.releaseDate || left.lastUpdated || '';
    const rightDate = right.releaseDate || right.lastUpdated || '';
    const dateComparison = rightDate.localeCompare(leftDate);
    if (dateComparison !== 0) return dateComparison;
    return left.label.localeCompare(right.label);
  });
}

class ModelsDevService {
  private cache: ModelsDevResponse | null = null;
  private cacheExpiresAt = 0;
  private fetchPromise: Promise<ModelsDevResponse | null> | null = null;

  async fetchCatalog(): Promise<ModelsDevResponse | null> {
    const now = Date.now();
    if (this.cache && this.cacheExpiresAt > now) {
      return this.cache;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const data = await fetchJsonViaElectronNet<ModelsDevResponse>(
          MODELS_DEV_URL,
          8000,
        );
        this.cache = data;
        this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        log.info(
          `[ModelsDevService] Successfully refreshed models catalog from models.dev using Electron native net (${Object.keys(data).length} providers)`,
        );
        return data;
      } catch (error: any) {
        log.warn(
          `[ModelsDevService] Failed fetching models from models.dev: ${error?.message || error}`,
        );
        return this.cache;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  private async getOpenCodeModels(customCommand?: string): Promise<AiAgentModel[]> {
    const detection = await detectAiAgent('opencode', customCommand);
    const command = detection.executablePath || detection.command;
    if (!command) return getAgentModels('opencode');

    return new Promise((resolve) => {
      const child = spawn(command, ['models'], {
        env: getAugmentedEnv(),
        windowsHide: true,
        shell: process.platform === 'win32' && !command.toLowerCase().endsWith('.exe'),
      });
      let output = '';
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        const seen = new Set<string>();
        const models = output
          .replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/[\w./:@-]+$/.test(line))
          .filter((id) => {
            const key = id.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((id) => ({
            id,
            label: `${id.split('/').pop()} (${id.split('/')[0]})`,
          }));
        resolve([{ id: '', label: 'Default' }, ...models]);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish();
      }, 8000);
      child.stdout?.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.once('error', () => {
        clearTimeout(timer);
        finish();
      });
      child.once('close', () => {
        clearTimeout(timer);
        finish();
      });
    });
  }

  async getModelsForAgent(
    agentId: AiAgentId,
    customCommand?: string,
  ): Promise<AiAgentModel[]> {
    // 1. Start with static base models so we always have guaranteed defaults
    const baseModels = getAgentModels(agentId);
    const existingIds = new Set(baseModels.map((m) => m.id.toLowerCase()));

    // These CLIs expose account-specific catalogs. Generic models.dev entries
    // may be syntactically valid but unavailable to the signed-in account.
    if (agentId === 'cursor') return baseModels;
    if (agentId === 'opencode') return this.getOpenCodeModels(customCommand);

    const catalog = await this.fetchCatalog();
    if (!catalog) {
      return baseModels;
    }

    const providers = AGENT_PROVIDER_MAP[agentId] || [];
    const dynamicModels: AiAgentModel[] = [];

    for (const provider of providers) {
      const providerEntry = catalog[provider];
      if (!providerEntry?.models) continue;

      for (const [modelId, modelData] of Object.entries(providerEntry.models)) {
        const effectiveId =
          agentId === 'opencode' ? `${provider}/${modelId}` : modelId;
        const lowerId = effectiveId.toLowerCase();
        if (existingIds.has(lowerId)) continue;

        // Specific agent filtering heuristics
        if (agentId === 'qwen' && !lowerId.includes('qwen')) {
          continue;
        }
        if (
          agentId === 'kimi' &&
          !lowerId.includes('kimi') &&
          !lowerId.includes('moonshot')
        ) {
          continue;
        }

        existingIds.add(lowerId);
        dynamicModels.push({
          id: effectiveId,
          label: modelData.name || modelId,
          description: modelData.description,
          releaseDate: modelData.release_date,
          lastUpdated: modelData.last_updated,
        });
      }
    }

    const defaultModel = baseModels.find((model) => model.id === '');
    const fallbackModels = baseModels.filter((model) => model.id !== '');

    // Keep Default first, then show catalog models newest-to-oldest. Static
    // aliases remain available below them as reliable offline fallbacks.
    return [
      ...(defaultModel ? [defaultModel] : []),
      ...sortModelsNewestFirst(dynamicModels),
      ...fallbackModels,
    ];
  }

  clearCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }
}

export const modelsDevService = new ModelsDevService();
export default modelsDevService;
