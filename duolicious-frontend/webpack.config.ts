import createExpoWebpackConfigAsync from '@expo/webpack-config/webpack';
import { Arguments, Environment } from '@expo/webpack-config/webpack/types';
const path = require('path')

module.exports = async function(env, argv) {
    const config = await createExpoWebpackConfigAsync(env, argv);
    config.module.rules.forEach(r => {
        if (r.oneOf) {
            r.oneOf.forEach(o => {
                  o.include = [
                      path.resolve('.'),
                  ]
            })
        }
    })
    return config;
};
