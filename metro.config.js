// metro.config.js
// Varsayılan Expo Metro yapılandırması + 'agent/' klasörünü dışla.
// agent/ ayrı bir Node servisidir (çevirmen ajan); uygulama paketine girmemeli.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/\/agent\/.*/];

module.exports = config;
