import { Injectable, Logger } from '@nestjs/common';
import { PLUGIN_PROTOCOL_VERSION } from '@jian-agent/shared-protocol';
import type { HandshakeRequestPayload, HandshakeResponsePayload } from './plugin-bridge.types.js';

@Injectable()
export class HandshakeService {
  private readonly logger = new Logger(HandshakeService.name);

  validate(request: HandshakeRequestPayload): HandshakeResponsePayload {
    if (request.protocolVersion !== PLUGIN_PROTOCOL_VERSION) {
      this.logger.warn(
        `Protocol mismatch: plugin=${request.protocolVersion} server=${PLUGIN_PROTOCOL_VERSION}`,
      );
      return {
        accepted: false,
        protocolVersion: PLUGIN_PROTOCOL_VERSION,
        reason: `Protocol version mismatch. Expected ${PLUGIN_PROTOCOL_VERSION}, got ${request.protocolVersion}`,
      };
    }

    this.logger.log(
      `Handshake accepted: serverId=${request.serverId} plugin=${request.pluginVersion}`,
    );
    return {
      accepted: true,
      protocolVersion: PLUGIN_PROTOCOL_VERSION,
    };
  }
}
