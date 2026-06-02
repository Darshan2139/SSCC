module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already includes the class-properties, private-methods,
    // and private-property-in-object transforms with the correct (spec, NOT
    // loose) configuration for Hermes / the New Architecture. Do not re-add them
    // with `{ loose: true }`: loose mode compiles class fields to plain
    // assignments instead of Object.defineProperty, which throws
    // "Cannot assign to read-only property 'NONE'" when constructing React
    // Native's DOM Event (its NONE/CAPTURING_PHASE/etc. are read-only on the
    // prototype). See babel-preset-expo's own note that loose mode "breaks all
    // getters and setters".
    presets: ['babel-preset-expo'],
  };
};
