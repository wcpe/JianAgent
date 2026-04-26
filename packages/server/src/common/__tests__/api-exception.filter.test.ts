import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('maps HttpException objects to structured error envelopes', () => {
    const filter = new ApiExceptionFilter();
    const response = {
      header: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const request = {
      headers: {
        'x-request-id': 'req-1',
      },
    };
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    filter.catch(
      new BadRequestException({
        code: 'INVALID_INPUT',
        message: ['name is required'],
        details: { field: 'name' },
      }),
      host as any,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'INVALID_INPUT',
        message: 'name is required',
        details: { field: 'name' },
        requestId: 'req-1',
        traceId: 'req-1',
        error: {
          code: 'INVALID_INPUT',
          message: 'name is required',
          details: { field: 'name' },
        },
      }),
    );
  });

  it('maps generic errors to internal server error envelopes', () => {
    const filter = new ApiExceptionFilter();
    const response = {
      header: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const request = { headers: {} };
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    filter.catch(new Error('boom'), host as any);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'boom',
      }),
    );
  });
});
