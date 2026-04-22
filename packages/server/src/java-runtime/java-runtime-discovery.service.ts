import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface DiscoveredJavaRuntime {
  name: string;
  home: string;
  bin: string;
  version: string;
  vendor: string;
}

@Injectable()
export class JavaRuntimeDiscoveryService {
  private readonly logger = new Logger(JavaRuntimeDiscoveryService.name);

  async discoverAll(): Promise<DiscoveredJavaRuntime[]> {
    const results: DiscoveredJavaRuntime[] = [];
    const seen = new Set<string>();

    // 1. Check JAVA_HOME
    const javaHome = process.env['JAVA_HOME'];
    if (javaHome) {
      const candidate = await this.probeJavaHome(javaHome);
      if (candidate && !seen.has(candidate.bin)) {
        results.push(candidate);
        seen.add(candidate.bin);
      }
    }

    // 2. Check PATH for java
    const pathJava = await this.probePathJava();
    if (pathJava && !seen.has(pathJava.bin)) {
      results.push(pathJava);
      seen.add(pathJava.bin);
    }

    // 3. Scan common directories
    const commonDirs = await this.getCommonJdkDirs();
    for (const dir of commonDirs) {
      const candidate = await this.probeJavaHome(dir);
      if (candidate && !seen.has(candidate.bin)) {
        results.push(candidate);
        seen.add(candidate.bin);
      }
    }

    this.logger.log(`Discovered ${results.length} Java runtime(s)`);
    return results;
  }

  private async getCommonJdkDirs(): Promise<string[]> {
    const dirs: string[] = [];

    // /usr/lib/jvm (Linux)
    try {
      const entries = await fs.readdir('/usr/lib/jvm');
      for (const entry of entries) {
        const fullPath = join('/usr/lib/jvm', entry);
        const stat = await fs.stat(fullPath).catch(() => null);
        if (stat?.isDirectory()) {
          dirs.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }

    // ~/.sdkman/candidates/java (SDKMAN)
    const sdkmanHome = process.env['HOME'];
    if (sdkmanHome) {
      try {
        const sdkmanJavaDir = join(sdkmanHome, '.sdkman', 'candidates', 'java');
        const entries = await fs.readdir(sdkmanJavaDir);
        for (const entry of entries) {
          if (entry === 'current') continue; // Skip symlink to avoid duplicates
          const home = join(sdkmanJavaDir, entry);
          const stat = await fs.stat(home).catch(() => null);
          if (stat?.isDirectory()) {
            dirs.push(home);
          }
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    // /Library/Java/JavaVirtualMachines (macOS)
    try {
      const entries = await fs.readdir('/Library/Java/JavaVirtualMachines');
      for (const entry of entries) {
        const home = join('/Library/Java/JavaVirtualMachines', entry, 'Contents', 'Home');
        const stat = await fs.stat(home).catch(() => null);
        if (stat?.isDirectory()) {
          dirs.push(home);
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }

    // ~/Library/Java/JavaVirtualMachines (macOS user)
    const userHome = process.env['HOME'];
    if (userHome) {
      try {
        const userJdkDir = join(userHome, 'Library', 'Java', 'JavaVirtualMachines');
        const entries = await fs.readdir(userJdkDir);
        for (const entry of entries) {
          const home = join(userJdkDir, entry, 'Contents', 'Home');
          const stat = await fs.stat(home).catch(() => null);
          if (stat?.isDirectory()) {
            dirs.push(home);
          }
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return dirs;
  }

  private async probeJavaHome(home: string): Promise<DiscoveredJavaRuntime | null> {
    const binPath = join(home, 'bin', 'java');
    try {
      await fs.access(binPath);
    } catch {
      // No java binary in this home
      return null;
    }

    const versionInfo = await this.getVersionInfo(binPath);
    if (!versionInfo) return null;

    return {
      name: this.deriveName(home, versionInfo),
      home,
      bin: binPath,
      version: versionInfo.version,
      vendor: versionInfo.vendor,
    };
  }

  private async probePathJava(): Promise<DiscoveredJavaRuntime | null> {
    const binPath = await this.which('java');
    if (!binPath) return null;

    // Resolve symlink to find home
    let resolvedBin = binPath;
    try {
      resolvedBin = await fs.realpath(binPath);
    } catch {
      // keep original
    }

    // java binary is typically at $JAVA_HOME/bin/java
    const binDir = join(resolvedBin, '..');
    const home = join(binDir, '..');

    const versionInfo = await this.getVersionInfo(binPath);
    if (!versionInfo) return null;

    return {
      name: this.deriveName(home, versionInfo),
      home,
      bin: binPath,
      version: versionInfo.version,
      vendor: versionInfo.vendor,
    };
  }

  private async getVersionInfo(javaBin: string): Promise<{ version: string; vendor: string } | null> {
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(javaBin, ['-version'], { timeout: 5000 }, (err, _stdout, stderr) => {
          if (err) reject(err);
          else resolve(stderr || _stdout);
        });
      });

      // Parse version: e.g. 'openjdk version "17.0.2" ...' or 'java version "1.8.0_312"'
      const versionMatch = stdout.match(/(?:openjdk|java) version "([^"]+)"/i);
      const version = versionMatch?.[1] ?? '';

      // Parse vendor
      let vendor = 'unknown';
      if (/temurin/i.test(stdout)) vendor = 'Eclipse Temurin';
      else if (/corretto/i.test(stdout)) vendor = 'Amazon Corretto';
      else if (/zulu/i.test(stdout)) vendor = 'Azul Zulu';
      else if (/adoptopenjdk/i.test(stdout)) vendor = 'AdoptOpenJDK';
      else if (/graalvm/i.test(stdout)) vendor = 'GraalVM';
      else if (/openjdk/i.test(stdout)) vendor = 'OpenJDK';
      else if (/hotspot/i.test(stdout)) vendor = 'Oracle HotSpot';

      return { version, vendor };
    } catch {
      return null;
    }
  }

  private deriveName(home: string, info: { version: string; vendor: string }): string {
    // Try to use directory name as a human-friendly label
    const parts = home.replace(/[/\\]$/, '').split(/[/\\]/);
    const dirName = parts[parts.length - 1] || home;
    if (dirName === 'Home' && parts.length >= 2) {
      // macOS style: .../jdk-17.0.2.jdk/Contents/Home
      return parts[parts.length - 3] ?? dirName;
    }
    if (info.vendor !== 'unknown') {
      return `${info.vendor} ${info.version}`;
    }
    return dirName;
  }

  private async which(cmd: string): Promise<string | null> {
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile('which', [cmd], { timeout: 5000 }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout.trim());
        });
      });
      return stdout || null;
    } catch {
      return null;
    }
  }
}
