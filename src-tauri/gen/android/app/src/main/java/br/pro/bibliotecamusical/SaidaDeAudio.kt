package br.pro.bibliotecamusical

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/** Consulta ao Android de onde o som sai agora (fone ou alto-falante). Só lê as saídas de áudio; qualquer falha vale como "sem fone" e "alto-falante". */
internal object SaidaDeAudio {
    /** Há fone ligado (com fio, USB ou Bluetooth)? */
    fun temFone(contexto: Context): Boolean {
        return try {
            tipos(contexto).any { ehFone(it) }
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para saber se há fone", e)
            false
        }
    }

    /** "usb", "fio", "bluetooth" ou "alto-falante"; com várias saídas ligadas vale a ordem do Android (USB, depois fio, depois Bluetooth). */
    fun rota(contexto: Context): String {
        return try {
            rotaDosTipos(tipos(contexto))
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para saber a rota de saída", e)
            "alto-falante"
        }
    }

    private fun tipos(contexto: Context): List<Int> {
        val audio = contexto.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        return audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { it.type }
    }
}

private fun rotaDosTipos(tipos: List<Int>): String = when {
    tipos.any { ehUsb(it) } -> "usb"
    tipos.any { ehFio(it) } -> "fio"
    tipos.any { ehBluetooth(it) } -> "bluetooth"
    else -> "alto-falante"
}

private fun ehFone(tipo: Int): Boolean = when (tipo) {
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_USB_HEADSET,
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> true
    else -> ehBle(tipo)
}

private fun ehBle(tipo: Int): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && tipo == AudioDeviceInfo.TYPE_BLE_HEADSET

private fun ehUsb(tipo: Int): Boolean = tipo == AudioDeviceInfo.TYPE_USB_HEADSET || tipo == AudioDeviceInfo.TYPE_USB_DEVICE

private fun ehFio(tipo: Int): Boolean = tipo == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || tipo == AudioDeviceInfo.TYPE_WIRED_HEADSET

private fun ehBluetooth(tipo: Int): Boolean =
    tipo == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || tipo == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || ehBle(tipo)
