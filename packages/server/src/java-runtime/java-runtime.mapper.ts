import { Injectable } from '@nestjs/common';
import type { JavaRuntimeDto, JavaRuntimeSource } from '@jian-agent/shared-domain';
import type { javaRuntimes } from '../storage/schema.js';

type JavaRuntimeRow = typeof javaRuntimes.$inferSelect;

@Injectable()
export class JavaRuntimeMapper {
  toDto(row: JavaRuntimeRow): JavaRuntimeDto {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      vendor: row.vendor,
      home: row.home,
      bin: row.bin,
      source: row.source as JavaRuntimeSource,
      isDefault: row.isDefault,
      autoDiscovered: row.autoDiscovered,
    };
  }

  toDtoList(rows: JavaRuntimeRow[]): JavaRuntimeDto[] {
    return rows.map((row) => this.toDto(row));
  }
}
