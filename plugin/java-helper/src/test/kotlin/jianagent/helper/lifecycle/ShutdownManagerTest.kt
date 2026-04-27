package jianagent.helper.lifecycle

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.util.concurrent.TimeUnit
import kotlin.test.assertTrue
import kotlin.test.assertFalse

class ShutdownManagerTest {
    
    @Test
    @Timeout(30, unit = TimeUnit.SECONDS)
    fun `test graceful shutdown with ProcessHandle`() {
        // Start a simple Java process
        val process = ProcessBuilder("java", "-version")
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        
        val pid = process.pid()
        assertTrue(process.isAlive, "Process should be alive initially")
        
        // Get ProcessHandle
        val handle = ProcessHandle.of(pid).orElse(null)
        assertTrue(handle != null, "ProcessHandle should exist")
        assertTrue(handle!!.isAlive, "ProcessHandle should report alive")
        
        // Test destroy (SIGTERM)
        val destroyed = handle.destroy()
        assertTrue(destroyed, "destroy() should return true")
        
        // Wait for process to exit
        handle.onExit().get(5, TimeUnit.SECONDS)
        
        // Verify process is dead
        assertFalse(handle.isAlive, "Process should be dead after destroy")
        assertFalse(process.isAlive, "Process should be dead")
    }
    
    @Test
    @Timeout(30, unit = TimeUnit.SECONDS)
    fun `test force shutdown with ProcessHandle`() {
        // Start a long-running process
        val process = ProcessBuilder("sleep", "1000")
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        
        val pid = process.pid()
        assertTrue(process.isAlive, "Process should be alive initially")
        
        // Get ProcessHandle
        val handle = ProcessHandle.of(pid).orElse(null)
        assertTrue(handle != null, "ProcessHandle should exist")
        
        // Test destroyForcibly (SIGKILL)
        val destroyed = handle!!.destroyForcibly()
        assertTrue(destroyed != null, "destroyForcibly() should return handle")
        
        // Wait for process to exit
        handle.onExit().get(5, TimeUnit.SECONDS)
        
        // Verify process is dead
        assertFalse(handle.isAlive, "Process should be dead after destroyForcibly")
        assertFalse(process.isAlive, "Process should be dead")
    }
}
