import { beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { StartReadyDetector } from '../lifecycle/start-ready-detector.service.js';

describe('StartReadyDetector', () => {
  let detector: StartReadyDetector;

  beforeEach(() => {
    detector = new StartReadyDetector();
  });

  it('should detect MC standard ready line', async () => {
    const promise = detector.waitForReady('srv-1', undefined, 5000);
    detector.onOutput('srv-1', '[12:00:00 INFO]: Loading libraries...');
    detector.onOutput('srv-1', '[12:00:01 INFO]: Preparing level "world"');
    detector.onOutput('srv-1', '[12:00:02 INFO]: Done (3.45s)! For help, type "help"');
    const result = await promise;
    expect(result.ready).toBe(true);
    expect(result.durationMs).toBeLessThan(5000);
  });

  it('should timeout if ready line never appears', async () => {
    const promise = detector.waitForReady('srv-2', undefined, 500);
    detector.onOutput('srv-2', '[12:00:00 INFO]: Still loading...');
    const result = await promise;
    expect(result.ready).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('should use custom ready pattern', async () => {
    const promise = detector.waitForReady('srv-3', 'SERVER IS READY', 5000);
    detector.onOutput('srv-3', 'Some log line');
    detector.onOutput('srv-3', 'SERVER IS READY');
    const result = await promise;
    expect(result.ready).toBe(true);
  });

  it('should cancel waiting', () => {
    detector.waitForReady('srv-4', undefined, 10000);
    expect(() => detector.cancel('srv-4')).not.toThrow();
  });

  it('should detect ready lines emitted via server.output events', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [StartReadyDetector],
    }).compile();
    await moduleRef.init();

    const eventBus = moduleRef.get(EventEmitter2);
    const subscribedDetector = moduleRef.get(StartReadyDetector);
    const promise = subscribedDetector.waitForReady('srv-5', undefined, 100);
    eventBus.emit('server.output', {
      serverId: 'srv-5',
      stream: 'stdout',
      chunk: '[12:00:02 INFO]: Done (3.45s)! For help, type "help"',
      timestamp: Date.now(),
    });

    const result = await promise;
    expect(result.ready).toBe(true);
    await moduleRef.close();
  });
});
