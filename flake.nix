{
  description = "Whoop App development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        jdk = pkgs.jdk17;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            jdk
            pkgs.zsh
          ];

          ANDROID_HOME = "/home/kucendro/Android/Sdk";
          ANDROID_SDK_ROOT = "/home/kucendro/Android/Sdk";
          JAVA_HOME = "${jdk}/lib/openjdk";

          shellHook = ''
            export PATH="$ANDROID_HOME/platform-tools:$PATH"
            echo "Android SDK: $ANDROID_HOME"
            echo "Java: $(java -version 2>&1 | head -1)"
            exec zsh
          '';
        };
      }
    );
}
