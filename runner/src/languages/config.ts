export interface LanguageConfig {
  id: 'python' | 'javascript' | 'java' | 'cpp';
  name: string;
  dockerImage: string;
  fileExtension: string;
  isCompiled: boolean;
  memoryLimit: string;
  pidsLimit: number;
  getRunArgs: (entryFile: string, entryClass?: string) => string[];
  defaultTimeoutMs: number;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: 'python',
    name: 'Python 3.11',
    dockerImage: 'collab-sandbox-python:latest',
    fileExtension: 'py',
    isCompiled: false,
    memoryLimit: '128m',
    pidsLimit: 64,
    getRunArgs: (entryFile: string) => [
      'sh',
      '-c',
      `export PYTHONPATH=/sandbox:$PYTHONPATH && cd /sandbox && timeout 5 python3 "${entryFile}"`,
    ],
    defaultTimeoutMs: 5000,
  },
  javascript: {
    id: 'javascript',
    name: 'Node.js 20',
    dockerImage: 'collab-sandbox-node:latest',
    fileExtension: 'js',
    isCompiled: false,
    memoryLimit: '128m',
    pidsLimit: 64,
    getRunArgs: (entryFile: string) => [
      'sh',
      '-c',
      `cd /sandbox && timeout 5 node "${entryFile}"`,
    ],
    defaultTimeoutMs: 5000,
  },
  java: {
    id: 'java',
    name: 'Java 17',
    dockerImage: 'collab-sandbox-java:latest',
    fileExtension: 'java',
    isCompiled: true,
    memoryLimit: '384m',
    pidsLimit: 128,
    getRunArgs: (_entryFile: string, entryClass: string = 'Main') => [
      'sh',
      '-c',
      `timeout 15 sh -c 'find /sandbox -name "*.java" -type f | xargs javac -J-Xmx128m -J-XX:TieredStopAtLevel=1 -d /tmp -cp /sandbox' && timeout 5 java -Xmx128m -XX:TieredStopAtLevel=1 -cp /tmp:/sandbox ${entryClass}`,
    ],
    defaultTimeoutMs: 20000,
  },
  cpp: {
    id: 'cpp',
    name: 'C++ (g++ 13)',
    dockerImage: 'collab-sandbox-cpp:latest',
    fileExtension: 'cpp',
    isCompiled: true,
    memoryLimit: '128m',
    pidsLimit: 64,
    getRunArgs: () => [
      'sh',
      '-c',
      `SOURCES=$(find /sandbox -type f \\( -name "*.cpp" -o -name "*.c" -o -name "*.cc" -o -name "*.cxx" \\) 2>/dev/null) && timeout 15 g++ -O2 -I/sandbox $SOURCES -o /tmp/main && timeout 5 /tmp/main`,
    ],
    defaultTimeoutMs: 20000,
  },
};
