package jianagent.helper.jfr

import jianagent.helper.attach.AttachManager
import java.io.File
import java.lang.management.ManagementFactory
import javax.management.ObjectName
import javax.management.openmbean.CompositeDataSupport
import javax.management.openmbean.CompositeType
import javax.management.openmbean.OpenType
import javax.management.openmbean.SimpleType
import javax.management.openmbean.TabularDataSupport
import javax.management.openmbean.TabularType
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class JfrStartOptions(
    val name: String = "jianagent-recording",
    val durationSeconds: Int = 60,
    val maxSize: Long = 0, // 0 means unlimited
    val maxAge: Long = 0, // 0 means unlimited
)

data class JfrStartResult(
    val success: Boolean,
    val recordingId: Long,
    val error: String? = null,
)

data class JfrStopResult(
    val success: Boolean,
    val outputPath: String,
    val fileSizeBytes: Long,
    val durationMs: Long,
    val error: String? = null,
)

data class JfrStatusResult(
    val recordingId: Long,
    val name: String,
    val state: String,
    val duration: Long,
    val startTime: Long,
)

class JfrManager {
    private var currentRecordingId: Long = -1

    /**
     * Convert a Map to TabularData for JMX operations
     */
    private fun mapToTabularData(map: Map<String, String>): TabularDataSupport {
        // Define the composite type for a single row (key-value pair)
        val compositeType = CompositeType(
            "java.util.Map<java.lang.String,java.lang.String>",
            "Map entry",
            arrayOf("key", "value"),
            arrayOf("Key", "Value"),
            arrayOf<OpenType<*>>(SimpleType.STRING, SimpleType.STRING)
        )

        // Define the tabular type
        val tabularType = TabularType(
            "java.util.Map<java.lang.String,java.lang.String>",
            "Map",
            compositeType,
            arrayOf("key")
        )

        // Create the tabular data
        val tabularData = TabularDataSupport(tabularType)

        // Add each map entry as a composite data row
        for ((key, value) in map) {
            val compositeData = CompositeDataSupport(
                compositeType,
                arrayOf("key", "value"),
                arrayOf<Any>(key, value)
            )
            tabularData.put(compositeData)
        }

        return tabularData
    }

    fun startRecording(attachManager: AttachManager, options: JfrStartOptions): JfrStartResult {
        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return JfrStartResult(
                    success = false,
                    recordingId = -1,
                    error = "Not attached to any process"
                )

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            // Get FlightRecorderMXBean
            val frBean = ObjectName("jdk.management.jfr:type=FlightRecorder")

            // Check if JFR is available
            if (!mbs.isRegistered(frBean)) {
                connector.close()
                return JfrStartResult(
                    success = false,
                    recordingId = -1,
                    error = "JFR not available in target JVM"
                )
            }

            // Create new recording
            val recordingId = mbs.invoke(
                frBean,
                "newRecording",
                emptyArray(),
                emptyArray()
            ) as Long

            // Set recording options
            val settings = mutableMapOf<String, String>()
            settings["name"] = options.name
            if (options.durationSeconds > 0) {
                settings["duration"] = "${options.durationSeconds}s"
            }
            if (options.maxSize > 0) {
                settings["maxSize"] = options.maxSize.toString()
            }
            if (options.maxAge > 0) {
                settings["maxAge"] = "${options.maxAge}s"
            }

            // Convert settings map to TabularData and apply
            val tabularData = mapToTabularData(settings)
            mbs.invoke(
                frBean,
                "setRecordingOptions",
                arrayOf(recordingId, tabularData),
                arrayOf("long", "javax.management.openmbean.TabularData")
            )

            // Start recording
            mbs.invoke(
                frBean,
                "startRecording",
                arrayOf(recordingId),
                arrayOf("long")
            )

            connector.close()
            currentRecordingId = recordingId

            return JfrStartResult(
                success = true,
                recordingId = recordingId,
                error = null
            )
        } catch (e: Exception) {
            return JfrStartResult(
                success = false,
                recordingId = -1,
                error = e.message ?: "Unknown error"
            )
        }
    }

    fun stopRecording(attachManager: AttachManager, recordingId: Long, outputPath: String): JfrStopResult {
        val startTime = System.currentTimeMillis()

        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return JfrStopResult(
                    success = false,
                    outputPath = outputPath,
                    fileSizeBytes = 0,
                    durationMs = 0,
                    error = "Not attached to any process"
                )

            // Validate output path
            val outputFile = File(outputPath)
            val parentDir = outputFile.parentFile
            if (parentDir != null && !parentDir.exists()) {
                return JfrStopResult(
                    success = false,
                    outputPath = outputPath,
                    fileSizeBytes = 0,
                    durationMs = System.currentTimeMillis() - startTime,
                    error = "Parent directory does not exist: ${parentDir.absolutePath}"
                )
            }

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val frBean = ObjectName("jdk.management.jfr:type=FlightRecorder")

            // Stop recording
            mbs.invoke(
                frBean,
                "stopRecording",
                arrayOf(recordingId),
                arrayOf("long")
            )

            // Copy recording to file
            mbs.invoke(
                frBean,
                "copyTo",
                arrayOf(recordingId, outputPath),
                arrayOf("long", "java.lang.String")
            )

            // Close recording
            mbs.invoke(
                frBean,
                "closeRecording",
                arrayOf(recordingId),
                arrayOf("long")
            )

            connector.close()

            val fileSize = if (outputFile.exists()) outputFile.length() else 0L
            val duration = System.currentTimeMillis() - startTime

            if (currentRecordingId == recordingId) {
                currentRecordingId = -1
            }

            return JfrStopResult(
                success = true,
                outputPath = outputPath,
                fileSizeBytes = fileSize,
                durationMs = duration,
                error = null
            )
        } catch (e: Exception) {
            return JfrStopResult(
                success = false,
                outputPath = outputPath,
                fileSizeBytes = 0,
                durationMs = System.currentTimeMillis() - startTime,
                error = e.message ?: "Unknown error"
            )
        }
    }

    fun getRecordingStatus(attachManager: AttachManager, recordingId: Long): JfrStatusResult? {
        try {
            val jmxUrl = attachManager.getLocalConnectorAddress() ?: return null

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val frBean = ObjectName("jdk.management.jfr:type=FlightRecorder")

            // Get recording info
            val recordings = mbs.invoke(
                frBean,
                "getRecordings",
                emptyArray(),
                emptyArray()
            ) as List<*>

            connector.close()

            // Find matching recording
            for (recording in recordings) {
                val recMap = recording as? Map<*, *> ?: continue
                val id = recMap["id"] as? Long ?: continue
                if (id == recordingId) {
                    return JfrStatusResult(
                        recordingId = id,
                        name = recMap["name"] as? String ?: "",
                        state = recMap["state"] as? String ?: "",
                        duration = recMap["duration"] as? Long ?: 0,
                        startTime = recMap["startTime"] as? Long ?: 0
                    )
                }
            }

            return null
        } catch (e: Exception) {
            return null
        }
    }

    fun getCurrentRecordingId(): Long = currentRecordingId
}
