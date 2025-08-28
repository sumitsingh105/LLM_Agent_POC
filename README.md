# LLM Agent POC: Browser-Based Multi-Tool Reasoning

## Overview
A minimal JavaScript-based LLM agent that combines LLM output with external tools including web search, AI workflows, and live code execution.

## Features
- ✅ Browser-based chat interface
- ✅ AI Pipe integration with auto-authentication  
- ✅ Google Search API (with simulation fallback)
- ✅ JavaScript code execution sandbox
- ✅ AI Pipe workflow processing
- ✅ OpenAI-style tool calling interface
- ✅ Bootstrap UI with error handling

## Demo Instructions
1. Open `index.html` in a web browser
2. The app will attempt AI Pipe auto-login (or use manual provider selection)
3. Try these commands:
   - "Python best practices" (triggers search)
   - "Calculate fibonacci sequence" (triggers code execution)
   - "Run workflow for sentiment analysis" (triggers AI Pipe)

## Architecture
- **Core Loop**: Mirrors provided Python logic in JavaScript
- **Tool Integration**: Three working tools with OpenAI function calling
- **Fallback System**: Simulation mode ensures demo reliability
- **Error Handling**: Bootstrap alerts for graceful error display

## Files
- `index.html` - Main application interface
- `agent.js` - Complete agent implementation
