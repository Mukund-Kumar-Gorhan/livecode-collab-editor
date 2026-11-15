import React from 'react';
import Editor from '@monaco-editor/react';
import { SupportedLanguage } from '../types';

interface CodeEditorProps {
  language: SupportedLanguage;
  code: string;
  onChange: (value: string | undefined) => void;
}

/**
 * Monaco language string mapper
 */
const mapLanguageToMonaco = (lang: SupportedLanguage): string => {
  switch (lang) {
    case 'python':
      return 'python';
    case 'javascript':
      return 'javascript';
    case 'java':
      return 'java';
    case 'cpp':
      return 'cpp';
    default:
      return 'plaintext';
  }
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  onChange,
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
      <Editor
        height="100%"
        theme="vs-dark"
        language={mapLanguageToMonaco(language)}
        value={code}
        onChange={onChange}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          formatOnPaste: true,
          suggestOnTriggerCharacters: true,
        }}
        /*
         * FUTURE YJS INTEGRATION HOOK:
         * onMount={(editor) => {
         *   const ydoc = new Y.Doc();
         *   const ytext = ydoc.getText('monaco');
         *   const provider = new WebsocketProvider('ws://localhost:5000/ws', roomId, ydoc);
         *   const binding = new MonacoBinding(ytext, editor.getModel()!, new Set([editor]), provider.awareness);
         * }}
         */
      />
    </div>
  );
};

