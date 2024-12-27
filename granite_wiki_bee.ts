import express from "express";
import cors from "cors";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { OllamaChatLLM } from "bee-agent-framework/adapters/ollama/chat";
import { createWikipediaRetrievalTool } from "./wikipediaTool"; // Ensure this path is correct

// Load environment variables from .env
import "dotenv/config";

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for the frontend

// Initialize the LLM and agent
const llm = new OllamaChatLLM({
  modelId: "granite3.1-dense:8b",
  parameters: {
    temperature: 0,
    num_predict: 2048,
  },
});

const agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [createWikipediaRetrievalTool(400, 50, 3)],
});

// API endpoint for the chatbot
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid input. 'prompt' is required and must be a string." });
  }

  try {
    const response = await agent.run(
      { prompt },
      {
        execution: {
          maxIterations: 8,
          maxRetriesPerStep: 3,
          totalMaxRetries: 3,
        },
      }
    );
    res.json({ reply: response.result.text });
  } catch (error) {
    console.error("Error in agent processing:", error);
    res.status(500).json({ error: "Agent encountered an error while processing your request." });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});