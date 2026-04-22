import { Injectable } from '@nestjs/common';

export interface PaperBuildDescriptor {
  readonly version: string;
  readonly build: number;
  readonly downloadUrl: string;
  readonly fileName: string;
}

interface PaperVersionResponse {
  readonly builds?: readonly unknown[];
}

@Injectable()
export class PaperReleaseService {
  async resolveBuild(version: string): Promise<PaperBuildDescriptor> {
    const url = `https://api.papermc.io/v2/projects/paper/versions/${encodeURIComponent(version)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Paper version lookup failed for ${version}: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as PaperVersionResponse;
    const builds = Array.isArray(payload.builds)
      ? payload.builds.filter((build): build is number => Number.isInteger(build))
      : [];

    if (builds.length === 0) {
      throw new Error(`No Paper build found for ${version}`);
    }

    const build = Math.max(...builds);
    const fileName = `paper-${version}-${build}.jar`;

    return {
      version,
      build,
      fileName,
      downloadUrl: `https://api.papermc.io/v2/projects/paper/versions/${encodeURIComponent(version)}/builds/${build}/downloads/${fileName}`,
    };
  }

  async downloadBuild(descriptor: PaperBuildDescriptor): Promise<Buffer> {
    const response = await fetch(descriptor.downloadUrl, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Paper download failed for ${descriptor.version} build ${descriptor.build}: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
