import type { JavaRuntimeSource } from '../enums/java-runtime-source.js';

export interface JavaRuntimeDto {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly vendor: string;
  readonly home: string;
  readonly bin: string;
  readonly source: JavaRuntimeSource;
  readonly isDefault: boolean;
  readonly autoDiscovered: boolean;
}
