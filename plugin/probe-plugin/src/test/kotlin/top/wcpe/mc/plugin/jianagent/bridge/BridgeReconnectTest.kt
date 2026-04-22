package top.wcpe.mc.plugin.jianagent.bridge

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BridgeReconnectTest {
    @Test
    fun `should allow reconnect when retries remain`() {
        val reconnect = BridgeReconnect(maxRetries = 3)
        assertTrue(reconnect.shouldReconnect())
    }

    @Test
    fun `should not allow reconnect when max retries reached`() {
        val reconnect = BridgeReconnect(maxRetries = 2)
        reconnect.recordFailure()
        reconnect.recordFailure()
        assertFalse(reconnect.shouldReconnect())
    }

    @Test
    fun `should calculate exponential backoff`() {
        val reconnect = BridgeReconnect(maxRetries = 5, baseDelayMs = 1000, backoffFactor = 2.0)
        assertEquals(1000, reconnect.nextDelayMs())
        reconnect.recordFailure()
        assertEquals(2000, reconnect.nextDelayMs())
        reconnect.recordFailure()
        assertEquals(4000, reconnect.nextDelayMs())
    }

    @Test
    fun `should cap delay at max`() {
        val reconnect = BridgeReconnect(maxRetries = 10, baseDelayMs = 1000, maxDelayMs = 5000)
        repeat(10) { reconnect.recordFailure() }
        assertTrue(reconnect.nextDelayMs() <= 5000)
    }

    @Test
    fun `should reset on success`() {
        val reconnect = BridgeReconnect(maxRetries = 5, baseDelayMs = 1000)
        reconnect.recordFailure()
        reconnect.recordFailure()
        reconnect.reset()
        assertTrue(reconnect.shouldReconnect())
        assertEquals(1000, reconnect.nextDelayMs())
    }
}
