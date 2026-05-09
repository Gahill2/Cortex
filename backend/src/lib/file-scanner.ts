export type FileSource = "mock" | "local-filesystem" | "custom";

export interface ScannedFile {
  path: string;
  name: string;
  extension: string;
  source: FileSource;
  modifiedAt: string;
}

export interface FileSearchQuery {
  term?: string;
  roots?: string[];
  extensions?: string[];
  limit?: number;
}

export interface FileScannerProvider {
  readonly providerName: string;
  scanFiles(query?: FileSearchQuery): Promise<ScannedFile[]>;
}

export interface FileScannerService {
  scanFiles(query?: FileSearchQuery): Promise<ScannedFile[]>;
}
