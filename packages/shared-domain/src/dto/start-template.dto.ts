export interface StartTemplateDto {
  readonly id: string;
  readonly name: string;
  readonly javaPath: string;
  readonly jvmArgs: readonly string[];
  readonly serverArgs: readonly string[];
  readonly envVars: Readonly<Record<string, string>>;
  readonly encoding: string;
  readonly runtimeId: string;
  readonly templateGroup: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateStartTemplateDto {
  readonly name: string;
  readonly javaPath: string;
  readonly jvmArgs?: readonly string[];
  readonly serverArgs?: readonly string[];
  readonly envVars?: Readonly<Record<string, string>>;
  readonly encoding?: string;
  readonly runtimeId?: string;
  readonly templateGroup?: string;
  readonly description?: string;
}

export interface UpdateStartTemplateDto {
  readonly name?: string;
  readonly javaPath?: string;
  readonly jvmArgs?: readonly string[];
  readonly serverArgs?: readonly string[];
  readonly envVars?: Readonly<Record<string, string>>;
  readonly encoding?: string;
  readonly runtimeId?: string;
  readonly templateGroup?: string;
  readonly description?: string;
}
