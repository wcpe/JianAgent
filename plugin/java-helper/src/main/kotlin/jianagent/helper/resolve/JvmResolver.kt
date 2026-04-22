package jianagent.helper.resolve

data class JvmProcessInfo(
    val pid: String,
    val displayName: String,
    val isMinecraft: Boolean,
)

class JvmResolver {
    fun listAll(): List<JvmProcessInfo> {
        return try {
            val vmClass = Class.forName("com.sun.tools.attach.VirtualMachine")
            val listMethod = vmClass.getMethod("list")
            @Suppress("UNCHECKED_CAST")
            val descriptors = listMethod.invoke(null) as List<Any>
            descriptors.map { desc ->
                val descClass = desc.javaClass
                val id = descClass.getMethod("id").invoke(desc) as String
                val displayName = descClass.getMethod("displayName").invoke(desc) as String
                JvmProcessInfo(
                    pid = id,
                    displayName = displayName,
                    isMinecraft = isMinecraftServer(displayName),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun isMinecraftServer(displayName: String): Boolean {
        val name = displayName.lowercase()
        return name.contains("minecraft") ||
            name.contains("paper") ||
            name.contains("spigot") ||
            name.contains("bukkit") ||
            name.contains("forge") ||
            name.contains("fabric")
    }
}
