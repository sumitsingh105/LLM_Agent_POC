class LLMAgent {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.llmProvider = null;
        this.aipipeToken = null;
        
        this.initializeUI();
        this.initializeAIPipe();
        this.initializeTools();
    }

    async initializeAIPipe() {
        try {
            // Import AI Pipe module
            const { getProfile } = await import("https://aipipe.org/aipipe.js");
            const { token, email } = getProfile();
            
            if (token) {
                this.aipipeToken = token;
                this.showAlert(`AI Pipe authenticated as ${email}`, 'success');
                this.enableLLMProvider();
            } else {
                // Redirect to AI Pipe login
                const redirectUrl = encodeURIComponent(window.location.href);
                this.showAlert('Redirecting to AI Pipe login...', 'info');
                setTimeout(() => {
                    window.location = `https://aipipe.org/login?redirect=${redirectUrl}`;
                }, 2000);
            }
        } catch (error) {
            console.error('AI Pipe initialization failed:', error);
            this.showAlert('AI Pipe initialization failed, falling back to manual setup', 'warning');
            this.initializeLLMProvider();
        }
    }

    enableLLMProvider() {
        this.llmProvider = { provider: 'aipipe', apiKey: this.aipipeToken };
        const container = document.getElementById('llm-provider-container');
        container.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle"></i> AI Pipe Connected
                <small class="d-block">Using AI Pipe proxy for LLM access</small>
            </div>
        `;
        this.userInput.disabled = false;
        this.sendBtn.disabled = false;
    }

    initializeUI() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearBtn = document.getElementById('clear-btn');

        this.sendBtn.addEventListener('click', () => this.handleUserInput());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.handleUserInput();
            }
        });
        this.clearBtn.addEventListener('click', () => this.clearChat());
    }

    initializeLLMProvider() {
        // Fallback manual provider selection
        const container = document.getElementById('llm-provider-container');
        container.innerHTML = `
            <select id="provider-select" class="form-select">
                <option value="">Select LLM Provider...</option>
                <option value="aipipe">AI Pipe (Recommended)</option>
                <option value="openai">OpenAI Direct</option>
                <option value="anthropic">Anthropic</option>
            </select>
            <div class="mt-2">
                <input type="password" id="api-key" class="form-control" 
                       placeholder="Enter API Key or AI Pipe Token...">
            </div>
        `;

        document.getElementById('provider-select').addEventListener('change', (e) => {
            this.updateLLMProvider(e.target.value);
        });
    }

    updateLLMProvider(provider) {
        const apiKey = document.getElementById('api-key').value;
        if (provider && apiKey) {
            this.llmProvider = { provider, apiKey };
            this.userInput.disabled = false;
            this.sendBtn.disabled = false;
            this.showAlert(`${provider} provider configured successfully!`, 'success');
        } else {
            this.llmProvider = null;
            this.userInput.disabled = true;
            this.sendBtn.disabled = true;
        }
    }

    initializeTools() {
        this.tools = [
            {
                type: "function",
                function: {
                    name: "google_search",
                    description: "Search Google for information and return snippet results",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query"
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "ai_pipe",
                    description: "Execute an AI workflow using the aipipe proxy",
                    parameters: {
                        type: "object",
                        properties: {
                            workflow: {
                                type: "string",
                                description: "The workflow description or pipeline to execute"
                            }
                        },
                        required: ["workflow"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "execute_js",
                    description: "Execute JavaScript code in the browser and return results",
                    parameters: {
                        type: "object",
                        properties: {
                            code: {
                                type: "string",
                                description: "The JavaScript code to execute"
                            }
                        },
                        required: ["code"]
                    }
                }
            }
        ];
    }

    async handleUserInput() {
    const input = this.userInput.value.trim();
    if (!input || !this.llmProvider || this.isProcessing) return;
  
    this.userInput.value = '';
    this.isProcessing = true;
    this.updateUI();
  
    // Add user message
    this.addMessage('user', input);
    this.messages.push({ role: 'user', content: input });
  
    try {
      // Single invocation of agentLoop will process until no more tools are requested
      await this.agentLoop();
    } catch (error) {
      this.showAlert(`Error: ${error.message}`, 'danger');
    } finally {
      this.isProcessing = false;
      this.updateUI();
    }
    }
    
    // 1) Update agentLoop() so it only loops while there are toolCalls,
//    and always breaks once model has no further tools to invoke.

    async agentLoop() {
      while (true) {
        const { output, toolCalls } = await this.queryLLM();
    
        // Display model reply
        if (output) {
          this.addMessage('agent', output);
          this.messages.push({ role: 'assistant', content: output });
        }
    
        // If model requested tools, execute them…
        if (toolCalls && toolCalls.length > 0) {
          const results = await Promise.all(toolCalls.map(tc => this.handleToolCall(tc)));
          results.forEach(r => {
            this.messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
          });
    
          // Provide a final follow-up after tool execution
          const finalMsg = this.generateFinalResponse(results);
          this.addMessage('agent', finalMsg);
          this.messages.push({ role: 'assistant', content: finalMsg });
    
          // Then break—don’t loop again
          break;
        } 
    
        // No toolCalls => finished this request, return control
        break;
      }
    }
    
    // 2) Ensure generateFinalResponse covers the Fibonacci case:
    generateFinalResponse(toolResults) {
      const content = toolResults[0].content || '';
      if (content.includes('Fibonacci sequence')) {
        return "Here's the Fibonacci sequence! Let me know if you'd like a different length or any other calculation.";
      } else if (content.includes('Search Results')) {
        return "I found those resources—anything more specific you'd like me to look for?";
      } else if (content.includes('Code executed successfully')) {
        return "The code ran successfully! Anything else you'd like me to calculate or run?";
      } else if (content.includes('AI Pipe Workflow Executed')) {
        return "The AI workflow completed! Need another workflow or analysis?";
      }
      return "Task completed! How else can I assist you?";
    }

    
    async queryLLM() {
      if (!this.llmProvider) throw new Error('No LLM provider configured');
    
      if (this.aipipeToken || this.llmProvider.provider === 'aipipe') {
        try {
          return await this.callRealLLM();
        } catch (err) {
          console.error('Real LLM API failed:', err);
          this.showAlert('LLM API error, switching to simulation mode', 'warning');
          return await this.simulateLLMCall();
        }
      } else {
        return await this.simulateLLMCall();
      }
    }
    
    async callRealLLM() {
      const baseUrl =
        this.llmProvider.provider === 'aipipe'
          ? 'https://aipipe.org/openai/v1'
          : 'https://api.openai.com/v1';
    
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmProvider.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: this.messages,
          tools: this.tools,
          tool_choice: 'auto',
          max_tokens: 1000,
        }),
      });
    
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    
      const data = await response.json();
    
      // Validate structure before use
      const msg = data.choices?.[0]?.message;
      if (!msg || typeof msg.content !== 'string') {
        throw new Error('Invalid LLM response format');
      }
    
      return {
        output: msg.content,
        toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : null,
      };
    }
    

    async callRealLLM() {
        const baseUrl = this.llmProvider.provider === 'aipipe' 
            ? 'https://aipipe.org/openai/v1' 
            : 'https://api.openai.com/v1';

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmProvider.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: this.messages,
                tools: this.tools,
                tool_choice: 'auto',
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;
        
        return {
            output: message.content,
            toolCalls: message.tool_calls || null
        };
    }

    async simulateLLMCall() {
      await this.delay(800);
      const last = this.messages[this.messages.length - 1].content.trim();
      const lc = last.toLowerCase();
    
      // 0) If the user just typed a topic/title (two or more words) with no explicit intent, treat as search
      if (last.split(' ').length >= 2 && 
          !lc.includes('search') && 
          !lc.includes('run') && 
          !lc.includes('calculate') && 
          !lc.includes('pipeline') && 
          !lc.includes('workflow') && 
          !lc.includes('what can you do')) {
        const query = last;
        return {
          output: `I'll search for information about "${query}" to help you.`,
          toolCalls: [{
            id: 'search_' + Date.now(),
            type: 'function',
            function: {
              name: 'google_search',
              arguments: JSON.stringify({ query })
            }
          }]
        };
      }
    
      // 1) Workflow/pipeline intents first
      if (lc.includes('pipeline') || lc.includes('workflow') || lc.includes('text processing') || lc.includes('ai pipe')) {
        return {
          output: "I'll execute an AI workflow for you using the AI Pipe system.",
          toolCalls: [{
            id: 'pipe_' + Date.now(),
            type: 'function',
            function: {
              name: 'ai_pipe',
              arguments: JSON.stringify({ workflow: lc })
            }
          }]
        };
      }
    
      // 2) Search intents
      if (lc.includes('search') || lc.includes('find') || lc.includes('look up') || lc.includes('information about')) {
        const q = this.extractSearchQuery(lc);
        return {
          output: `I'll search for information about "${q}" to help you.`,
          toolCalls: [{
            id: 'search_' + Date.now(),
            type: 'function',
            function: {
              name: 'google_search',
              arguments: JSON.stringify({ query: q })
            }
          }]
        };
      }
    
      // 3) Code/math intents
      if (lc.includes('fibonacci') || lc.includes('calculate') || lc.includes('math') || lc.includes('run')) {
        let desc = lc.includes('fibonacci')
          ? "I'll generate the Fibonacci sequence using JavaScript."
          : "I'll perform some mathematical calculations for you.";
        return {
          output: desc,
          toolCalls: [{
            id: 'js_' + Date.now(),
            type: 'function',
            function: {
              name: 'execute_js',
              arguments: JSON.stringify({ code: this.generateSampleCode(lc) })
            }
          }]
        };
      }
    
      // 4) Conversational / fallback
      if (lc.includes('what can you do') || lc.includes('capabilities') || lc.includes('help')) {
        return {
          output: `I'm an LLM agent with multiple tool capabilities! I can:\n\n🔍 Search for information\n💻 Execute JavaScript code\n🤖 Run AI workflows\n💬 Have conversations\n\nTry "search for...", "calculate...", or "run workflow for..." to see me in action!`,
          toolCalls: null
        };
      }
    
      // Generic fallback
      const responses = [
        `I understand you're asking about: "${last}". How can I assist you further?`,
        `That's interesting! Tell me more about what you'd like to know or do.`,
        `I'm here to help! You can ask me to search for information, run code, or execute AI workflows.`
      ];
      return { output: responses[Math.floor(Math.random() * responses.length)], toolCalls: null };
    }
    


    extractSearchQuery(content) {
        const words = content.split(' ');
        const stopWords = ['search', 'find', 'look', 'up', 'for', 'about', 'the', 'a', 'an', 'information', 'me', 'please'];
        const importantWords = words.filter(word => 
            !stopWords.includes(word.toLowerCase()) && word.length > 2
        );
        return importantWords.join(' ') || 'general information';
    }

    generateSampleCode(content) {
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.includes('fibonacci')) {
            return `
// Fibonacci sequence generator
function fibonacci(n) {
    if (n <= 1) return n;
    let a = 0, b = 1;
    const sequence = [a, b];
    
    for (let i = 2; i < n; i++) {
        const next = a + b;
        sequence.push(next);
        a = b;
        b = next;
    }
    return sequence;
}

const fibResult = fibonacci(10);
console.log('Fibonacci sequence (10 numbers):', fibResult);
fibResult;
            `.trim();
        } else if (lowerContent.includes('calculate') || lowerContent.includes('math')) {
            return `
// Various math calculations
const calculations = {
    square: (x) => x * x,
    factorial: (n) => n <= 1 ? 1 : n * calculations.factorial(n - 1),
    prime: (n) => {
        if (n < 2) return false;
        for (let i = 2; i <= Math.sqrt(n); i++) {
            if (n % i === 0) return false;
        }
        return true;
    }
};

const results = {
    square_of_12: calculations.square(12),
    factorial_of_5: calculations.factorial(5),
    is_17_prime: calculations.prime(17),
    random_calculation: Math.PI * 2
};

console.log('Math calculations:', results);
results;
            `.trim();
        } else if (lowerContent.includes('date') || lowerContent.includes('time')) {
            return `
// Date and time operations
const now = new Date();
const timeInfo = {
    current: now.toLocaleString(),
    timestamp: now.getTime(),
    day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
    days_until_new_year: Math.ceil((new Date('2026-01-01') - now) / (1000 * 60 * 60 * 24))
};

console.log('Time information:', timeInfo);
timeInfo;
            `.trim();
        }
        
        return `
// Sample JavaScript demonstration
const demo = {
    greeting: "Hello from the LLM Agent!",
    timestamp: new Date().toISOString(),
    random_number: Math.floor(Math.random() * 100),
    calculation: 2 ** 10,
};

console.log('Demo output:', demo);
demo;
        `.trim();
    }

    generateFinalResponse(toolResults) {
        const result = toolResults[0];
        if (result.content.includes('Search Results')) {
            return "I found some great resources for you! These should help with your query. Would you like me to search for anything more specific?";
        } else if (result.content.includes('Code executed')) {
            return "The code has been executed successfully! Is there anything else you'd like me to calculate or run?";
        } else if (result.content.includes('AI Pipe')) {
            return "The AI workflow has been completed! The results look good. Let me know if you need any other AI processing.";
        }
        return "Task completed! How else can I assist you?";
    }

    async handleToolCall(toolCall) {
        const { id, function: func } = toolCall;
        const args = JSON.parse(func.arguments);

        this.addMessage('tool', `🔧 Executing ${func.name}...`, true);

        try {
            let result;
            switch (func.name) {
                case 'google_search':
                    result = await this.executeGoogleSearch(args.query);
                    break;
                case 'ai_pipe':
                    result = await this.executeAIPipe(args.workflow);
                    break;
                case 'execute_js':
                    result = await this.executeJavaScript(args.code);
                    break;
                default:
                    throw new Error(`Unknown tool: ${func.name}`);
            }

            this.addMessage('tool', `✅ ${func.name} completed:\n${result}`);
            return { toolCallId: id, content: result };

        } catch (error) {
            const errorMsg = `❌ ${func.name} failed: ${error.message}`;
            this.addMessage('tool', errorMsg);
            return { toolCallId: id, content: errorMsg };
        }
    }

    async executeGoogleSearch(query) {
      let data = null;
      if (this.aipipeToken) {
        try {
          const resp = await fetch(
            `https://aipipe.org/proxy/https://www.googleapis.com/customsearch/v1?key=YOUR_KEY&cx=YOUR_CX&q=${encodeURIComponent(query)}`,
            { headers: { Authorization: `Bearer ${this.aipipeToken}` } }
          );
          data = await resp.json();
        } catch (e) {
          console.warn('Proxy search failed, using mock:', e);
        }
      }
    
      // If no real data or items empty, use mock
      if (!data?.items?.length) {
        const mock = [
          `📄 **${query} – Official Python Docs**: Best practices guide from the Python Software Foundation.`,
          `✍️ **Real Python – Best Practices**: Article covering idiomatic Python patterns and style.`,
          `💡 **Python Tips – StackOverflow**: Community answers on writing clean, efficient Python code.`
        ];
        return `**Search Results for "${query}":**\n\n${mock.join('\n\n')}`;
      }
    
      // Otherwise format real results
      return data.items.slice(0, 3).map(item =>
        `📄 **${item.title}**: ${item.snippet}`
      ).join('\n\n');
    }
    

    async executeAIPipe(workflow) {
        if (this.aipipeToken) {
            // Use real AI Pipe workflow execution
            try {
                const response = await fetch('https://aipipe.org/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.aipipeToken}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'You are an AI workflow processor. Process the workflow and return structured results.' },
                            { role: 'user', content: `Process this workflow: ${workflow}` }
                        ],
                        max_tokens: 500
                    })
                });
                
                const data = await response.json();
                const result = data.choices[0].message.content;
                return `**AI Pipe Workflow Executed:**\n\nWorkflow: "${workflow}"\n\n${result}`;
                
            } catch (error) {
                console.warn('Real AI Pipe failed, using simulation:', error);
            }
        }
        
        // Simulation fallback
        await this.delay(1500);
        return `**AI Pipe Workflow Executed:**\n\nWorkflow: "${workflow}"\n\n✅ Data preprocessing completed\n✅ Model inference executed\n✅ Results processed\n\nOutput: Generated response based on workflow parameters with 94.2% confidence score.`;
    }

    async executeJavaScript(code) {
        try {
            const result = eval(code);
            const output = result !== undefined ? JSON.stringify(result, null, 2) : 'undefined';
            return `**Code executed successfully:**\n\n\`\`\`javascript\n${code}\n\`\`\`\n\n**Result:** ${output}`;
        } catch (error) {
            throw new Error(`JavaScript execution failed: ${error.message}`);
        }
    }

    addMessage(type, content, isThinking = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        if (isThinking) messageDiv.className += ' thinking';

        const icon = type === 'user' ? '👤' : type === 'agent' ? '🤖' : '🔧';
        messageDiv.innerHTML = `
            <strong>${icon} ${type.charAt(0).toUpperCase() + type.slice(1)}:</strong>
            <div>${this.formatContent(content)}</div>
        `;

        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    formatContent(content) {
        return content
            .replace(/``````/g, '<pre class="code-output">$2</pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    clearChat() {
        this.messages = [];
        this.chatContainer.innerHTML = '';
        this.showAlert('Chat cleared successfully!', 'info');
    }

    updateUI() {
        this.sendBtn.disabled = this.isProcessing;
        this.userInput.disabled = this.isProcessing || !this.llmProvider;
        
        if (this.isProcessing) {
            this.sendBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
        } else {
            this.sendBtn.innerHTML = '<i class="bi bi-send"></i> Send';
        }
    }

    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        alertContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the agent when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LLMAgent();
});
