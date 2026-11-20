/**
 * Language auto-detection from file extension and Monaco language mapping.
 */

export interface LanguageInfo {
  id: string;
  name: string;
  monacoLanguage: string;
  isExecutable: boolean;
}

const EXTENSION_MAP: Record<string, LanguageInfo> = {
  // Python
  py: { id: 'python', name: 'Python 3.11', monacoLanguage: 'python', isExecutable: true },
  pyw: { id: 'python', name: 'Python', monacoLanguage: 'python', isExecutable: true },

  // JavaScript / TypeScript
  js: { id: 'javascript', name: 'JavaScript (Node)', monacoLanguage: 'javascript', isExecutable: true },
  mjs: { id: 'javascript', name: 'JavaScript (Node)', monacoLanguage: 'javascript', isExecutable: true },
  cjs: { id: 'javascript', name: 'JavaScript (Node)', monacoLanguage: 'javascript', isExecutable: true },
  jsx: { id: 'javascript', name: 'React JSX', monacoLanguage: 'javascript', isExecutable: false },
  ts: { id: 'typescript', name: 'TypeScript', monacoLanguage: 'typescript', isExecutable: false },
  tsx: { id: 'typescript', name: 'React TSX', monacoLanguage: 'typescript', isExecutable: false },

  // Java
  java: { id: 'java', name: 'Java 17', monacoLanguage: 'java', isExecutable: true },

  // C / C++
  c: { id: 'cpp', name: 'C (g++)', monacoLanguage: 'c', isExecutable: true },
  cpp: { id: 'cpp', name: 'C++ (g++ 13)', monacoLanguage: 'cpp', isExecutable: true },
  cc: { id: 'cpp', name: 'C++', monacoLanguage: 'cpp', isExecutable: true },
  cxx: { id: 'cpp', name: 'C++', monacoLanguage: 'cpp', isExecutable: true },
  h: { id: 'cpp', name: 'C/C++ Header', monacoLanguage: 'cpp', isExecutable: false },
  hpp: { id: 'cpp', name: 'C++ Header', monacoLanguage: 'cpp', isExecutable: false },

  // Go / Rust
  go: { id: 'go', name: 'Go', monacoLanguage: 'go', isExecutable: false },
  rs: { id: 'rust', name: 'Rust', monacoLanguage: 'rust', isExecutable: false },

  // Web & Data
  html: { id: 'html', name: 'HTML', monacoLanguage: 'html', isExecutable: false },
  htm: { id: 'html', name: 'HTML', monacoLanguage: 'html', isExecutable: false },
  css: { id: 'css', name: 'CSS', monacoLanguage: 'css', isExecutable: false },
  scss: { id: 'scss', name: 'SCSS', monacoLanguage: 'scss', isExecutable: false },
  json: { id: 'json', name: 'JSON', monacoLanguage: 'json', isExecutable: false },
  md: { id: 'markdown', name: 'Markdown', monacoLanguage: 'markdown', isExecutable: false },
  markdown: { id: 'markdown', name: 'Markdown', monacoLanguage: 'markdown', isExecutable: false },
  yml: { id: 'yaml', name: 'YAML', monacoLanguage: 'yaml', isExecutable: false },
  yaml: { id: 'yaml', name: 'YAML', monacoLanguage: 'yaml', isExecutable: false },
  sh: { id: 'shell', name: 'Shell Script', monacoLanguage: 'shell', isExecutable: false },
  bash: { id: 'shell', name: 'Bash', monacoLanguage: 'shell', isExecutable: false },
  sql: { id: 'sql', name: 'SQL', monacoLanguage: 'sql', isExecutable: false },
  xml: { id: 'xml', name: 'XML', monacoLanguage: 'xml', isExecutable: false },
  txt: { id: 'plaintext', name: 'Plain Text', monacoLanguage: 'plaintext', isExecutable: false },
};

/**
 * Extracts extension from filename/path and returns detected language info.
 */
export function getLanguageInfo(filePath: string): LanguageInfo {
  if (!filePath) {
    return { id: 'plaintext', name: 'Plain Text', monacoLanguage: 'plaintext', isExecutable: false };
  }

  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return { id: 'plaintext', name: 'Plain Text', monacoLanguage: 'plaintext', isExecutable: false };
  }

  const ext = filename.substring(dotIndex + 1).toLowerCase();
  return EXTENSION_MAP[ext] || { id: ext, name: ext.toUpperCase(), monacoLanguage: 'plaintext', isExecutable: false };
}
