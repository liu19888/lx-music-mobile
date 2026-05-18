const ios = require('@react-native-community/cli-platform-ios')
const android = require('@react-native-community/cli-platform-android')
const communityCliPlugin = require('@react-native/community-cli-plugin/dist/index.flow.js')

const commands = [
  ...ios.commands,
  ...android.commands,
  communityCliPlugin.bundleCommand,
  communityCliPlugin.ramBundleCommand,
  communityCliPlugin.startCommand,
].filter(Boolean)

module.exports = {
  commands,
  platforms: {
    ios: {
      projectConfig: ios.projectConfig,
      dependencyConfig: ios.dependencyConfig,
    },
    android: {
      projectConfig: android.projectConfig,
      dependencyConfig: android.dependencyConfig,
    },
  },
}
