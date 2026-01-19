import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export type MediaFile = {
  name: string;
  path: string;
  type: 'mp4' | 'smi' | 'syn' | 'other';
};

export function usePackageImport() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importPackage = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Open directory selection dialog
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Package Folder',
      });

      if (!selected) {
        setIsLoading(false);
        return;
      }

      const projectDir = selected as string;
      setProjectPath(projectDir);

      // 2. Check for "media" directory
      const mediaDirPath = await join(projectDir, 'media');
      const mediaExists = await exists(mediaDirPath);

      if (!mediaExists) {
        throw new Error('Invalid package: "media" directory not found.');
      }

      // 3. Scan "media" directory
      const entries = await readDir(mediaDirPath);
      const foundFiles: MediaFile[] = [];

      for (const entry of entries) {
        if (entry.isFile) {
          const extension = entry.name.split('.').pop()?.toLowerCase();
          if (extension === 'mp4') {
            foundFiles.push({
              name: entry.name,
              path: await join(mediaDirPath, entry.name),
              type: 'mp4',
            });
          } else if (extension === 'smi') {
            foundFiles.push({
              name: entry.name,
              path: await join(mediaDirPath, entry.name),
              type: 'smi',
            });
          }
        }
      }

      // 4. Scan root directory for .syn file
      const rootEntries = await readDir(projectDir);
      for (const entry of rootEntries) {
        if (entry.isFile && entry.name.endsWith('.syn')) {
          foundFiles.push({
            name: entry.name,
            path: await join(projectDir, entry.name),
            type: 'syn',
          });
        }
      }

      setMediaFiles(foundFiles);

    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || 'Failed to import package');
      setProjectPath(null);
      setMediaFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearImport = () => {
    setProjectPath(null);
    setMediaFiles([]);
    setError(null);
  };

  return {
    projectPath,
    mediaFiles,
    isLoading,
    error,
    importPackage,
    clearImport,
  };
}
