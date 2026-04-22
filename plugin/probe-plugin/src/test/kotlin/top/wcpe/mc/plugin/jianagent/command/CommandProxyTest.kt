package top.wcpe.mc.plugin.jianagent.command

import org.junit.jupiter.api.Test
import top.wcpe.mc.plugin.jianagent.api.ProbeCommand
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertEquals

class CommandProxyTest {
    private val proxy = CommandProxy()

    @Test
    fun `should reject non-whitelisted action`() {
        val cmd = ProbeCommand(action = "DROP_DATABASE", params = emptyMap(), requestId = "r1")
        val result = proxy.execute(cmd)
        assertFalse(result.success)
        assertTrue(result.message?.contains("not whitelisted") == true)
    }

    @Test
    fun `should execute whitelisted FORCE_START`() {
        val cmd = ProbeCommand(action = "FORCE_START", params = emptyMap(), requestId = "r2")
        val result = proxy.execute(cmd)
        assertTrue(result.success)
        assertEquals("r2", result.requestId)
    }

    @Test
    fun `should execute whitelisted STOP_GAME`() {
        val cmd = ProbeCommand(action = "STOP_GAME", params = emptyMap(), requestId = "r3")
        val result = proxy.execute(cmd)
        assertTrue(result.success)
    }
}
