package top.wcpe.mc.plugin.jianagent.bridge

import com.google.gson.JsonNull
import com.google.gson.JsonParser
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import top.wcpe.mc.plugin.jianagent.api.ProbeStatus
import top.wcpe.mc.plugin.jianagent.command.CommandProxy
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class MessageRouterTest {

    @Test
    @DisplayName("server:command 应被执行并回传 command-result")
    fun routeCommandPayload() {
        val bridge = FakeBridge()
        val router = MessageRouter(bridge = bridge, commandProxy = CommandProxy())

        router.route(
            channel = "server:command",
            payload = JsonParser.parseString(
                """{"action":"FORCE_START","requestId":"r1","params":{}}""",
            ),
        )

        assertEquals(1, bridge.sentMessages.size)
        assertEquals("plugin:command-result", bridge.sentMessages.single().first)
        val result = assertIs<ProbeCommandResult>(bridge.sentMessages.single().second)
        assertTrue(result.success)
        assertEquals("r1", result.requestId)
    }

    @Test
    @DisplayName("server:snapshot-request 应立即回传 snapshot")
    fun routeSnapshotRequest() {
        val bridge = FakeBridge()
        val snapshot = ProbeSnapshot(
            tps = 20.0,
            mspt = 10.0,
            onlinePlayers = 3,
            maxPlayers = 20,
            loadedChunks = 64,
            entityCount = 128,
            worldCount = 1,
            freeMemoryMb = 256,
            totalMemoryMb = 512,
            maxMemoryMb = 1024,
            cpuUsage = 30.0,
            uptime = "00:10:00",
            timestamp = "2026-04-06T00:00:00Z",
            playerNames = listOf("TestPlayer"),
            pluginCount = 5,
            worlds = emptyList(),
            players = emptyList(),
            plugins = emptyList(),
        )
        val router = MessageRouter(
            bridge = bridge,
            commandProxy = CommandProxy(),
            snapshotProvider = { snapshot },
        )

        router.route(channel = "server:snapshot-request", payload = JsonNull.INSTANCE)

        assertEquals(1, bridge.sentMessages.size)
        assertEquals("plugin:snapshot", bridge.sentMessages.single().first)
        assertEquals(snapshot, bridge.sentMessages.single().second)
    }

    @Test
    @DisplayName("路由应通过主线程调度器执行 Bukkit 相关逻辑")
    fun routeViaMainThreadDispatcher() {
        val bridge = FakeBridge()
        val snapshot = ProbeSnapshot(
            tps = 20.0,
            mspt = 10.0,
            onlinePlayers = 3,
            maxPlayers = 20,
            loadedChunks = 64,
            entityCount = 128,
            worldCount = 1,
            freeMemoryMb = 256,
            totalMemoryMb = 512,
            maxMemoryMb = 1024,
            cpuUsage = 30.0,
            uptime = "00:10:00",
            timestamp = "2026-04-06T00:00:00Z",
            playerNames = listOf("TestPlayer"),
            pluginCount = 5,
            worlds = emptyList(),
            players = emptyList(),
            plugins = emptyList(),
        )
        var scheduledAction: (() -> Unit)? = null
        val router = MessageRouter(
            bridge = bridge,
            commandProxy = CommandProxy(),
            snapshotProvider = { snapshot },
            mainThreadDispatcher = { action ->
                scheduledAction = action
            },
        )

        router.route(channel = "server:snapshot-request", payload = JsonNull.INSTANCE)

        assertEquals(0, bridge.sentMessages.size)
        assertTrue(scheduledAction != null)

        scheduledAction!!.invoke()

        assertEquals(1, bridge.sentMessages.size)
        assertEquals("plugin:snapshot", bridge.sentMessages.single().first)
        assertEquals(snapshot, bridge.sentMessages.single().second)
    }

    @Test
    @DisplayName("空 payload 不应触发远端调用")
    fun ignoreEmptyPayload() {
        val bridge = FakeBridge()
        val router = MessageRouter(bridge = bridge, commandProxy = CommandProxy())

        router.route(channel = "server:command", payload = JsonNull.INSTANCE)

        assertFalse(bridge.sentMessages.isNotEmpty())
    }

    private class FakeBridge : ProbeBridgeClient {
        override val status = BridgeStatus().apply {
            transition(ProbeStatus.READY)
        }

        val sentMessages = mutableListOf<Pair<String, Any>>()

        override fun connect() {
        }

        override fun send(channel: String, payload: Any) {
            sentMessages += channel to payload
        }

        override fun disconnect() {
        }
    }
}
