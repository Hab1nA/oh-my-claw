import axios from 'axios';
import type { SkillModule } from '../../src/types/skill.js';

const WEATHER_API_KEY = process.env.WEATHER_API_KEY ?? '';

const weatherSkill: SkillModule = {
  name: 'weather',
  version: '1.0.0',

  tools: {
    get_weather: {
      name: 'get_weather',
      description: 'Get current weather information for a specified city',
      category: 'information',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The name of the city to get weather for (e.g., "Beijing", "New York")'
          },
          units: {
            type: 'string',
            description: 'Temperature units: metric (Celsius), imperial (Fahrenheit), or kelvin',
            enum: ['metric', 'imperial', 'kelvin'],
            default: 'metric'
          }
        },
        required: ['city']
      },
      handler: async (params) => {
        const { city, units = 'metric' } = params as { city: string; units?: string };

        if (!WEATHER_API_KEY) {
          return {
            success: false,
            error: 'Weather API key not configured. Set WEATHER_API_KEY environment variable.'
          };
        }

        try {
          const response = await axios.get(
            'https://api.openweathermap.org/data/2.5/weather',
            {
              params: {
                q: city,
                units,
                appid: WEATHER_API_KEY
              },
              timeout: 10000
            }
          );

          const data = response.data;
          const tempUnit = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K';

          const output = `Weather in ${data.name}:\n` +
            `Condition: ${data.weather[0].description}\n` +
            `Temperature: ${data.main.temp}${tempUnit}\n` +
            `Feels like: ${data.main.feels_like}${tempUnit}\n` +
            `Humidity: ${data.main.humidity}%\n` +
            `Wind: ${data.wind.speed} m/s`;

          return {
            success: true,
            output,
            metadata: {
              city: data.name,
              temp: data.main.temp,
              humidity: data.main.humidity,
              condition: data.weather[0].main
            }
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
              return {
                success: false,
                error: `City not found: ${city}`
              };
            }
            return {
              success: false,
              error: `Weather API error: ${error.message}`
            };
          }
          return {
            success: false,
            error: `Failed to get weather: ${(error as Error).message}`
          };
        }
      }
    }
  },

  triggers: [
    {
      type: 'keyword',
      keywords: ['weather', '温度', '天气', 'forecast', '气温']
    }
  ]
};

export default weatherSkill;
