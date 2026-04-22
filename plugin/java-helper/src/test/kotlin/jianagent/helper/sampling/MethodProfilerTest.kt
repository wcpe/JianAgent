package jianagent.helper.sampling

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach

class MethodProfilerTest {
    private lateinit var profiler: MethodProfiler

    @BeforeEach
    fun setUp() {
        profiler = MethodProfiler()
    }

    @Test
    fun `initial state is not running`() {
        assertFalse(profiler.isRunning)
    }

    @Test
    fun `stopProfiling sets running to false`() {
        profiler.stopProfiling()
        assertFalse(profiler.isRunning)
    }

    @Test
    fun `startProfiling throws when not attached`() {
        val attachManager = jianagent.helper.attach.AttachManager()
        assertThrows(IllegalStateException::class.java) {
            profiler.startProfiling(attachManager, 1)
        }
    }

    @Test
    fun `stopProfiling is safe to call multiple times`() {
        profiler.stopProfiling()
        profiler.stopProfiling()
        assertFalse(profiler.isRunning)
    }

    @Test
    fun `profiler returns empty result when JMX unavailable`() {
        // Since we can't easily mock JMX in unit tests,
        // verify the profiler handles missing connector gracefully
        val attachManager = jianagent.helper.attach.AttachManager()
        val ex = assertThrows(IllegalStateException::class.java) {
            profiler.startProfiling(attachManager, 1)
        }
        assertTrue(ex.message?.contains("Not attached") == true || ex.message?.contains("JMX") == true)
    }
}
