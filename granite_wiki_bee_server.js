import { createWikipediaRetrievalTool, wikipediaRetrivalTool } from "./helpers/wikipediaTool.js";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { OllamaChatLLM } from "bee-agent-framework/adapters/ollama/chat";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); // Enable cross-origin requests

// Initialize the Wikipedia tools
const advancedWikipediaTool = createWikipediaRetrievalTool(400, 50, 3);
const basicWikipediaTool = wikipediaRetrivalTool(3, 5000, 2);

// Initialize LLM and agent for advanced Wikipedia tool
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
  tools: [advancedWikipediaTool],
});

// Helper function to determine tool type
function isBasicPrompt(prompt) {
  const basicKeywords = ["summary", "short", "quick"]; // Define basic keywords
  return basicKeywords.some((keyword) => prompt.toLowerCase().includes(keyword));
}

// Unified API endpoint for Wikipedia retrieval
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid input. 'prompt' is required and must be a string." });
  }

  try {
    if (isBasicPrompt(prompt)) {
      // Use the basic tool
      const result = await basicWikipediaTool.execute(prompt);
      return res.json({ reply: result });
    } else {
      // Use the advanced tool with the agent
      const response = await agent.run(
        { prompt },
        {
          execution: {
            maxIterations: 8,
            maxRetriesPerStep: 3,
            totalMaxRetries: 3,
          }
        }
      );
      return res.json({ reply: response.result.text });
    }
  } catch (error) {
    console.error("Error in processing:", error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});