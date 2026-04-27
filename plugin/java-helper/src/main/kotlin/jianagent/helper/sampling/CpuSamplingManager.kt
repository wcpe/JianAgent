package jianagent.helper.sampling

import com.sun.management.ThreadMXBean
import jianagent.helper.attach.AttachManager
import java.io.File
import java.io.PrintWriter
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.lang.management.ManagementFactory
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

/**
 * CPU 采样管理器
 * 通过定期采样线程 CPU 时间来分析热点方法
 */
class CpuSamplingManager {
    
    /**
     * 开始 CPU 采样
     * @param attachManager Attach 管理器
     * @param durationSeconds 采样持续时间（秒）
     * @param intervalMs 采样间隔（毫秒）
     * @return 采样结果
     */
    fun startSampling(attachManager: AttachManager, durationSeconds: Int, intervalMs: Long): CpuSamplingResult {
        return try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return CpuSamplingResult(false, null, "未找到 JMX 连接")
            
            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection
            
            val threadMXBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.THREAD_MXBEAN_NAME,
                ThreadMXBean::class.java
            )
            
            if (!threadMXBean.isThreadCpuTimeSupported) {
                connector.close()
                return CpuSamplingResult(false, null, "目标 JVM 不支持线程 CPU 时间测量")
            }
            
            if (!threadMXBean.isThreadCpuTimeEnabled) {
                threadMXBean.isThreadCpuTimeEnabled = true
            }
            
            val samples = mutableListOf<CpuSample>()
            val startTime = System.currentTimeMillis()
            val endTime = startTime + (durationSeconds * 1000)
            
            // 采样循环
            while (System.currentTimeMillis() < endTime) {
                val allThreadIds = threadMXBean.allThreadIds
                val snapshot = mutableMapOf<Long, ThreadCpuInfo>()
                
                for (threadId in allThreadIds) {
                    try {
                        val cpuTime = threadMXBean.getThreadCpuTime(threadId)
                        val userTime = threadMXBean.getThreadUserTime(threadId)
                        val threadInfo = threadMXBean.getThreadInfo(threadId)
                        
                        if (threadInfo != null && cpuTime >= 0) {
                            snapshot[threadId] = ThreadCpuInfo(
                                threadId = threadId,
                                threadName = threadInfo.threadName,
                                cpuTime = cpuTime,
                                userTime = userTime,
                                state = threadInfo.threadState.name
                            )
                        }
                    } catch (e: Exception) {
                        // 线程可能已终止，忽略
                    }
                }
                
                samples.add(CpuSample(System.currentTimeMillis(), snapshot))
                Thread.sleep(intervalMs)
            }
            
            connector.close()
            
            // 生成报告
            val reportPath = generateReport(attachManager.attachedPid ?: "unknown", samples, durationSeconds, intervalMs)
            CpuSamplingResult(true, reportPath, null)
        } catch (e: Exception) {
            CpuSamplingResult(false, null, e.message ?: "未知错误")
        }
    }
    
    /**
     * 生成 CPU 采样报告
     */
    private fun generateReport(
        pid: String,
        samples: List<CpuSample>,
        durationSeconds: Int,
        intervalMs: Long
    ): String {
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
        val outputDir = File("/tmp/jianagent-dumps")
        outputDir.mkdirs()
        
        val reportFile = File(outputDir, "cpu_sampling_${pid}_${timestamp}.txt")
        
        PrintWriter(reportFile).use { writer ->
            writer.println("CPU 采样报告")
            writer.println("=".repeat(80))
            writer.println("PID: $pid")
            writer.println("采样时长: ${durationSeconds}s")
            writer.println("采样间隔: ${intervalMs}ms")
            writer.println("采样次数: ${samples.size}")
            writer.println("生成时间: ${LocalDateTime.now()}")
            writer.println("=".repeat(80))
            writer.println()
            
            if (samples.size < 2) {
                writer.println("采样数据不足，无法生成报告")
                return@use
            }
            
            // 计算每个线程的 CPU 时间增量
            val firstSample = samples.first()
            val lastSample = samples.last()
            val cpuDeltas = mutableListOf<ThreadCpuDelta>()
            
            for ((threadId, endInfo) in lastSample.threads) {
                val startInfo = firstSample.threads[threadId]
                if (startInfo != null) {
                    val cpuDelta = endInfo.cpuTime - startInfo.cpuTime
                    val userDelta = endInfo.userTime - startInfo.userTime
                    
                    if (cpuDelta > 0) {
                        cpuDeltas.add(ThreadCpuDelta(
                            threadId = threadId,
                            threadName = endInfo.threadName,
                            cpuTimeNanos = cpuDelta,
                            userTimeNanos = userDelta,
                            state = endInfo.state
                        ))
                    }
                }
            }
            
            // 按 CPU 时间排序
            cpuDeltas.sortByDescending { it.cpuTimeNanos }
            
            writer.println("Top CPU 消耗线程:")
            writer.println("-".repeat(80))
            writer.printf("%-10s %-40s %-15s %-15s%n", "线程ID", "线程名称", "CPU时间(ms)", "用户时间(ms)")
            writer.println("-".repeat(80))
            
            for (delta in cpuDeltas.take(20)) {
                writer.printf(
                    "%-10d %-40s %-15.2f %-15.2f%n",
                    delta.threadId,
                    delta.threadName.take(40),
                    delta.cpuTimeNanos / 1_000_000.0,
                    delta.userTimeNanos / 1_000_000.0
                )
            }
            
            writer.println()
            writer.println("=".repeat(80))
            writer.println("报告生成完成")
        }
        
        return reportFile.absolutePath
    }
    
    data class CpuSamplingResult(
        val success: Boolean,
        val reportPath: String?,
        val message: String?
    )
    
    data class CpuSample(
        val timestamp: Long,
        val threads: Map<Long, ThreadCpuInfo>
    )
    
    data class ThreadCpuInfo(
        val threadId: Long,
        val threadName: String,
        val cpuTime: Long,
        val userTime: Long,
        val state: String
    )
    
    data class ThreadCpuDelta(
        val threadId: Long,
        val threadName: String,
        val cpuTimeNanos: Long,
        val userTimeNanos: Long,
        val state: String
    )
}
