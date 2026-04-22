import { describe, expect, it } from 'vitest';
import { ValidationReportService } from '../validation-report.service.js';

describe('ValidationReportService', () => {
  it('builds a report with startup and assertion sections', () => {
    const service = new ValidationReportService();
    const report = service.buildReport({
      run: { id: 'lvr_1', status: 'PASSED', scenarioPackId: 'combat-pack-v1' },
      startup: { readyChecks: ['log-pattern', 'mc-ping'] },
      assertions: [{ key: 'respawn-ratio', status: 'passed' }],
    });

    expect(report.sections.map((section) => section.title)).toEqual([
      '环境摘要',
      '启动与 Ready',
      '断言结果',
    ]);
  });
});
