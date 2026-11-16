import React, { useEffect, useRef } from 'react';
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
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update cursor styles based on awareness states
  const updateCursorStyles = () => {
    if (!provider) return;
    const states = provider.awareness.getStates();
    let css = '';
    states.forEach((state: any, clientID: number) => {
      if (state.user?.color) {
        const color = state.user.color;
        const name = (state.user.name || 'Anonymous').replace(/'/g, "\\'");
        css += `
          .yRemoteSelection-${clientID} {
            background-color: ${color}33 !important;
          }
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
            font-family: inherit;
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

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    if (ydoc && provider) {
      const ytext = ydoc.getText('monaco');
      const model = editor.getModel();
      if (model) {
        bindingRef.current = new MonacoBinding(
          ytext,
          model,
          new Set([editor]),
          provider.awareness
        );
      }

      // Listen for typing events to update awareness state
      editor.onDidChangeModelContent(() => {
        if (isViewer) return;
        provider.awareness.setLocalStateField('isTyping', true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          provider.awareness.setLocalStateField('isTyping', false);
        }, 1500);
      });

      // Update cursor styling on awareness change
      provider.awareness.on('change', updateCursorStyles);
      updateCursorStyles();
    }
  };

  // Re-bind if provider or ydoc changes
  useEffect(() => {
    if (!editorRef.current || !ydoc || !provider) return;

    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const ytext = ydoc.getText('monaco');
    const model = editorRef.current.getModel();
    if (model) {
      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editorRef.current]),
        provider.awareness
      );
    }

    provider.awareness.on('change', updateCursorStyles);
    updateCursorStyles();

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (provider) {
        provider.awareness.off('change', updateCursorStyles);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [ydoc, provider]);

  // Clean up styles on unmount
  useEffect(() => {
    return () => {
      const styleTag = document.getElementById('yjs-cursor-styles');
      if (styleTag) {
        styleTag.remove();
      }
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
