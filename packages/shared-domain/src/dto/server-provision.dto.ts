export type ServerCoreType = 'paper' | 'custom';

export interface ProvisionServerRequest {
  readonly name: string;
  readonly coreType: ServerCoreType;
  readonly minecraftVersion?: string;
  readonly jarPath?: string;
  readonly workDir: string;
  readonly port?: number;
  readonly maxMemory?: string;
  readonly minMemory?: string;
  readonly runtimeId?: string;
  readonly javaPath?: string;
  readonly autoStart?: boolean;
  readonly agreeEula?: boolean;
  readonly serverArgs?: readonly string[];
  readonly jvmArgs?: readonly string[];
  readonly serverGroup?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
  readonly serverProperties?: Readonly<Record<string, string>>;
}

export type ProvisionPhase =
  | 'VALIDATING'
  | 'CREATING_DIRECTORY'
  | 'DOWNLOADING_CORE'
  | 'WRITING_CONFIG'
  | 'CREATING_SERVER'
  | 'STARTING'
  | 'READY'
  | 'FAILED';

export interface ProvisionProgressEvent {
  readonly serverId: string;
  readonly phase: ProvisionPhase;
  readonly progress: number;
  readonly message: string;
  readonly error?: string;
}

export interface ProvisionServerResponse {
  readonly serverId: string;
  readonly name: string;
  readonly workDir: string;
  readonly jarPath: string;
  readonly port: number;
}

export interface PaperVersionInfo {
  readonly version: string;
  readonly latestBuild: number;
}
