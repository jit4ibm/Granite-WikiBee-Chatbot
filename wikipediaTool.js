import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";
import { SimilarityTool } from "bee-agent-framework/tools/similarity";
import { OllamaLLM } from "bee-agent-framework/adapters/ollama/llm";
import { cosineSimilarityMatrix } from "bee-agent-framework/internals/helpers/math";
import { splitString } from "bee-agent-framework/internals/helpers/string";
import { z } from "zod";

export function createWikipediaRetrievalTool(passageSize, overlap, maxResults) {
  const embeddingLLM = new OllamaLLM({
    modelId: "nomic-embed-text",
  });

  const charsPerToken = 4;
  
  const similarity = new SimilarityTool({
    maxResults: maxResults,
    provider: async (input) => {
      const embeds = await embeddingLLM.embed([
        input.query,
        ...input.documents.map((doc) => doc.text),
      ]);
      const similarities = cosineSimilarityMatrix(
        [embeds.embeddings[0]],
        embeds.embeddings.slice(1)
      )[0];
      if (!similarities) {
        throw new Error("Missing similarities");
      }
      return similarities.map((score) => ({ score }));
    },
  });

  const wikipedia = new WikipediaTool();

  return wikipedia
    .extend(
      z.object({
        page: z
          .string()
          .describe("The Wikipedia page to search, e.g., 'New York'. This field is required.")
          .min(1)
          .max(128),
        query: z
          .string()
          .describe(
            "A specific search query to lookup within the Wikipedia page. Use a descriptive phrase or sentence. This field is required."
          ),
      }),
      (newInput) => ({ query: newInput.page })
    )
    .pipe(similarity, (input, output) => ({
      query: input.query,
      documents: output.results.flatMap((document) =>
        Array.from(
          splitString(document.fields.markdown, {
            size: passageSize * charsPerToken,
            overlap: overlap * charsPerToken,
          })
        ).map((chunk) => ({
          text: chunk,
        }))
      ),
    }));
}

export function wikipediaRetrivalTool(maxResults, timeout, retries = 3) {
  return {
    name: "wikipedia-retrieval",
    description: "Retrieve information from Wikipedia",
    execute: async (query) => {
      let attempt = 0;
      let response;

      // Define the list of words to remove (case-insensitive)
      const removeKeywords = ["summary", "short", "quick", "overview"];
      const unwantedWords = ["of", "the"]; // Additional words to remove, like "of", "the"
      const regex = new RegExp(`\\b(${[...removeKeywords, ...unwantedWords].join("|")})\\b`, "gi");

      while (attempt < retries) {
        try {
          // Trim the query and remove unwanted keywords
          let pageQuery = query.trim().replace(regex, "").trim(); // Remove keywords and trim again

          // Remove extra spaces between words that might have been caused by word removal
          pageQuery = pageQuery.replace(/\s+/g, " ").trim(); // Ensure single spaces between words

          // Log the page name being queried for debugging purposes
          console.log(`Requesting Wikipedia URL: https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageQuery)}`);
          
          // Construct the correct URL
          const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageQuery)}`;

          // Make the request
          response = await fetch(url, { timeout });

          if (!response.ok) {
            console.error(`Wikipedia retrieval failed: ${response.statusText}`);
            throw new Error(`Wikipedia retrieval failed: ${response.statusText}`);
          }

          const data = await response.json();
          return data.extract;
        } catch (err) {
          attempt++;
          console.error(`Attempt ${attempt} failed: ${err.message}`);
          if (attempt >= retries) {
            throw new Error(`Failed after ${retries} attempts: ${err.message}`);
          }
        }
      }
    },
    parameters: { maxResults, retries },
  };
}