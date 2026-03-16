{
  pkgs ? import <nixpkgs> { },
}:

let
  jdk = pkgs.jdk17;
in
pkgs.mkShell {
  buildInputs = [
    jdk
  ];

  ANDROID_HOME = "/home/kucendro/Android/Sdk";
  ANDROID_SDK_ROOT = "/home/kucendro/Android/Sdk";
  JAVA_HOME = "${jdk}/lib/openjdk";

  shellHook = ''
    export PATH="$ANDROID_HOME/platform-tools:$PATH"
    echo "Android SDK: $ANDROID_HOME"
    echo "Java: $(java -version 2>&1 | head -1)"
  '';
}
