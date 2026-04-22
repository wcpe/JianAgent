import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateLocalValidationRunRequest } from '../local-validation.api.js';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../client.js';
import { localValidationApi } from '../local-validation.api.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockResolvedValue({} as never);
});

describe('localValidationApi', () => {
  it('creates runs through POST /local-validation/runs', async () => {
    const payload: CreateLocalValidationRunRequest = {
      name: 'Paper smoke',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 8,
      keepServerRunning: false,
      keepWorkspace: false,
      paperVersion: '1.21.1',
    };

    await localValidationApi.createRun(payload);

    expect(mockedFetch).toHaveBeenCalledWith('/local-validation/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('uses the local validation read endpoints for packs, runs, and artifacts', async () => {
    await localValidationApi.listScenarioPacks();
    await localValidationApi.listRuns();
    await localValidationApi.getRun('lvr_001');
    await localValidationApi.startRun('lvr_001');
    await localValidationApi.cancelRun('lvr_001');
    await localValidationApi.loadRunStages('lvr_001');
    await localValidationApi.loadRunAssertions('lvr_001');
    await localValidationApi.loadRunEvidence('lvr_001');

    expect(mockedFetch).toHaveBeenNthCalledWith(1, '/local-validation/scenario-packs');
    expect(mockedFetch).toHaveBeenNthCalledWith(2, '/local-validation/runs');
    expect(mockedFetch).toHaveBeenNthCalledWith(3, '/local-validation/runs/lvr_001');
    expect(mockedFetch).toHaveBeenNthCalledWith(4, '/local-validation/runs/lvr_001/start', {
      method: 'POST',
    });
    expect(mockedFetch).toHaveBeenNthCalledWith(5, '/local-validation/runs/lvr_001/cancel', {
      method: 'POST',
    });
    expect(mockedFetch).toHaveBeenNthCalledWith(6, '/local-validation/runs/lvr_001/stages');
    expect(mockedFetch).toHaveBeenNthCalledWith(7, '/local-validation/runs/lvr_001/assertions');
    expect(mockedFetch).toHaveBeenNthCalledWith(8, '/local-validation/runs/lvr_001/evidence');
  });
});
