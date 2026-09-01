import fs from 'node:fs/promises';
import path from 'node:path';
import { ScannedProjectFile } from './adapters/environmentAdapter';
import { toPosixPath } from './adapters/adapterUtils';

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  '.next',
  'coverage',
  'out',
  'vendor',
]);
const MAX_FILES = 5000;
const MAX_DEPTH = 12;

export async function scanProjectFiles(
  projectPath: string,
): Promise<ScannedProjectFile[]> {
  const files: ScannedProjectFile[] = [];
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          // eslint-disable-next-line no-await-in-loop
          await visit(absolutePath, depth + 1);
        }
      } else if (entry.isFile()) {
        files.push({
          absolutePath,
          relativePath: toPosixPath(path.relative(projectPath, absolutePath)),
          name: entry.name,
        });
      }
    }
  };
  await visit(projectPath, 0);
  return files;
}

export default scanProjectFiles;
