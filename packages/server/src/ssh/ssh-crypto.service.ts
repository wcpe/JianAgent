import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = 'jianagent-ssh-cred-v1';

@Injectable()
export class SshCryptoService {
  private readonly logger = new Logger(SshCryptoService.name);
  private readonly key: Buffer;

  constructor() {
    this.key = this.loadOrCreateKey();
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: base64(iv + tag + encrypted)
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      const iv = buf.subarray(0, IV_LENGTH);
      const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch (err) {
      this.logger.warn('Failed to decrypt credential — returning empty string', err);
      return '';
    }
  }

  private loadOrCreateKey(): Buffer {
    const envKey = process.env['JIANAGENT_ENCRYPT_KEY'];
    if (envKey) {
      return scryptSync(envKey, SALT, KEY_LENGTH);
    }

    const dataDir = join(process.cwd(), 'data');
    const keyFile = join(dataDir, 'encrypt.key');

    if (existsSync(keyFile)) {
      const raw = readFileSync(keyFile, 'utf-8').trim();
      return scryptSync(raw, SALT, KEY_LENGTH);
    }

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const generated = randomBytes(32).toString('hex');
    writeFileSync(keyFile, generated, 'utf-8');
    this.logger.log('Generated new encryption key at data/encrypt.key');
    return scryptSync(generated, SALT, KEY_LENGTH);
  }
}
