{
  pkgs ? import <nixpkgs> {
    config.android_sdk.accept_license = true;
    config.allowUnfree = true;
  },
}:

let
  androidComposition = pkgs.androidenv.composeAndroidPackages {
    buildToolsVersions = [ "36.1.0" ];
    platformVersions = [ "35" ];
    includeNDK = true;
    ndkVersions = [ "29.0.14206865" ];
    cmakeVersions = [ "4.1.2" ];
    includeSources = false;
    includeSystemImages = false;
  };

  androidSdk = androidComposition.androidsdk;
  jdk = pkgs.jdk17;
in
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_22
    pkgs.nodePackages.pnpm
    jdk
    androidSdk
  ];

  ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
  ANDROID_SDK_ROOT = "${androidSdk}/libexec/android-sdk";
  JAVA_HOME = "${jdk}/lib/openjdk";

  shellHook = ''
    export PATH="${androidSdk}/libexec/android-sdk/platform-tools:$PATH"
    echo "Android SDK: $ANDROID_HOME"
    echo "Java: $(java -version 2>&1 | head -1)"
  '';
}
