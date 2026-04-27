export class PortUsageDto {
  port!: number;

  protocol!: string;

  pid!: number;

  processName?: string;

  status?: string;

  hostId?: string;

  hostname?: string;

  timestamp?: string;

  commandLine?: string;

  isJvm!: boolean;

  jvmMainClass?: string;
}
