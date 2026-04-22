import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/jwt.guard.js';
import { TenantScopeGuard } from '../../common/tenant-scope.guard.js';
import { ApprovalService } from '../approval/approval.service.js';
import { OperationJobService } from './operation-job.service.js';

@Controller('api/control-plane/jobs')
@UseGuards(JwtGuard, TenantScopeGuard)
export class OperationJobController {
  constructor(
    private readonly operationJobService: OperationJobService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      tenantId: string;
      operation: string;
      target: string;
      version: string;
      batch: string;
      danger?: boolean;
    },
  ) {
    const job = this.operationJobService.create({
      tenantId: body.tenantId,
      operation: body.operation,
      target: body.target,
      version: body.version,
      batch: body.batch,
      danger: Boolean(body.danger),
    });

    if (this.approvalService.requiresApproval(job.danger)) {
      const ticket = this.approvalService.createTicket(job.id, job.tenantId);
      this.operationJobService.setStatus(job.id, 'WAITING_APPROVAL');
      return { jobId: job.id, status: 'WAITING_APPROVAL', approvalTicketId: ticket.id };
    }

    return { jobId: job.id, status: 'PENDING' };
  }

  @Get('approvals')
  listPending(@Query('tenantId') tenantId: string) {
    return this.approvalService.listPending(tenantId);
  }

  @Post('approvals/:ticketId/approve')
  approve(
    @Param('ticketId') ticketId: string,
    @Body() body: { confirmationCode: string },
  ) {
    const ticket = this.approvalService.approve(ticketId, body.confirmationCode);
    return { ticket };
  }

  @Post('approvals/sweep-expired')
  sweepExpired() {
    const changes = this.approvalService.sweepExpired();
    return { success: true, data: { expiredCount: changes } };
  }
}
