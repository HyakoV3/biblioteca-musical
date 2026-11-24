import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Assinatura de release (opcional): lê keystore.properties (raiz do projeto Android) ou as variáveis BM_KEYSTORE, BM_KEYSTORE_PASSWORD,
// BM_KEY_ALIAS e BM_KEY_PASSWORD (o workflow release.yml as define a partir dos segredos do GitHub). Sem nenhum dos dois, o release continua
// saindo "unsigned" e é assinado depois com o apksigner (docs/apk-de-teste.md): o fluxo dos APKs de teste não muda.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
// Valor vazio ("keyPassword=" do .example, variável em branco) conta como ausente.
fun segredo(chave: String, env: String): String? =
    (keystoreProps.getProperty(chave) ?: System.getenv(env))?.trim()?.takeIf { it.isNotEmpty() }
val ksArquivo = segredo("storeFile", "BM_KEYSTORE")?.let { rootProject.file(it) } // relativo à raiz do projeto Android, como o keystore.properties
val ksSenha = segredo("storePassword", "BM_KEYSTORE_PASSWORD")
val ksAlias = segredo("keyAlias", "BM_KEY_ALIAS")
val ksSenhaChave = segredo("keyPassword", "BM_KEY_PASSWORD") ?: ksSenha
val assinaturaConfigurada = ksArquivo != null && ksArquivo.isFile && ksSenha != null && ksAlias != null
// Configuração PELA METADE (caminho errado, senha faltando): falha em vez de sair "unsigned" sem avisar.
if (!assinaturaConfigurada && (ksArquivo != null || ksSenha != null || ksAlias != null)) {
    throw GradleException(
        "Assinatura de release incompleta: precisa de storeFile (um arquivo que existe), storePassword e keyAlias " +
            "(keystore.properties ou BM_KEYSTORE, BM_KEYSTORE_PASSWORD e BM_KEY_ALIAS). Apague o que sobrou para sair sem assinatura.",
    )
}

android {
    compileSdk = 37
    namespace = "br.pro.bibliotecamusical"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "br.pro.bibliotecamusical"
        minSdk = 24
        targetSdk = 37
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        if (assinaturaConfigurada) {
            create("release") {
                storeFile = ksArquivo
                storePassword = ksSenha
                keyAlias = ksAlias
                keyPassword = ksSenhaChave
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (assinaturaConfigurada) {
                signingConfig = signingConfigs.getByName("release")
            }
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
