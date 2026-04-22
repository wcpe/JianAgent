import { describe, it, expect, beforeEach } from 'vitest';
import { PtyPermissionService, PtyPermission } from '../pty-permission.service.js';

describe('PtyPermissionService', () => {
  let service: PtyPermissionService;

  beforeEach(() => {
    service = new PtyPermissionService();
  });

  describe('getPermission', () => {
    it('should return VIEW for VIEWER (role 0)', () => {
      expect(service.getPermission(0)).toBe(PtyPermission.VIEW);
    });

    it('should return SEND_COMMAND for OPERATOR (role 1)', () => {
      expect(service.getPermission(1)).toBe(PtyPermission.SEND_COMMAND);
    });

    it('should return SEND_DANGER for TERMINAL (role 3)', () => {
      expect(service.getPermission(3)).toBe(PtyPermission.SEND_DANGER);
    });

    it('should return FORCE_INTERRUPT for ADMIN (role 5)', () => {
      expect(service.getPermission(5)).toBe(PtyPermission.FORCE_INTERRUPT);
    });

    it('should return VIEW for unknown role levels', () => {
      expect(service.getPermission(99)).toBe(PtyPermission.VIEW);
      expect(service.getPermission(-1)).toBe(PtyPermission.VIEW);
    });
  });

  describe('canExecute', () => {
    it('should deny VIEWER from sending any command', () => {
      const result = service.canExecute(0, 'say hello');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('VIEWER');
    });

    it('should allow OPERATOR to send safe commands', () => {
      const result = service.canExecute(1, 'say hello');
      expect(result.allowed).toBe(true);
    });

    it('should deny OPERATOR from sending danger commands', () => {
      const result = service.canExecute(1, 'stop');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SEND_DANGER');
    });

    it('should allow TERMINAL to send danger commands', () => {
      expect(service.canExecute(3, 'stop').allowed).toBe(true);
      expect(service.canExecute(3, 'op player1').allowed).toBe(true);
      expect(service.canExecute(3, 'ban player1').allowed).toBe(true);
    });

    it('should handle case insensitive danger detection', () => {
      const result = service.canExecute(1, 'STOP');
      expect(result.allowed).toBe(false);
    });

    it('should trim whitespace before checking', () => {
      const result = service.canExecute(1, '  stop  ');
      expect(result.allowed).toBe(false);
    });
  });

  describe('canForceInterrupt', () => {
    it('should deny VIEWER force interrupt', () => {
      expect(service.canForceInterrupt(0)).toBe(false);
    });

    it('should deny OPERATOR force interrupt', () => {
      expect(service.canForceInterrupt(1)).toBe(false);
    });

    it('should deny TERMINAL force interrupt', () => {
      expect(service.canForceInterrupt(3)).toBe(false);
    });

    it('should allow DANGER force interrupt', () => {
      expect(service.canForceInterrupt(4)).toBe(true);
    });

    it('should allow ADMIN force interrupt', () => {
      expect(service.canForceInterrupt(5)).toBe(true);
    });
  });
});
