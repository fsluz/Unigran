import 'dotenv/config';
import path from 'path';

export const config = {
  port: Number(process.env.PORT || 3010),
  clientUrl: process.env.CLIENT_URL || true,
  typedb: {
    address: process.env.TYPEDB_ADDRESS || 'http://localhost:1729',
    database: process.env.TYPEDB_DATABASE || 'unigran_db',
    username: process.env.TYPEDB_USERNAME || 'admin',
    password: process.env.TYPEDB_PASSWORD || 'password',
  },
  infoBasePath: process.env.RAI_INFO_BASE_PATH
    ? path.resolve(process.cwd(), process.env.RAI_INFO_BASE_PATH)
    : path.resolve(process.cwd(), '../BASE DE INFORMAÇÃO'),
  llm: {
    apiKey: process.env.RAI_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    endpoint: process.env.RAI_LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    model: process.env.RAI_LLM_MODEL || 'gpt-4o-mini',
  },
};

