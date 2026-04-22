package top.wcpe.mc.plugin.jianagent.api.protocol

import org.junit.jupiter.api.Test
import kotlin.test.assertTrue
import kotlin.test.assertFalse
import kotlin.test.assertEquals

class ProtocolVersionTest {
    @Test
    fun `CURRENT should be 1`() {
        assertEquals(1, ProtocolVersion.CURRENT)
    }

    @Test
    fun `same version should be compatible`() {
        assertTrue(ProtocolVersion.isCompatible(1))
    }

    @Test
    fun `version 0 should not be compatible`() {
        assertFalse(ProtocolVersion.isCompatible(0))
    }

    @Test
    fun `future version should not be compatible`() {
        assertFalse(ProtocolVersion.isCompatible(999))
    }
}
