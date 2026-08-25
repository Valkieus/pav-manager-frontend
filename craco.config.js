const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Temporary: FAST_BUILD=1 skips Terser minification (the slowest
      // single step of a CRA production build) when compiling in a
      // CPU/time-constrained environment. Output still works fine, just
      // larger/un-minified — fine for an internal tool deploy in a pinch.
      if (process.env.FAST_BUILD === '1') {
        webpackConfig.optimization.minimize = false;
      }
      return webpackConfig;
    },
  },
};
