import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class ExecuteCommandDto {
  /**
   * Target server ID to execute command on
   */
  @IsNotEmpty()
  @IsString()
  serverId!: string;

  /**
   * Arthas command to execute (e.g., "dashboard", "thread", "jvm")
   */
  @IsNotEmpty()
  @IsString()
  command!: string;

  /**
   * Optional timeout in milliseconds (default: 30000)
   */
  @IsOptional()
  @IsNumber()
  timeout?: number;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}
