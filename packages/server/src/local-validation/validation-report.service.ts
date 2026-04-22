import { Injectable } from '@nestjs/common';

export interface ValidationReportSectionItem {
  readonly key: string;
  readonly value: string;
}

export interface ValidationReportSection {
  readonly title: string;
  readonly items: readonly ValidationReportSectionItem[];
}

export interface ValidationReport {
  readonly runId: string;
  readonly status: string;
  readonly generatedAt: string;
  readonly sections: readonly ValidationReportSection[];
}

export interface BuildValidationReportInput {
  readonly run: {
    readonly id: string;
    readonly status: string;
    readonly scenarioPackId: string;
    readonly serverId?: string;
    readonly paperVersion?: string;
  };
  readonly startup: {
    readonly readyChecks: readonly string[];
  };
  readonly assertions: readonly {
    readonly key: string;
    readonly status: string;
  }[];
}

@Injectable()
export class ValidationReportService {
  buildReport(input: BuildValidationReportInput): ValidationReport {
    return {
      runId: input.run.id,
      status: input.run.status,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: '环境摘要',
          items: [
            { key: 'runId', value: input.run.id },
            { key: 'scenarioPackId', value: input.run.scenarioPackId },
            { key: 'serverId', value: input.run.serverId ?? '未分配' },
            { key: 'paperVersion', value: input.run.paperVersion ?? '未指定' },
          ],
        },
        {
          title: '启动与 Ready',
          items: input.startup.readyChecks.length > 0
            ? input.startup.readyChecks.map((readyCheck) => ({ key: readyCheck, value: 'passed' }))
            : [{ key: 'readyChecks', value: '未记录' }],
        },
        {
          title: '断言结果',
          items: input.assertions.length > 0
            ? input.assertions.map((assertion) => ({ key: assertion.key, value: assertion.status }))
            : [{ key: 'assertions', value: '未记录' }],
        },
      ],
    };
  }
}
