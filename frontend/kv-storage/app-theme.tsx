import { AppThemeName } from '../app-theme/app-theme';
import { storeKv } from './kv-storage';

const valueToAppThemeName = (x: any): AppThemeName => {
  if (x === 'dark') {
    return 'dark';
  } else {
    return 'light';
  }
}

const appThemeName = async (value?: AppThemeName): Promise<AppThemeName> => {
  return valueToAppThemeName(await storeKv('app_theme_name', value));
};

export {
  appThemeName,
}
