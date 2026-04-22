import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SessionReportService } from './session-report.service.js';
import type { SessionReportDto } from '@jian-agent/shared-domain';

@Injectable()
export class ReportExporterService {
  private readonly logger = new Logger(ReportExporterService.name);

  constructor(private readonly sessionReportService: SessionReportService) {}

  async exportJson(sessionId: string): Promise<string> {
    const report = await this.sessionReportService.generateReport(sessionId);
    return JSON.stringify(report, null, 2);
  }

  async exportHtml(sessionId: string): Promise<string> {
    const report = await this.sessionReportService.generateReport(sessionId);
    return this.renderHtml(report);
  }

  private renderHtml(report: SessionReportDto): string {
    const phaseRows = report.phases
      .map(
        (p) =>
          `<tr>
        <td>${this.escapeHtml(p.phaseName)}</td>
        <td class="status-${p.status}">${p.status}</td>
        <td>${p.botCount}</td>
        <td>${p.avgTps.toFixed(1)}</td>
        <td>${p.avgMspt.toFixed(1)}ms</td>
      </tr>`,
      )
      .join('\n');

    const conclusionItems = report.conclusions
      .map((c) => `<div class="conclusion">${this.escapeHtml(c)}</div>`)
      .join('\n');

    const alertRows = report.alerts.topAlerts
      .map((a) => `<tr><td>${this.escapeHtml(a.rule)}</td><td>${a.count}</td></tr>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>压测会话报告 - ${this.escapeHtml(report.sessionId)}</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; color: #333; max-width: 900px; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { color: #555; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  .status-completed { color: green; font-weight: bold; }
  .status-failed { color: red; font-weight: bold; }
  .status-skipped { color: #999; }
  .conclusion { background: #f0f9ff; padding: 12px; border-radius: 4px; margin: 8px 0; border-left: 4px solid #3b82f6; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .stat-card { background: #fafafa; padding: 16px; border-radius: 6px; border: 1px solid #eee; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
  .stat-label { font-size: 12px; color: #888; margin-top: 4px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>压测会话报告</h1>
<p>会话 ID: ${this.escapeHtml(report.sessionId)}<br>
服务器: ${this.escapeHtml(report.serverId)}<br>
时间范围: ${new Date(report.startTime).toLocaleString('zh-CN')} — ${new Date(report.endTime).toLocaleString('zh-CN')}<br>
持续时长: ${(report.durationMs / 1000 / 60).toFixed(1)} 分钟</p>

<h2>Bot 概览</h2>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-value">${report.botStats.totalSpawned}</div><div class="stat-label">总生成</div></div>
  <div class="stat-card"><div class="stat-value">${report.botStats.peakOnline}</div><div class="stat-label">峰值在线</div></div>
  <div class="stat-card"><div class="stat-value">${report.botStats.joinFailures}</div><div class="stat-label">加入失败</div></div>
  <div class="stat-card"><div class="stat-value">${report.botStats.disconnections}</div><div class="stat-label">断连次数</div></div>
</div>

<h2>服务器性能</h2>
<table>
  <tr><th>指标</th><th>平均值</th><th>最低/峰值</th></tr>
  <tr><td>TPS</td><td>${report.serverPerf.avgTps}</td><td>${report.serverPerf.minTps} (最低)</td></tr>
  <tr><td>MSPT</td><td>${report.serverPerf.avgMspt}ms</td><td>${report.serverPerf.maxMspt}ms (峰值)</td></tr>
  <tr><td>CPU</td><td>${report.serverPerf.avgCpuPercent}%</td><td>${report.serverPerf.peakCpuPercent}% (峰值)</td></tr>
  <tr><td>内存</td><td>${report.serverPerf.avgMemoryMb}MB</td><td>${report.serverPerf.peakMemoryMb}MB (峰值)</td></tr>
</table>

<h2>阶段详情</h2>
<table>
  <tr><th>阶段</th><th>状态</th><th>Bot 数</th><th>平均 TPS</th><th>平均 MSPT</th></tr>
  ${phaseRows}
</table>

<h2>告警摘要 (共 ${report.alerts.total} 条)</h2>
<table>
  <tr><th>规则</th><th>次数</th></tr>
  ${alertRows}
</table>

<h2>自动总结</h2>
${conclusionItems}

<p style="color:#aaa;margin-top:40px;font-size:12px;">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
