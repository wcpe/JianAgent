package jianagent.helper.scan

import java.util.jar.Manifest

object ManifestParser {
    fun parse(manifest: Manifest?): Map<String, String> {
        if (manifest == null) {
            return emptyMap()
        }

        val values = linkedMapOf<String, String>()
        for ((key, value) in manifest.mainAttributes) {
            values[key.toString()] = value.toString()
        }
        return values
    }
}