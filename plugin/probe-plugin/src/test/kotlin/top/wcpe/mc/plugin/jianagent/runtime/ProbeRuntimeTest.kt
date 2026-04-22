package top.wcpe.mc.plugin.jianagent.runtime

import com.google.gson.JsonElement
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import top.wcpe.mc.plugin.jianagent.api.ProbeStatus
import top.wcpe.mc.plugin.jianagent.bridge.BridgeStatus
import top.wcpe.mc.plugin.jianagent.bridge.ProbeBridgeClient
import java.util.logging.Logger
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProbeRuntimeTest {

    @Test
    @DisplayName("启动时应连接桥接并安排快照任务")
    fun startConnectsBridgeAndSchedulesSnapshot() {
        val bridge = FakeBridge()
        val scheduler = FakeSnapshotScheduler()
        var handler: ((String, JsonElement) -> Unit)? = null

        val runtime = ProbeRuntime(
            logger = Logger.getLogger("ProbeRuntimeTest"),
            createBridge = { _, _, incoming ->
                handler = incoming
                bridge
            },
            createRouter = { FakeRouter() },
            snapshotScheduler = scheduler,
            snapshotCollector = { sampleSnapshot() },
        )

        runtime.start(sampleConfig())

        assertTrue(bridge.connected)
        assertEquals(40L, scheduler.intervalTicks)

        bridge.status.transition(ProbeStatus.READY)
        scheduler.runScheduled()

        assertEquals(1, bridge.sentMessages.size)
        assertEquals("plugin:snapshot", bridge.sentMessages.single().first)
        assertTrue(handler != null)
    }

    @Test
    @DisplayName("停止时应取消快照任务并断开桥接")
    fun stopDisconnectsBridgeAndCancelsSnapshot() {
        val bridge = FakeBridge()
        val scheduler = FakeSnapshotScheduler()

        val runtime = ProbeRuntime(
            logger = Logger.getLogger("ProbeRuntimeTest"),
            createBridge = { _, _, _ -> bridge },
            createRouter = { FakeRouter() },
            snapshotScheduler = scheduler,
            snapshotCollector = { sampleSnapshot() },
        )

        runtime.start(sampleConfig())
        runtime.stop()

        assertTrue(bridge.disconnected)
        assertTrue(scheduler.cancelled)
    }

    @Test
    @DisplayName("桥接收到消息后应交给路由器")
    fun incomingMessageIsForwardedToRouter() {
        val bridge = FakeBridge()
        val scheduler = FakeSnapshotScheduler()
        val router = FakeRouter()
        var handler: ((String, JsonElement) -> Unit)? = null

        val runtime = ProbeRuntime(
            logger = Logger.getLogger("ProbeRuntimeTest"),
            createBridge = { _, _, incoming ->
                handler = incoming
                bridge
            },
            createRouter = { router },
            snapshotScheduler = scheduler,
            snapshotCollector = { sampleSnapshot() },
        )

        runtime.start(sampleConfig())
        val payload = com.google.gson.JsonParser.parseString("""{"requestId":"r1"}""")
        handler!!.invoke("server:command", payload)

        assertEquals("server:command", router.lastChannel)
        assertEquals(payload, router.lastPayload)
    }

    private fun sampleConfig() = ProbeBootstrapConfig(
        serverUri = "ws://localhost:3001",
        pluginVersion = "1.0.0",
        serverVersion = "git-Paper-1.20.1",
        serverId = "default",
        snapshotIntervalTicks = 40L,
    )

    private fun sampleSnapshot() = ProbeSnapshot(
        tps = 20.0,
        mspt = 8.0,
        onlinePlayers = 5,
        maxPlayers = 20,
        loadedChunks = 128,
        entityCount = 256,
        worldCount = 1,
        freeMemoryMb = 512,
        totalMemoryMb = 1024,
        maxMemoryMb = 2048,
        cpuUsage = 25.0,
        uptime = "00:20:00",
        timestamp = "2026-04-06T00:00:00Z",
        playerNames = listOf("Steve", "Alex"),
        pluginCount = 10,
        worlds = emptyList(),
        players = emptyList(),
        plugins = emptyList(),
    )

    private class FakeBridge : ProbeBridgeClient {
        override val status = BridgeStatus()
        var connected = false
        var disconnected = false
        val sentMessages = mutableListOf<Pair<String, Any>>()

        override fun connect() {
            connected = true
        }

        override fun send(channel: String, payload: Any) {
            sentMessages += channel to payload
        }

        override fun disconnect() {
            disconnected = true
        }
    }

    private class FakeRouter : ProbeMessageRouter {
        var lastChannel: String? = null
        var lastPayload: JsonElement? = null

        override fun route(channel: String, payload: JsonElement) {
            lastChannel = channel
            lastPayload = payload
        }
    }

    private class FakeSnapshotScheduler : SnapshotScheduler {
        var intervalTicks = -1L
        var action: (() -> Unit)? = null
        var cancelled = false

        override fun schedule(intervalTicks: Long, action: () -> Unit): SnapshotTask {
            this.intervalTicks = intervalTicks
            this.action = action
            return SnapshotTask {
                cancelled = true
            }
        }

        fun runScheduled() {
            action?.invoke()
        }
    }
}