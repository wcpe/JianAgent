export interface JvmProcessDto {
  pid: number;
  command: string;
  name?: string;
}

export interface JvmProcessListResponseDto {
  success: boolean;
  data: JvmProcessDto[];
}
