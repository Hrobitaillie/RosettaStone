import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rosettastone.app",
  appName: "RosettaStone",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
