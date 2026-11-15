export interface LanguageConfig {
  id: string;
  name: string;
  dockerImage: string;
  fileExtension: string;
  compileCommand?: (sourceFile: string) => string;
  runCommand: (targetFile: string) => string;
  defaultTimeoutMs: number;
}

/**
 * Supported Sandbox Languages and Execution Configs
 */
export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: 'python',
    name: 'Python 3.11',
    dockerImage: 'collab-sandbox-python:latest',
    fileExtension: 'py',
    runCommand: (sourceFile) => `python3 ${sourceFile}`,
    defaultTimeoutMs: 5000,
  },
  javascript: {
    id: 'javascript',
    name: 'Node.js 20',
    dockerImage: 'collab-sandbox-node:latest',
    fileExtension: 'js',
    runCommand: (sourceFile) => `node ${sourceFile}`,
    defaultTimeoutMs: 5000,
  },
  java: {
    id: 'java',
    name: 'Java 17',
    dockerImage: 'collab-sandbox-java:latest',
    fileExtension: 'java',
    compileCommand: (sourceFile) => `javac ${sourceFile}`,
    runCommand: () => `java Main`,
    defaultTimeoutMs: 8000,
  },
  cpp: {
    id: 'cpp',
    name: 'C++ (g++ 13)',
    dockerImage: 'collab-sandbox-cpp:latest',
    fileExtension: 'cpp',
    compileCommand: (sourceFile) => `g++ -O2 ${sourceFile} -o /tmp/main`,
    runCommand: () => `/tmp/main`,
    defaultTimeoutMs: 5000,
  },
};

