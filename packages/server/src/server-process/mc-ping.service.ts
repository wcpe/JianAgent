import { Injectable, Logger } from '@nestjs/common';
import { createConnection, type Socket } from 'node:net';

export interface McPingResult {
  readonly online: boolean;
  readonly motd?: string;
  readonly motdRaw?: string;
  readonly onlinePlayers?: number;
  readonly maxPlayers?: number;
  readonly version?: string;
  readonly favicon?: string;
  readonly latencyMs?: number;
}

@Injectable()
export class McPingService {
  private readonly logger = new Logger(McPingService.name);

  async ping(host: string, port: number, timeoutMs = 5000): Promise<McPingResult> {
    return new Promise<McPingResult>((resolve) => {
      let resolved = false;
      const startTime = Date.now();
      const finish = (result: McPingResult) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(result);
      };

      const socket: Socket = createConnection({ host, port, timeout: timeoutMs }, () => {
        try {
          const handshake = this.buildHandshakePacket(host, port);
          socket.write(handshake);
          socket.write(Buffer.from([0x01, 0x00])); // Status request
        } catch (err) {
          this.logger.debug('Failed to write handshake packet', err);
          finish({ online: false });
        }
      });

      let dataBuffer = Buffer.alloc(0);

      socket.on('data', (chunk: Buffer) => {
        dataBuffer = Buffer.concat([dataBuffer, chunk]);
        try {
          const result = this.parseStatusResponse(dataBuffer);
          if (result) finish({ ...result, latencyMs: Date.now() - startTime });
        } catch (_err) {
          // Wait for more data
        }
      });

      socket.on('timeout', () => finish({ online: false }));
      socket.on('error', () => finish({ online: false }));

      setTimeout(() => finish({ online: false }), timeoutMs);
    });
  }

  private buildHandshakePacket(host: string, port: number): Buffer {
    const hostBuf = Buffer.from(host, 'utf-8');
    const data = Buffer.alloc(hostBuf.length + 10);
    let offset = 0;

    // Packet ID: 0x00
    // Protocol Version: -1 (0xff 0xff 0xff 0xff 0x0f as VarInt)
    const packetContent: number[] = [];
    packetContent.push(0x00); // Packet ID

    // Protocol version: -1 as VarInt
    this.writeVarInt(packetContent, -1);

    // Server address as string
    this.writeVarInt(packetContent, hostBuf.length);
    for (const b of hostBuf) packetContent.push(b);

    // Server port as unsigned short
    packetContent.push((port >> 8) & 0xff);
    packetContent.push(port & 0xff);

    // Next state: 1 (status)
    this.writeVarInt(packetContent, 1);

    // Wrap in length-prefixed packet
    const result: number[] = [];
    this.writeVarInt(result, packetContent.length);
    result.push(...packetContent);

    return Buffer.from(result);
  }

  private writeVarInt(out: number[], value: number): void {
    let v = value & 0xffffffff;
    while (true) {
      if ((v & ~0x7f) === 0) {
        out.push(v);
        return;
      }
      out.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
  }

  private readVarInt(buf: Buffer, offset: number): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;
    let b: number;
    do {
      if (offset + bytesRead >= buf.length) throw new Error('Incomplete VarInt');
      b = buf[offset + bytesRead]!;
      result |= (b & 0x7f) << shift;
      shift += 7;
      bytesRead++;
      if (bytesRead > 5) throw new Error('VarInt too big');
    } while ((b & 0x80) !== 0);
    return { value: result, bytesRead };
  }

  private parseStatusResponse(buf: Buffer): McPingResult | null {
    let offset = 0;

    // Read packet length
    const packetLen = this.readVarInt(buf, offset);
    offset += packetLen.bytesRead;

    if (buf.length < offset + packetLen.value) return null; // Need more data

    // Read packet ID
    const packetId = this.readVarInt(buf, offset);
    offset += packetId.bytesRead;

    if (packetId.value !== 0x00) return { online: false };

    // Read JSON string length
    const jsonLen = this.readVarInt(buf, offset);
    offset += jsonLen.bytesRead;

    if (buf.length < offset + jsonLen.value) return null; // Need more data

    const jsonStr = buf.subarray(offset, offset + jsonLen.value).toString('utf-8');

    try {
      const data = JSON.parse(jsonStr);
      const motd = typeof data.description === 'string'
        ? data.description
        : typeof data.description?.text === 'string'
          ? data.description.text
          : undefined;

      const favicon = typeof data.favicon === 'string' ? data.favicon : undefined;

      return {
        online: true,
        motd: motd?.replace(/§[0-9a-fk-or]/g, ''),
        motdRaw: motd,
        onlinePlayers: data.players?.online,
        maxPlayers: data.players?.max,
        favicon,
        version: data.version?.name,
      };
    } catch (err) {
      this.logger.debug('Failed to parse MC ping JSON response', err);
      return { online: true }; // Server responded but JSON was invalid
    }
  }
}
