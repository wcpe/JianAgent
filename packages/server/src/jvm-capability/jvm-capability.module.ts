import { Module } from '@nestjs/common';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';
import { JavaRuntimeModule } from '../java-runtime/java-runtime.module.js';
import { JvmCapabilityRegistry } from './jvm-capability.registry.js';
import { JvmTargetResolver } from './jvm-target.resolver.js';
import { JavaHelperCapabilityProvider } from './providers/java-helper-capability.provider.js';
import { ProbeCapabilityProvider } from './providers/probe-capability.provider.js';
import { ExternalAttachProvider } from './providers/external-attach.provider.js';

@Module({
  imports: [JavaHelperModule, JavaRuntimeModule],
  providers: [
    JvmCapabilityRegistry,
    JvmTargetResolver,
    JavaHelperCapabilityProvider,
    ProbeCapabilityProvider,
    ExternalAttachProvider,
  ],
  exports: [JvmCapabilityRegistry, JvmTargetResolver, JavaHelperCapabilityProvider, ProbeCapabilityProvider, ExternalAttachProvider],
})
export class JvmCapabilityModule {}
