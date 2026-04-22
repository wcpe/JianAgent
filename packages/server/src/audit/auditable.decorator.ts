import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable_operation';
export const Auditable = (operation: string) => SetMetadata(AUDITABLE_KEY, operation);
