package top.wcpe.mc.plugin.jianagent.runtime

import com.google.gson.JsonElement

interface ProbeMessageRouter {
    fun route(channel: String, payload: JsonElement)
}