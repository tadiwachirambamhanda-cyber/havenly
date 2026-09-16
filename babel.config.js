module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 splits its Babel transform into react-native-worklets —
    // must be listed last, per the library's own setup requirement.
    plugins: ['react-native-worklets/plugin'],
  };
};
