import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile, writeFile, unlink, mkdir, stat, rename } from 'node:fs/promises';
import { join, resolve, relative, posix } from 'node:path';
import type { FileEntry, FileStat } from '../ssh/sftp-file.service.js';

@Injectable()
export class LocalFileProvider {
  private readonly logger = new Logger(LocalFileProvider.name);

  async readDir(rootDir: string, relativePath: string): Promise<readonly FileEntry[]> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    const items = await readdir(safePath, { withFileTypes: true });
    const entries: FileEntry[] = [];

    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      const fullPath = join(safePath, item.name);
      try {
        const s = await stat(fullPath);
        entries.push({
          name: item.name,
          path: posix.join(relativePath, item.name),
          isDirectory: item.isDirectory(),
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
          permissions: (s.mode & 0o777).toString(8),
        });
      } catch { /* skip inaccessible files */ }
    }

    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readFileContent(rootDir: string, relativePath: string): Promise<Buffer> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    return readFile(safePath);
  }

  async writeFileContent(rootDir: string, relativePath: string, content: Buffer | string): Promise<void> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    await writeFile(safePath, content);
  }

  async deleteEntry(rootDir: string, relativePath: string): Promise<void> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    const s = await stat(safePath);
    if (s.isDirectory()) {
      const { rm } = await import('node:fs/promises');
      await rm(safePath, { recursive: true, force: true });
    } else {
      await unlink(safePath);
    }
  }

  async mkdirEntry(rootDir: string, relativePath: string): Promise<void> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    await mkdir(safePath, { recursive: true });
  }

  async statEntry(rootDir: string, relativePath: string): Promise<FileStat> {
    const safePath = this.resolveSafe(rootDir, relativePath);
    const s = await stat(safePath);
    return {
      isDirectory: s.isDirectory(),
      size: s.size,
      modifiedAt: s.mtime.toISOString(),
      permissions: (s.mode & 0o777).toString(8),
    };
  }

  async renameEntry(rootDir: string, oldPath: string, newPath: string): Promise<void> {
    const safeOld = this.resolveSafe(rootDir, oldPath);
    const safeNew = this.resolveSafe(rootDir, newPath);
    await rename(safeOld, safeNew);
  }

  async exists(rootDir: string, relativePath: string): Promise<boolean> {
    try {
      const safePath = this.resolveSafe(rootDir, relativePath);
      await stat(safePath);
      return true;
    } catch {
      return false;
    }
  }

  private resolveSafe(rootDir: string, relativePath: string): string {
    // Normalize: strip leading slashes so resolve() treats it as relative to rootDir
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) {
      throw new Error(`Path traversal rejected: ${relativePath}`);
    }
    const fullPath = normalized ? resolve(rootDir, normalized) : resolve(rootDir);
    const rel = relative(rootDir, fullPath);
    if (rel.startsWith('..') || resolve(fullPath) === resolve(rootDir, '..')) {
      throw new Error(`Path traversal rejected: ${relativePath}`);
    }
    return fullPath;
  }
}
