// Starter code templates per supported language
export const STARTER_CODE: Record<string, string> = {
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
