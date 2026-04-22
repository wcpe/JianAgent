import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/jwt.guard.js';
import { TenantScopeGuard } from '../../common/tenant-scope.guard.js';
import { CatalogService } from './catalog.service.js';

@Controller('api/control-plane/catalog')
@UseGuards(JwtGuard, TenantScopeGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('tenants')
  createTenant(@Body() body: { name: string }) {
    return this.catalogService.createTenant(body);
  }

  @Get('tenants')
  listTenants() {
    return this.catalogService.listTenants();
  }

  @Post('environments')
  createEnvironment(@Body() body: { tenantId: string; name: string }) {
    return this.catalogService.createEnvironment(body);
  }

  @Get('environments')
  listEnvironments(@Query('tenantId') tenantId: string) {
    return this.catalogService.listEnvironments(tenantId);
  }

  @Post('clusters')
  createCluster(
    @Body() body: { tenantId: string; environmentId: string; name: string },
  ) {
    return this.catalogService.createCluster(body);
  }

  @Get('clusters')
  listClusters(@Query('tenantId') tenantId: string) {
    return this.catalogService.listClusters(tenantId);
  }

  @Post('hosts')
  createHost(
    @Body()
    body: {
      tenantId: string;
      environmentId: string;
      clusterId: string;
      hostname: string;
      ip: string;
    },
  ) {
    return this.catalogService.createHost(body);
  }

  @Get('hosts')
  listHosts(@Query('tenantId') tenantId: string) {
    return this.catalogService.listHosts(tenantId);
  }

  @Post('applications')
  createApplication(
    @Body()
    body: {
      tenantId: string;
      environmentId: string;
      name: string;
      runtimeType: 'jar' | 'container';
    },
  ) {
    return this.catalogService.createApplication(body);
  }

  @Get('applications')
  async listApplications(@Query('tenantId') tenantId: string) {
    return this.catalogService.listApplications(tenantId);
  }

  @Post('instances')
  createInstance(
    @Body()
    body: {
      tenantId: string;
      environmentId: string;
      applicationId: string;
      hostId: string;
      runtimeType: 'jar' | 'container';
    },
  ) {
    return this.catalogService.createInstance(body);
  }

  @Get('instances')
  listInstances(@Query('tenantId') tenantId: string) {
    return this.catalogService.listInstances(tenantId);
  }
}
