export class PortUsageDto {
  port!: number;

  protocol!: string;

  pid!: number;

  processName?: string;

  commandLine?: string;

  isJvm!: boolean;

  jvmMainClass?: string;
}
