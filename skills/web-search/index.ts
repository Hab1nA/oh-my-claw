import axios from 'axios';
import type { SkillModule } from '../../src/types/skill.js';

const SEARCH_API_KEY = process.env.SEARCH_API_KEY ?? '';
const SEARCH_API_URL = process.env.SEARCH_API_URL ?? 'https://api.duckduckgo.com';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

const webSearchSkill: SkillModule = {
  name: 'web-search',
  version: '1.0.0',

  tools: {
    web_search: {
      name: 'web_search',
      description: 'Search the web and return relevant results',
      category: 'information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          },
          num_results: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            default: 5
          }
        },
        required: ['query']
      },
      handler: async (params) => {
        const { query, num_results = 5 } = params as { query: string; num_results?: number };

        try {
          const headers: Record<string, string> = {};
          if (SEARCH_API_KEY) {
            headers['Authorization'] = `Bearer ${SEARCH_API_KEY}`;
          }

          const response = await axios.get(SEARCH_API_URL, {
            params: {
              q: query,
              format: 'json',
              no_html: 1,
              skip_disambig: 1
            },
            headers,
            timeout: 15000
          });

          const data = response.data;
          const results: SearchResult[] = [];

          if (data.AbstractText) {
            results.push({
              title: 'Direct Answer',
              snippet: data.AbstractText,
              url: data.AbstractURL ?? ''
            });
          }

          if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics) {
              if (results.length >= num_results) break;
              
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0] ?? topic.Text,
                  snippet: topic.Text,
                  url: topic.FirstURL
                });
              }
            }
          }

          if (results.length === 0) {
            return {
              success: true,
              output: `No results found for "${query}"`
            };
          }

          const formattedResults = results
            .slice(0, num_results)
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`)
            .join('\n\n');

          return {
            success: true,
            output: `Search results for "${query}":\n\n${formattedResults}`,
            metadata: {
              query,
              resultCount: results.length
            }
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            return {
              success: false,
              error: `Search API error: ${error.message}`
            };
          }
          return {
            success: false,
            error: `Failed to search: ${(error as Error).message}`
          };
        }
      }
    }
  },

  triggers: [
    {
      type: 'keyword',
      keywords: ['search', '查找', '搜索', 'look up', 'find', 'google']
    }
  ]
};

export default webSearchSkill;
