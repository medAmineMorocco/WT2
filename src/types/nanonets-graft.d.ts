declare module '@nanonets/graft' {
  export type AskHit = {
    title: string;
    pointer: string;
    snippet: string;
    code?: string;
  };

  export type AskResult = {
    hits: AskHit[];
  };

  export class Graft {
    graph(
      dir: string,
      options?: { reuse?: boolean },
    ): Promise<{ errors: string[] }>;

    ask(
      dir: string,
      query: string,
      options?: {
        limit?: number;
        source?: boolean;
        graphRank?: boolean;
      },
    ): AskResult;
  }
}
