package top.wcpe.mc.plugin.jianagent.snapshot

import org.junit.jupiter.api.Test
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import kotlin.test.assertTrue
import kotlin.test.assertNotNull

class ServerSnapshotTest {
    @Test
    fun `ProbeSnapshot should be constructable`() {
        val snapshot = ProbeSnapshot(
            tps = 20.0,
            mspt = 12.5,
            onlinePlayers = 10,
            maxPlayers = 100,
            loadedChunks = 256,
            entityCount = 500,
            worldCount = 3,
            freeMemoryMb = 2048,
            totalMemoryMb = 4096,
            maxMemoryMb = 8192,
            cpuUsage = 35.0,
            uptime = "01:30:00",
            timestamp = "2026-01-01T00:00:00Z",
            playerNames = listOf("Player1", "Player2"),
            pluginCount = 15,
            worlds = emptyList(),
            players = emptyList(),
            plugins = emptyList(),
        )
        assertTrue(snapshot.tps > 0)
        assertNotNull(snapshot.timestamp)
    }
}
