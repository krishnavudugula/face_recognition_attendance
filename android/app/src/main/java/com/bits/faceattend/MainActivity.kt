package com.bits.faceattend

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import android.util.Log

class MainActivity : BridgeActivity() {
    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(LocationTrackingPlugin::class.java)
    }

    override fun onBackPressed() {
        Log.d(TAG, "🔙 Back button pressed")
        val jsCode = "window.handleAndroidBackButton && window.handleAndroidBackButton()"
        this.bridge.eval(jsCode, null)
        super.onBackPressed()
    }
}
