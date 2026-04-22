package jianagent.helper

import com.google.gson.Gson
import org.junit.jupiter.api.io.TempDir
import org.junit.jupiter.api.Test
import java.nio.file.Path
import java.util.jar.Attributes
import java.util.jar.JarEntry
import java.util.jar.JarOutputStream
import java.util.jar.Manifest
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class CommandDispatcherTest {
    private val gson = Gson()
    private val dispatcher = CommandDispatcher(gson)

    @Test
    fun `dispatch status returns success`() {
        val result = dispatcher.dispatch("""{"type":"status"}""")
        assertEquals("result", result["type"])
        assertTrue(result["success"] as Boolean)
    }

    @Test
    fun `dispatch unknown command returns error`() {
        val result = dispatcher.dispatch("""{"type":"unknown"}""")
        assertEquals("error", result["type"])
        assertEquals(false, result["success"])
    }

    @Test
    fun `dispatch missing type returns error`() {
        val result = dispatcher.dispatch("""{"foo":"bar"}""")
        assertEquals("error", result["type"])
    }

    @Test
    fun `dispatch resolve returns list`() {
        val result = dispatcher.dispatch("""{"type":"resolve"}""")
        assertEquals("result", result["type"])
        assertTrue(result["success"] as Boolean)
    }

    @Test
    fun `dispatch invalid json returns error`() {
        val result = dispatcher.dispatch("not json")
        assertEquals("error", result["type"])
    }

    @Test
    fun `dispatch scan jar returns entry class and manifest main class`(@TempDir tempDir: Path) {
        val jarPath = tempDir.resolve("helper-test.jar")
        val manifest = Manifest().apply {
            mainAttributes[Attributes.Name.MANIFEST_VERSION] = "1.0"
            mainAttributes[Attributes.Name.MAIN_CLASS] = "jianagent.helper.MainKt"
        }

        JarOutputStream(jarPath.toFile().outputStream(), manifest).use { jar ->
            val classResource = dispatcher.javaClass.classLoader
                .getResourceAsStream("jianagent/helper/MainKt.class")
            assertNotNull(classResource)

            jar.putNextEntry(JarEntry("jianagent/helper/MainKt.class"))
            classResource.copyTo(jar)
            jar.closeEntry()
        }

        val result = dispatcher.dispatch(
            gson.toJson(
                mapOf(
                    "type" to "scan-jar",
                    "jarPath" to jarPath.toAbsolutePath().toString(),
                ),
            ),
        )
        assertEquals("result", result["type"])
        assertEquals(true, result["success"])

        val data = result["data"] as Map<*, *>
        val entryClasses = data["entryClasses"] as List<*>
        assertTrue(entryClasses.isNotEmpty())

        val first = entryClasses.first() as Map<*, *>
        assertEquals("jianagent.helper.MainKt", first["className"])
        assertEquals(true, first["isMainClass"])

        val manifestData = data["manifest"] as Map<*, *>
        assertEquals("jianagent.helper.MainKt", manifestData["Main-Class"])
    }
}
