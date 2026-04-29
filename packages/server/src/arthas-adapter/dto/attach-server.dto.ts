import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AttachServerDto {
  /**
   * Java process PID to attach to
   */
  @IsNotEmpty()
  @IsNumber()
  pid!: number;

  /**
   * Optional Arthas HTTP port (default: 8563)
   */
  @IsOptional()
  @IsNumber()
  httpPort?: number;

  /**
   * Optional Arthas telnet port (default: 3658)
   */
  @IsOptional()
  @IsNumber()
  telnetPort?: number;

  /**
   * Optional tunnel server URL
   */
  @IsOptional()
  @IsString()
  tunnelServer?: string;
}

export interface AttachResult {
  success: boolean;
  serverId: string;
  httpPort: number;
  telnetPort: number;
  error?: string;
}

export interface ArthasStatus {
  attached: boolean;
  serverId: string;
  pid?: number;
  httpPort?: number;
  telnetPort?: number;
  uptime?: number;
  version?: string;
  healthCheckFailed?: boolean;
}
