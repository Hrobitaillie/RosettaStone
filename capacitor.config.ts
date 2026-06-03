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
      style: "LIGHT",
      backgroundColor: "#0d0d0f",
    },
  },
};

export default config;
