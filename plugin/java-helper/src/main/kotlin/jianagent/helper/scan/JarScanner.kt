package jianagent.helper.scan

import org.objectweb.asm.ClassReader
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import java.io.File
import java.util.jar.JarFile

class JarScanner {
    fun scan(jarPath: String): Map<String, Any?> {
        val jarFile = File(jarPath)
        require(jarFile.isFile) { "jar not found: $jarPath" }

        JarFile(jarFile).use { jar ->
            val manifest = ManifestParser.parse(jar.manifest)
            val manifestMainClass = manifest["Main-Class"]?.trim()?.takeIf { it.isNotEmpty() }
            val bytecodeMainClasses = linkedSetOf<String>()
            var totalClasses = 0

            val entries = jar.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (!entry.name.endsWith(".class")) {
                    continue
                }

                totalClasses++
                jar.getInputStream(entry).use { input ->
                    val reader = ClassReader(input)
                    if (hasPublicStaticMain(reader)) {
                        bytecodeMainClasses.add(reader.className.replace('/', '.'))
                    }
                }
            }

            val mergedMainClasses = linkedSetOf<String>()
            if (manifestMainClass != null) {
                mergedMainClasses.add(manifestMainClass)
            }
            mergedMainClasses.addAll(bytecodeMainClasses)

            val entryClasses = mergedMainClasses.map { className ->
                val isManifestMain = className == manifestMainClass
                val source = when {
                    isManifestMain && bytecodeMainClasses.contains(className) -> "manifest+bytecode"
                    isManifestMain -> "manifest"
                    else -> "bytecode"
                }

                mapOf(
                    "className" to className,
                    "isMainClass" to isManifestMain,
                    "source" to source,
                )
            }

            return mapOf(
                "entryClasses" to entryClasses,
                "manifest" to manifest,
                "totalClasses" to totalClasses,
            )
        }
    }

    private fun hasPublicStaticMain(reader: ClassReader): Boolean {
        var found = false
        reader.accept(object : ClassVisitor(Opcodes.ASM9) {
            override fun visitMethod(
                access: Int,
                name: String?,
                descriptor: String?,
                signature: String?,
                exceptions: Array<out String>?,
            ): MethodVisitor? {
                if (
                    name == "main" &&
                    descriptor == "([Ljava/lang/String;)V" &&
                    access and Opcodes.ACC_PUBLIC != 0 &&
                    access and Opcodes.ACC_STATIC != 0
                ) {
                    found = true
                }
                return null
            }
        }, ClassReader.SKIP_CODE or ClassReader.SKIP_DEBUG or ClassReader.SKIP_FRAMES)
        return found
    }
}