package com.tvizle

import com.lagradost.cloudstream3.plugins.BasePlugin
import com.lagradost.cloudstream3.plugins.CloudstreamPlugin

@CloudstreamPlugin
class TvizlePlugin : BasePlugin() {
    override fun load() {
        registerMainAPI(TvizleProvider())
    }
}
