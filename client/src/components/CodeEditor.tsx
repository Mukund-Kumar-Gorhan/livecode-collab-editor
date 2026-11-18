import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { SupportedLanguage } from '../types';

interface CodeEditorProps {
  language: SupportedLanguage;
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isViewer?: boolean;
}

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
  ydoc,
  provider,
  isViewer = false,
}) => {
  // Editor ko STATE me rakho taaki mount hote hi effects dobara chalein
  const [editor, setEditor] = useState<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorDidMount: OnMount = (ed) => {
    setEditor(ed);
  };

  // 1) Binding: editor + ydoc + provider teeno ready hone par hi banegi
  useEffect(() => {
    if (!editor || !ydoc || !provider) return;
    const model = editor.getModel();
    if (!model) return;

    const ytext = ydoc.getText('monaco');
    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness
    );

    return () => binding.destroy();
  }, [editor, ydoc, provider]);

  // 2) Remote cursor styles (naam + color)
  useEffect(() => {
    if (!provider) return;

    const updateCursorStyles = () => {
      const states = provider.awareness.getStates();
      let css = '';
      states.forEach((state: any, clientID: number) => {
        if (state.user?.color) {
          const color = state.user.color;
          const name = (state.user.name || 'Anonymous').replace(/['"\\]/g, '');
          css += `
            .yRemoteSelection-${clientID} { background-color: ${color}33 !important; }
            .yRemoteSelectionHead-${clientID} {
              position: absolute;
              border-left: ${color} solid 2px;
              border-top: ${color} solid 2px;
              border-bottom: ${color} solid 2px;
              height: 100%;
              box-sizing: border-box;
            }
            .yRemoteSelectionHead-${clientID}::after {
              position: absolute;
              content: '${name}';
              top: -1.4em;
              left: -2px;
              font-size: 10px;
              font-weight: 600;
              line-height: normal;
              background-color: ${color};
              color: #ffffff;
              padding: 1px 4px;
              border-radius: 3px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 100;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
          `;
        }
      });

      let styleTag = document.getElementById('yjs-cursor-styles');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'yjs-cursor-styles';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = css;
    };

    provider.awareness.on('change', updateCursorStyles);
    updateCursorStyles();

    return () => {
      provider.awareness.off('change', updateCursorStyles);
    };
  }, [provider]);

  // 3) Typing indicator: sirf LOCAL keyboard se (remote edits se nahi)
  useEffect(() => {
    if (!editor || !provider || isViewer) return;

    const disposable = editor.onKeyDown(() => {
      provider.awareness.setLocalStateField('isTyping', true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        provider.awareness.setLocalStateField('isTyping', false);
      }, 1500);
    });

    return () => {
      disposable.dispose();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [editor, provider, isViewer]);

  // Unmount par style tag hatao
  useEffect(() => {
    return () => {
      document.getElementById('yjs-cursor-styles')?.remove();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e] relative">
      <Editor
        height="100%"
        theme="vs-dark"
        language={mapLanguageToMonaco(language)}
        onMount={handleEditorDidMount}
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
          readOnly: isViewer,
          domReadOnly: isViewer,
        }}
      />
    </div>
  );
};