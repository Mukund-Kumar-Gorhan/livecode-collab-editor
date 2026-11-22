import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { useThemeStore } from '../store/themeStore';
import { registerMonacoThemes, getMonacoThemeName } from '../utils/monacoThemes';
import { getLanguageInfo } from '../utils/language';
import { Code2 } from 'lucide-react';

interface CodeEditorProps {
  activeFile: string | null;
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isViewer?: boolean;
  fontSize?: number;
  tabSize?: number;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  activeFile,
  ydoc,
  provider,
  isViewer = false,
  fontSize = 14,
  tabSize = 2,
}) => {
  const { theme } = useThemeStore();
  const [editor, setEditor] = useState<any>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const monacoRef = useRef<any>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const langInfo = activeFile ? getLanguageInfo(activeFile) : null;
  const currentMonacoLang = langInfo ? langInfo.monacoLanguage : 'plaintext';

  const handleEditorDidMount: OnMount = (ed, monaco) => {
    setEditor(ed);
    monacoRef.current = monaco;
    registerMonacoThemes(monaco);
    monaco.editor.setTheme(getMonacoThemeName(theme));
  };

  // Sync Monaco editor theme whenever app theme changes
  useEffect(() => {
    if (monacoRef.current) {
      registerMonacoThemes(monacoRef.current);
      monacoRef.current.editor.setTheme(getMonacoThemeName(theme));
    }
  }, [theme]);

  // Update dynamic editor options (font size, tab size, readOnly, mobile adjustments)
  const effectiveFontSize = isMobile ? Math.min(fontSize, 13) : fontSize;

  useEffect(() => {
    if (editor) {
      editor.updateOptions({
        fontSize: effectiveFontSize,
        tabSize,
        readOnly: isViewer,
        domReadOnly: isViewer,
        minimap: { enabled: !isMobile },
        overviewRulerLanes: isMobile ? 0 : 3,
        glyphMargin: !isMobile,
        folding: !isMobile,
        lineNumbersMinChars: isMobile ? 3 : 5,
      });
    }
  }, [editor, effectiveFontSize, tabSize, isViewer, isMobile]);

  // Update local awareness activeFile
  useEffect(() => {
    if (provider && provider.awareness) {
      provider.awareness.setLocalStateField('activeFile', activeFile);
    }
  }, [provider, activeFile]);

  // 1) Bind active Y.Text to Monaco Editor Model
  useEffect(() => {
    if (!editor || !ydoc || !provider || !monacoRef.current || !activeFile) {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      return;
    }

    const filesMap = ydoc.getMap('files');
    let ytext = filesMap.get(activeFile) as Y.Text | undefined;

    // Fallback if filesMap doesn't have it yet, check monaco text
    if (!ytext) {
      ytext = ydoc.getText('monaco');
    }

    const monaco = monacoRef.current;
    const uri = monaco.Uri.parse(`inmemory:///${activeFile}`);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      model = monaco.editor.createModel('', currentMonacoLang, uri);
    } else {
      monaco.editor.setModelLanguage(model, currentMonacoLang);
    }

    // Clean up previous binding before binding new file model
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    editor.setModel(model);

    // Create fresh MonacoBinding for the active file
    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness
    );
    bindingRef.current = binding;

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [editor, ydoc, provider, activeFile, currentMonacoLang]);

  // 2) Remote cursor styles (filtered by activeFile)
  useEffect(() => {
    if (!provider) return;

    const updateCursorStyles = () => {
      const states = provider.awareness.getStates();
      let css = '';
      states.forEach((state: any, clientID: number) => {
        // Sirf usi client ka cursor dikhao jo CURRENT activeFile dekh raha hai
        if (state.user?.color && state.activeFile === activeFile) {
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
              font-family: 'JetBrains Mono', monospace;
              font-weight: 600;
              line-height: normal;
              background-color: ${color};
              color: #ffffff;
              padding: 1px 4px;
              border-radius: 3px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 100;
              box-shadow: 0 1px 4px rgba(0,0,0,0.3);
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
  }, [provider, activeFile]);

  // 3) Typing indicator: local keyboard typing tracking
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

  // Clean up style tag on unmount
  useEffect(() => {
    return () => {
      document.getElementById('yjs-cursor-styles')?.remove();
    };
  }, []);

  if (!activeFile) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-app-bg text-app-text-muted select-none">
        <div className="w-12 h-12 rounded-xl bg-app-surface-2 border border-app-border flex items-center justify-center text-app-accent mb-3">
          <Code2 className="w-6 h-6" />
        </div>
        <p className="text-xs font-mono font-medium">No file open</p>
        <p className="text-[11px] text-app-text-muted/70 mt-1">
          Select a file from the explorer on the left or create a new file
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-app-bg relative">
      <Editor
        height="100%"
        theme={getMonacoThemeName(theme)}
        language={currentMonacoLang}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: !isMobile },
          fontSize: effectiveFontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          lineNumbersMinChars: isMobile ? 3 : 5,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize,
          wordWrap: 'on',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          formatOnPaste: true,
          suggestOnTriggerCharacters: true,
          readOnly: isViewer,
          domReadOnly: isViewer,
          overviewRulerLanes: isMobile ? 0 : 3,
          glyphMargin: !isMobile,
          folding: !isMobile,
          scrollbar: {
            verticalScrollbarSize: isMobile ? 6 : 10,
            horizontalScrollbarSize: isMobile ? 6 : 10,
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
    </div>
  );
};
