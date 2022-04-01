module.exports = {
    webpack: (config, { defaultLoaders, dir }) => {
      const rulesExceptBabelLoaderRule = config.module.rules.filter(
        (rule) => rule.use !== defaultLoaders.babel
      );
  
      config.module.rules = [
        ...rulesExceptBabelLoaderRule,
        {
          test: /\.(js|jsx)$/,
          include: [dir],
          exclude: /node_modules/,
          use: [
            'babel-inline-import-loader',
            {
              ...defaultLoaders.babel,
              options: {
                ...defaultLoaders.babel.options,
                // Disable cacheDirectory so that Babel
                // always rebuilds dependent modules
                cacheDirectory: false,
              },
            },
          ],
        },
      ];
      return config;
    },
  };
  