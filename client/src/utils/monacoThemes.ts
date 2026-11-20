import { AppTheme } from '../types';

let themesRegistered = false;

export const registerMonacoThemes = (monaco: any) => {
  if (themesRegistered || !monaco) return;

  // 1. Midnight Theme
  monaco.editor.defineTheme('collab-midnight', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'identifier', foreground: 'f0f6fc' },
      { token: 'type', foreground: '58a6ff' },
      { token: 'delimiter', foreground: '8b949e' },
    ],
    colors: {
      'editor.background': '#0e1117',
      'editor.foreground': '#f0f6fc',
      'editor.lineHighlightBackground': '#161b22',
      'editorCursor.foreground': '#38bdf8',
      'editorWhitespace.foreground': '#21262d',
      'editorIndentGuide.background': '#21262d',
      'editorIndentGuide.activeBackground': '#30363d',
      'editorLineNumber.foreground': '#484f58',
      'editorLineNumber.activeForeground': '#f0f6fc',
    },
  });

  // 2. Light Theme
  monaco.editor.defineTheme('collab-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0284c7', fontStyle: 'bold' },
      { token: 'string', foreground: '0d9488' },
      { token: 'number', foreground: 'ea580c' },
      { token: 'identifier', foreground: '0f172a' },
      { token: 'type', foreground: '4f46e5' },
      { token: 'delimiter', foreground: '475569' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0f172a',
      'editor.lineHighlightBackground': '#f1f5f9',
      'editorCursor.foreground': '#0284c7',
      'editorWhitespace.foreground': '#e2e8f0',
      'editorIndentGuide.background': '#e2e8f0',
      'editorIndentGuide.activeBackground': '#cbd5e1',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#0f172a',
    },
  });

  // 3. Dracula Theme
  monaco.editor.defineTheme('collab-dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'identifier', foreground: 'f8f8f2' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'delimiter', foreground: 'ffb86c' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#343746',
      'editorCursor.foreground': '#bd93f9',
      'editorWhitespace.foreground': '#44475a',
      'editorIndentGuide.background': '#343746',
      'editorIndentGuide.activeBackground': '#44475a',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
    },
  });

  // 4. One Dark Theme
  monaco.editor.defineTheme('collab-one-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'identifier', foreground: 'abb2bf' },
      { token: 'type', foreground: '61afef' },
      { token: 'delimiter', foreground: 'abb2bf' },
    ],
    colors: {
      'editor.background': '#21252b',
      'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313a',
      'editorCursor.foreground': '#61afef',
      'editorWhitespace.foreground': '#3b4048',
      'editorIndentGuide.background': '#2c313a',
      'editorIndentGuide.activeBackground': '#3e4451',
      'editorLineNumber.foreground': '#5c6370',
      'editorLineNumber.activeForeground': '#abb2bf',
    },
  });

  // 5. Cyberpunk Theme
  monaco.editor.defineTheme('collab-cyberpunk', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '645394', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff007f', fontStyle: 'bold' },
      { token: 'string', foreground: '00ff9f' },
      { token: 'number', foreground: 'fcee0a' },
      { token: 'identifier', foreground: 'f0f6fc' },
      { token: 'type', foreground: '00f0ff' },
      { token: 'delimiter', foreground: 'ff79c6' },
    ],
    colors: {
      'editor.background': '#090814',
      'editor.foreground': '#f0f6fc',
      'editor.lineHighlightBackground': '#1c183b',
      'editorCursor.foreground': '#ff007f',
      'editorWhitespace.foreground': '#27204f',
      'editorIndentGuide.background': '#1c183b',
      'editorIndentGuide.activeBackground': '#362f6b',
      'editorLineNumber.foreground': '#7b68ae',
      'editorLineNumber.activeForeground': '#ff007f',
    },
  });

  themesRegistered = true;
};

export const getMonacoThemeName = (theme: AppTheme): string => {
  switch (theme) {
    case 'light':
      return 'collab-light';
    case 'dracula':
      return 'collab-dracula';
    case 'one-dark':
      return 'collab-one-dark';
    case 'cyberpunk':
      return 'collab-cyberpunk';
    case 'midnight':
    default:
      return 'collab-midnight';
  }
};
