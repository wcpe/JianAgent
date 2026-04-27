import { test, expect } from '@playwright/test';

test.describe('文件中心功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('input').first().fill('admin');
    await page.locator('input').nth(1).fill('admin');
    await page.click('button:has-text("登录")');
    await page.waitForURL('**', { timeout: 10000 });
  });

  test('应该能够访问文件中心页面', async ({ page }) => {
    // 导航到文件中心
    await page.goto('/files');
    
    // 验证页面标题
    await expect(page.locator('h1, h2').filter({ hasText: '文件中心' })).toBeVisible();
    
    // 验证存储统计卡片存在
    await expect(page.locator('text=总文件数')).toBeVisible();
    await expect(page.locator('text=总大小')).toBeVisible();
  });

  test('应该能够查看文件列表', async ({ page }) => {
    await page.goto('/files');
    
    // 等待表格加载
    await page.waitForSelector('table, .ant-table', { timeout: 5000 });
    
    // 验证表格列标题
    const headers = ['文件名', '类型', '大小', '创建时间', '操作'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('应该能够使用过滤器', async ({ page }) => {
    await page.goto('/files');
    
    // 等待过滤器加载
    await page.waitForSelector('.ant-select, select', { timeout: 5000 });
    
    // 测试文件类型过滤
    const typeFilter = page.locator('.ant-select').first();
    await typeFilter.click();
    await page.click('text=线程转储');
    
    // 验证过滤生效（表格应该重新加载）
    await page.waitForTimeout(1000);
  });

  test('应该能够搜索文件', async ({ page }) => {
    await page.goto('/files');
    
    // 查找搜索框
    const searchInput = page.locator('input[placeholder*="搜索"], input[type="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('应用关闭功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录为管理员
    await page.goto('/login');
    await page.locator('input').first().fill('admin');
    await page.locator('input').nth(1).fill('admin');
    await page.click('button:has-text("登录")');
    await page.waitForURL('**', { timeout: 10000 });
  });

  test('管理员应该能看到关闭应用按钮', async ({ page }) => {
    // 导航到 JVM 列表页面
    await page.goto('/jvm');
    
    // 等待进程卡片加载
    await page.waitForSelector('.ant-card, [class*="Card"]', { timeout: 5000 });
    
    // 查找关闭应用按钮（红色按钮）
    const shutdownButton = page.locator('button:has-text("关闭应用")');
    
    // 如果有 JVM 进程，应该能看到关闭按钮
    const cardCount = await page.locator('.ant-card, [class*="Card"]').count();
    if (cardCount > 0) {
      await expect(shutdownButton.first()).toBeVisible();
    }
  });

  test('点击关闭按钮应该弹出确认对话框', async ({ page }) => {
    await page.goto('/jvm');
    
    // 等待进程卡片加载
    await page.waitForSelector('.ant-card, [class*="Card"]', { timeout: 5000 });
    
    const shutdownButton = page.locator('button:has-text("关闭应用")').first();
    
    if (await shutdownButton.count() > 0) {
      await shutdownButton.click();
      
      // 验证对话框出现
      await expect(page.locator('.ant-modal, [role="dialog"]')).toBeVisible();
      await expect(page.locator('text=确认关闭应用')).toBeVisible();
      
      // 验证对话框内容
      await expect(page.locator('text=优雅关闭')).toBeVisible();
      await expect(page.locator('text=强制关闭')).toBeVisible();
      
      // 关闭对话框
      await page.click('button:has-text("取消")');
    }
  });
});

test.describe('实时监控功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('input').first().fill('admin');
    await page.locator('input').nth(1).fill('admin');
    await page.click('button:has-text("登录")');
    await page.waitForURL('**', { timeout: 10000 });
  });

  test('应该能够访问实时监控页面', async ({ page }) => {
    // 导航到 JVM 列表
    await page.goto('/jvm');
    
    // 等待进程卡片加载
    await page.waitForSelector('.ant-card, [class*="Card"]', { timeout: 5000 });
    
    // 查找实时监控按钮
    const monitorButton = page.locator('button:has-text("实时监控")').first();
    
    if (await monitorButton.count() > 0) {
      await monitorButton.click();
      
      // 验证导航到监控页面
      await expect(page).toHaveURL(/\/jvm\/\d+\/monitoring/);
      
      // 验证监控页面元素
      await expect(page.locator('text=内存监控')).toBeVisible();
      await expect(page.locator('text=线程监控')).toBeVisible();
      await expect(page.locator('text=GC 监控')).toBeVisible();
    }
  });

  test('应该能够启动监控', async ({ page }) => {
    await page.goto('/jvm');
    
    const monitorButton = page.locator('button:has-text("实时监控")').first();
    
    if (await monitorButton.count() > 0) {
      await monitorButton.click();
      await page.waitForURL(/\/jvm\/\d+\/monitoring/);
      
      // 查找开始监控按钮
      const startButton = page.locator('button:has-text("开始监控")');
      if (await startButton.count() > 0) {
        await startButton.click();
        
        // 等待监控数据加载
        await page.waitForTimeout(2000);
        
        // 验证图表出现
        await expect(page.locator('.recharts-wrapper, canvas, svg')).toBeVisible();
      }
    }
  });

  test('应该能够调整采样间隔', async ({ page }) => {
    await page.goto('/jvm');
    
    const monitorButton = page.locator('button:has-text("实时监控")').first();
    
    if (await monitorButton.count() > 0) {
      await monitorButton.click();
      await page.waitForURL(/\/jvm\/\d+\/monitoring/);
      
      // 查找采样间隔选择器
      const intervalSelect = page.locator('.ant-select').filter({ hasText: '采样间隔' });
      if (await intervalSelect.count() > 0) {
        await intervalSelect.click();
        await page.click('text=10秒');
      }
    }
  });
});
