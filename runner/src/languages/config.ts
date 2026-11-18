export interface LanguageConfig {
  id: 'python' | 'javascript' | 'java' | 'cpp';
  name: string;
  dockerImage: string;
  fileExtension: string;
  getRunArgs: (filename: string, className?: string) => string[];
  defaultTimeoutMs: number;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: 'python',
    name: 'Python 3.11',
    dockerImage: 'collab-sandbox-python:latest',
    fileExtension: 'py',
    getRunArgs: (filename: string) => ['python3', `/sandbox/${filename}`],
    defaultTimeoutMs: 5000,
  },
  javascript: {
    id: 'javascript',
    name: 'Node.js 20',
    dockerImage: 'collab-sandbox-node:latest',
    fileExtension: 'js',
    getRunArgs: (filename: string) => ['node', `/sandbox/${filename}`],
    defaultTimeoutMs: 5000,
  },
  java: {
    id: 'java',
    name: 'Java 17',
    dockerImage: 'collab-sandbox-java:latest',
    fileExtension: 'java',
    getRunArgs: (filename: string, className: string = 'Main') => [
      'sh',
      '-c',
      `javac -J-Xmx64m -J-XX:TieredStopAtLevel=1 -d /tmp /sandbox/${filename} && java -Xmx64m -XX:TieredStopAtLevel=1 -cp /tmp ${className}`,
    ],
    defaultTimeoutMs: 5000,
  },
  cpp: {
    id: 'cpp',
    name: 'C++ (g++ 13)',
    dockerImage: 'collab-sandbox-cpp:latest',
    fileExtension: 'cpp',
    getRunArgs: (filename: string) => [
      'sh',
      '-c',
      `g++ -O2 /sandbox/${filename} -o /tmp/main && /tmp/main`,
    ],
    defaultTimeoutMs: 5000,
  },
};
