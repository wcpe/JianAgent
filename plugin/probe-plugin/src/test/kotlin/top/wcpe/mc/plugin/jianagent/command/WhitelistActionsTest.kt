package top.wcpe.mc.plugin.jianagent.command

import org.junit.jupiter.api.Test
import kotlin.test.assertTrue
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class WhitelistActionsTest {
    @Test
    fun `should recognize valid action`() {
        assertTrue(WhitelistActions.isAllowed("TELEPORT"))
        assertTrue(WhitelistActions.isAllowed("FORCE_START"))
        assertTrue(WhitelistActions.isAllowed("SNAPSHOT"))
    }

    @Test
    fun `should reject unknown action`() {
        assertFalse(WhitelistActions.isAllowed("DROP_TABLE"))
        assertFalse(WhitelistActions.isAllowed("EXECUTE_COMMAND"))
        assertFalse(WhitelistActions.isAllowed(""))
    }

    @Test
    fun `should resolve from id`() {
        assertNotNull(WhitelistActions.fromId("TELEPORT"))
        assertNull(WhitelistActions.fromId("INVALID"))
    }

    @Test
    fun `allIds should contain all entries`() {
        val ids = WhitelistActions.allIds()
        assertTrue(ids.contains("TELEPORT"))
        assertTrue(ids.contains("STOP_GAME"))
        assertTrue(ids.size >= 7)
    }
}
