export interface JvmProcessDto {
  pid: number;
  command: string;
  name?: string;
  mainClass?: string;
  user?: string;
  startTime?: string;
  uptimeSec?: number;
}

export interface JvmProcessListResponseDto {
  success: boolean;
  data: JvmProcessDto[];
}
