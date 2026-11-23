import lodash from 'lodash';
import { sharedLabel } from './shared.js';
import './lazy.css';
export const details = lodash.shuffle([sharedLabel, 'candidate dependency']).join(' ');
