package jianagent.helper.info

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class JvmFlagsResult(
    val vmArguments: List<String>,
    val systemProperties: Map<String, String>,
    val inputArguments: List<String>,
)

data class ClassLoadingResult(
    val loadedClassCount: Int,
    val totalLoadedClassCount: Long,
    val unloadedClassCount: Long,
)

data class GcInfo(
    val name: String,
    val collectionCount: Long,
    val collectionTime: Long,
    val memoryPoolNames: List<String>,
)

data class GcInfoResult(
    val garbageCollectors: List<GcInfo>,
)

class JvmInfoManager {
    fun getJvmFlags(attachManager: AttachManager): JvmFlagsResult {
        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return JvmFlagsResult(emptyList(), emptyMap(), emptyList())

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val runtimeMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.RUNTIME_MXBEAN_NAME,
                java.lang.management.RuntimeMXBean::class.java
            )

            val vmArguments = try {
                runtimeMxBean.inputArguments
            } catch (e: Exception) {
                emptyList()
            }

            val systemProperties = try {
                runtimeMxBean.systemProperties
            } catch (e: Exception) {
                emptyMap()
            }

            connector.close()

            return JvmFlagsResult(
                vmArguments = vmArguments,
                systemProperties = systemProperties,
                inputArguments = vmArguments
            )
        } catch (e: Exception) {
            return JvmFlagsResult(emptyList(), emptyMap(), emptyList())
        }
    }

    fun getClassLoadingInfo(attachManager: AttachManager): ClassLoadingResult {
        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return ClassLoadingResult(0, 0, 0)

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val classLoadingMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.CLASS_LOADING_MXBEAN_NAME,
                java.lang.management.ClassLoadingMXBean::class.java
            )

            val result = ClassLoadingResult(
                loadedClassCount = classLoadingMxBean.loadedClassCount,
                totalLoadedClassCount = classLoadingMxBean.totalLoadedClassCount,
                unloadedClassCount = classLoadingMxBean.unloadedClassCount
            )

            connector.close()
            return result
        } catch (e: Exception) {
            return ClassLoadingResult(0, 0, 0)
        }
    }

    fun getGcInfo(attachManager: AttachManager): GcInfoResult {
        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return GcInfoResult(emptyList())

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val gcMxBeans = ManagementFactory.getGarbageCollectorMXBeans()
            val gcInfoList = mutableListOf<GcInfo>()

            for (gcMxBean in gcMxBeans) {
                try {
                    val proxy = ManagementFactory.newPlatformMXBeanProxy(
                        mbs,
                        gcMxBean.objectName.toString(),
                        java.lang.management.GarbageCollectorMXBean::class.java
                    )

                    gcInfoList.add(
                        GcInfo(
                            name = proxy.name,
                            collectionCount = proxy.collectionCount,
                            collectionTime = proxy.collectionTime,
                            memoryPoolNames = proxy.memoryPoolNames.toList()
                        )
                    )
                } catch (e: Exception) {
                    // Skip this GC if we can't get info
                    continue
                }
            }

            connector.close()
            return GcInfoResult(gcInfoList)
        } catch (e: Exception) {
            return GcInfoResult(emptyList())
        }
    }
}
