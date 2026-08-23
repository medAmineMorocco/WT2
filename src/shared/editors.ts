export interface EditorDetectionResult {
  label: string;
  key: string;
  found: boolean;
  path: string;
  version: string | null;
}
