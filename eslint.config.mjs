import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['_archive/**', '.next/**', 'node_modules/**', 'bot-worker/**', 'scripts/**', 'server/**', 'public/**'] },
  { files: ['**/*.{js,jsx,mjs,ts,tsx}'] },
  ...compat.extends('next/core-web-vitals'),
  // Registers the plugin so existing eslint-disable comments that name its
  // rules resolve. None of its rules are switched on here.
  ...compat.config({ plugins: ['@typescript-eslint'] }),
  {
    rules: {
      // Polish UI copy is full of quotes; React renders them correctly.
      'react/no-unescaped-entities': 'off',
    },
  },
];
