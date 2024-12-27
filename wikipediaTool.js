import { WikipediaTool } from "bee-agent-framework/dist/tools/search/wikipedia";
import { SimilarityTool } from "bee-agent-framework/dist/tools/similarity";
import { OllamaLLM } from "bee-agent-framework/adapters/ollama/llm";
import { cosineSimilarityMatrix } from "bee-agent-framework/internals/helpers/math";
import { splitString } from "bee-agent-framework/internals/helpers/string";
import { z } from "zod";
//import { wiki } from './helpers/wikipediaTool.js';

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
          .describe("The Wikipedia page to search e.g 'New York'. This field is required.")
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