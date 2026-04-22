package top.wcpe.mc.plugin.jianagent.command

enum class WhitelistActions(val actionId: String) {
    TELEPORT("TELEPORT"),
    FORCE_START("FORCE_START"),
    STOP_GAME("STOP_GAME"),
    SNAPSHOT("SNAPSHOT"),
    SWITCH_PHASE("SWITCH_PHASE"),
    RESET_MAP("RESET_MAP"),
    EQUIP("EQUIP"),
    ;

    companion object {
        private val BY_ID = entries.associateBy { it.actionId }

        fun fromId(id: String): WhitelistActions? = BY_ID[id]

        fun isAllowed(id: String): Boolean = BY_ID.containsKey(id)

        fun allIds(): List<String> = entries.map { it.actionId }
    }
}
