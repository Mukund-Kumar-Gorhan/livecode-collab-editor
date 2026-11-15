import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EditorHeader } from '../components/EditorHeader';
import { CodeEditor } from '../components/CodeEditor';
import { SupportedLanguage, Room, RoomRole } from '../types';
import { roomApi } from '../services/api';
import { toast } from '../store/toastStore';
import { Terminal, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const STARTER_CODE: Record<SupportedLanguage, string> = {
  python: `# Welcome to LiveCode - Python 3.11 Workspace
def fibonacci(n: int):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print("Hello, Collaborative World from Python!")
print("Fibonacci sequence:", list(fibonacci(10)))
`,
  javascript: `// Welcome to LiveCode - Node.js Workspace
function greet(team) {
  return \`Hello, \${team}! Real-time collaborative coding is live.\`;
}

console.log(greet("Senior Engineers"));
console.log("Memory usage:", process.memoryUsage().heapUsed, "bytes");
`,
  java: `// Welcome to LiveCode - Java 17 Workspace
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 17 Sandbox!");
        System.out.println("JVM Architecture: " + System.getProperty("os.arch"));
    }
}
`,
  cpp: `// Welcome to LiveCode - C++ (g++ 13) Workspace
#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "Hello from C++ Sandbox!" << std::endl;
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    int sum = std::accumulate(numbers.begin(), numbers.end(), 0);
    std::cout << "Sum of vector: " << sum << std::endl;
    return 0;
}
`,
};

export const RoomPage: React.FC = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<RoomRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [code, setCode] = useState<string>(STARTER_CODE.python);
  const [consoleOutput, setConsoleOutput] = useState<string>(
    `[LiveCode Terminal Ready]\nWorkspace initialized for room.\nSelect language, edit code, and click 'Run'.`
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!shortId) return;

    const fetchRoom = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await roomApi.getRoom(shortId);
        setRoom(res.data.room);
        setRole(res.data.role);

        if (res.data.room.language && STARTER_CODE[res.data.room.language]) {
          setLanguage(res.data.room.language);
          setCode(STARTER_CODE[res.data.room.language]);
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Room not found or access denied';
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [shortId]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setCode(STARTER_CODE[newLang]);
    setConsoleOutput(`[Switched to ${newLang.toUpperCase()}]\nEditor buffer reloaded with ${newLang} template.`);
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setConsoleOutput(
      `[Runner] Dispatching job for ${language.toUpperCase()}...\nPlanned docker sandbox limits:\n  --network=none --memory=128m --cpus=0.5 --pids-limit=64 --timeout=5s\n\n[Status] Simulated execution success:\nHello, World from ${language.toUpperCase()}!\nExecution time: 42ms | Exit Code: 0`
    );
    setTimeout(() => {
      setIsRunning(false);
    }, 400);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-300">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
        <span className="text-xs font-mono text-gray-400">Loading collaborative room {shortId}...</span>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818] text-[#cccccc] p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-gray-100">Room Unavailable</h2>
        <p className="text-xs text-gray-400 max-w-sm mt-1 mb-6">
          {error || `Room "${shortId}" could not be found or you do not have permission to access it.`}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <EditorHeader
        room={room}
        role={role}
        language={language}
        onLanguageChange={handleLanguageChange}
        onRunCode={handleRunCode}
        isRunning={isRunning}
        onBackToDashboard={() => navigate('/dashboard')}
      />

      {/* Main Workspace (Editor + Output Console) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor Area */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            language={language}
            code={code}
            onChange={(val) => setCode(val || '')}
          />
        </div>

        {/* Bottom Output Console Panel */}
        <div className="h-44 bg-[#181818] border-t border-[#3c3c3c] flex flex-col">
          <div className="h-7 bg-[#252526] px-3 flex items-center justify-between border-b border-[#3c3c3c] text-xs select-none">
            <div className="flex items-center space-x-2 text-gray-300">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-[11px] uppercase tracking-wider">Console Output</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span>Runner Service: Connected (Stub)</span>
            </div>
          </div>
          <div className="flex-1 p-3 font-mono text-xs text-gray-300 overflow-y-auto whitespace-pre-wrap selection:bg-sky-900 leading-relaxed">
            {consoleOutput}
          </div>
        </div>
      </div>
    </div>
  );
};
