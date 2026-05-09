export type WikiResultSource = "mock" | "obsidian-local" | "custom";

export interface WikiSearchQuery {
  term: string;
  limit?: number;
}

export interface WikiSearchResult {
  id: string;
  title: string;
  snippet: string;
  path: string;
  source: WikiResultSource;
}

export interface WikiSearchProvider {
  readonly providerName: string;
  search(query: WikiSearchQuery): Promise<WikiSearchResult[]>;
}

export interface WikiSearchService {
  search(query: WikiSearchQuery): Promise<WikiSearchResult[]>;
}
