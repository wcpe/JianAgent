export interface JarEntryClassInfo {
  readonly className: string;
  readonly isMainClass: boolean;
  readonly source: string;
}

export function parseManifestText(content: string): Record<string, string> {
  const manifest: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    if (rawLine.length === 0) {
      currentKey = null;
      continue;
    }

    if (rawLine.startsWith(' ')) {
      if (currentKey) {
        manifest[currentKey] += rawLine.slice(1);
      }
      continue;
    }

    const separatorIndex = rawLine.indexOf(':');
    if (separatorIndex === -1) {
      currentKey = null;
      continue;
    }

    currentKey = rawLine.slice(0, separatorIndex).trim();
    manifest[currentKey] = rawLine.slice(separatorIndex + 1).trimStart();
  }

  return manifest;
}

export function createFallbackEntryClasses(
  manifestMainClass: string | undefined,
  classFiles: readonly string[],
): readonly JarEntryClassInfo[] {
  const patterns = ['Main', 'Bootstrap', 'Launcher', 'Server', 'Application', 'App', 'Entry', 'Start'];
  const classNames = new Set<string>();

  if (manifestMainClass) {
    classNames.add(manifestMainClass);
  }

  for (const classFile of classFiles) {
    if (!patterns.some((pattern) => classFile.includes(pattern))) {
      continue;
    }
    classNames.add(classFile.replace(/\.class$/, '').replace(/\//g, '.'));
  }

  return [...classNames].sort().map((className) => ({
    className,
    isMainClass: className === manifestMainClass,
    source: className === manifestMainClass ? 'manifest' : 'heuristic-pattern',
  }));
}