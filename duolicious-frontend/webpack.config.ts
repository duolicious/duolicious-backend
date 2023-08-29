import path from 'path';
import createExpoWebpackConfigAsync from '@expo/webpack-config/webpack';
import { Arguments, Environment } from '@expo/webpack-config/webpack/types';

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  (config.module?.rules ?? []).forEach(r => {
    if (r && r !== '...' && r.oneOf) {
      r.oneOf.forEach(o => {
        if (o) {
          o.include = [
            path.resolve('.'),
          ]
        }
      })
    }
  })
  return config;
};
