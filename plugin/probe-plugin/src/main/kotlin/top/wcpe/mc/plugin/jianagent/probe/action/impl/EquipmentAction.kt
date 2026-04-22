package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit
import org.bukkit.Material
import org.bukkit.inventory.ItemStack

class EquipmentAction : WhitelistAction {
    override val name = "give_equipment"

    override val paramSchema = mapOf(
        "target" to ParamType.PLAYER_NAME,
        "preset" to ParamType.STRING,
    )

    override fun execute(params: Map<String, Any>): ActionResult {
        val targetName = params["target"] as? String
            ?: return ActionResult(false, "Missing target player name")
        val player = Bukkit.getPlayerExact(targetName)
            ?: return ActionResult(false, "Player '$targetName' not found or offline")

        val preset = (params["preset"] as? String) ?: "iron"
        applyPreset(player, preset)

        return ActionResult(true, "Equipped player $targetName with preset '$preset'")
    }

    private fun applyPreset(player: org.bukkit.entity.Player, preset: String) {
        val inv = player.inventory
        when (preset.lowercase()) {
            "iron" -> {
                inv.helmet = ItemStack(Material.IRON_HELMET)
                inv.chestplate = ItemStack(Material.IRON_CHESTPLATE)
                inv.leggings = ItemStack(Material.IRON_LEGGINGS)
                inv.boots = ItemStack(Material.IRON_BOOTS)
                inv.addItem(ItemStack(Material.DIAMOND_SWORD))
            }
            "diamond" -> {
                inv.helmet = ItemStack(Material.DIAMOND_HELMET)
                inv.chestplate = ItemStack(Material.DIAMOND_CHESTPLATE)
                inv.leggings = ItemStack(Material.DIAMOND_LEGGINGS)
                inv.boots = ItemStack(Material.DIAMOND_BOOTS)
                inv.addItem(ItemStack(Material.DIAMOND_SWORD))
            }
            else -> {
                inv.addItem(ItemStack(Material.DIAMOND_SWORD))
            }
        }
    }
}
