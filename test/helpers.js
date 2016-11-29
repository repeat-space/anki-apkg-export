import test from 'ava';

import 'babel-register';
import 'babel-polyfill';

import {
    checksum
} from '../src/_helpers';

test('checksum', t => {
    t.truthy(typeof checksum === 'function', 'should be a function');
    t.truthy(checksum('some string') === 2336613565, 'san calculate checksume for `some string`');
});