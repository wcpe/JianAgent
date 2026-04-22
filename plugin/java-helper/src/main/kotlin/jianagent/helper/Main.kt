package jianagent.helper

import com.google.gson.Gson
import java.io.BufferedReader
import java.io.InputStreamReader

fun main() {
    val gson = Gson()
    val dispatcher = CommandDispatcher(gson)
    val reader = BufferedReader(InputStreamReader(System.`in`))

    println(gson.toJson(mapOf("type" to "ready")))
    System.out.flush()

    while (true) {
        val line = reader.readLine() ?: break
        val response = dispatcher.dispatch(line)
        println(gson.toJson(response))
        System.out.flush()
    }
}
