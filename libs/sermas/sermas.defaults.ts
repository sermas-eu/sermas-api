import { getConfigPath } from './sermas.utils';

export const SermasDefaultConfig = {
  // IMPORT_USER default user used when importing apps
  IMPORT_USER: 'admin',
  // API_URL public API url
  API_URL: 'http://localhost:8080',
  // API_URL_INTERNAL Internal API url
  API_URL_INTERNAL: 'http://127.0.0.1:3000/api',

  // MONGODB_URI mongodb connection url
  MONGODB_URI: 'mongodb://mongodb:27017/sermas',

  // AUTH_KEYCLOAK_URL set the keycloack endpoint URL
  AUTH_KEYCLOAK_URL: 'http://172.17.0.1:8080/keycloak',
  // AUTH_KEYCLOAK_REALM set the keycloack realm
  AUTH_KEYCLOAK_REALM: 'sermas-local',
  // AUTH_KEYCLOAK_CLIENT_ID set the keycloack client ID used for administrative purposes
  AUTH_KEYCLOAK_CLIENT_ID: 'platform',
  // AUTH_KEYCLOAK_SECRET set the keycloack client password used for administrative purposes
  AUTH_KEYCLOAK_SECRET: 'platform',
  // ADMIN_SERVICE_ACCOUNT_USERNAME set the keycloack admin user
  ADMIN_SERVICE_ACCOUNT_USERNAME: 'admin',
  // ADMIN_SERVICE_ACCOUNT_PASSWORD set the keycloack admin password
  ADMIN_SERVICE_ACCOUNT_PASSWORD: 'admin',
  // AUTH_KEYCLOAK_ADMIN_CLIENT_ID set the admin client used for keycloak configuration
  AUTH_KEYCLOAK_ADMIN_CLIENT_ID: 'admin-cli',
  // AUTH_KEYCLOAK_ADMIN_REALM set the admin realm used for keycloak configuration
  AUTH_KEYCLOAK_ADMIN_REALM: 'master',
  // AUTH_KEYCLOAK_SYSTEM_CLIENT_ID Additonal system clients, separated by comma
  AUTH_KEYCLOAK_SYSTEM_CLIENT_ID: '',

  // MQTT_URL the mqtt service url
  MQTT_URL: 'mqtt',

  // REDIS_URL the redis service url, used for caching
  REDIS_URL: 'redis://redis:6379',
  // CACHE_TTL_SEC default cache time to live
  CACHE_TTL_SEC: 24 * 60 * 60,

  // MINIO_URL Url to Minio service or S3 compatible system
  MINIO_URL: 'http://minio:9000',
  // MINIO_ACCESSKEY Minio Access key
  MINIO_ACCESSKEY: 'minioadmin',
  // MINIO_SECRETKEY Minio Secret key
  MINIO_SECRETKEY: 'minioadmin',
  // REPOSITORY_BUCKET Minio bucket
  REPOSITORY_BUCKET: 'sermas-repository',
  // REPOSITORY_BUCKET_REGION Minio region
  REPOSITORY_BUCKET_REGION: '',

  // SPEECHBRAIN_URL Url to the speechbrain service (for audio detection)
  SPEECHBRAIN_URL: 'http://speechbrain',

  // FORCE_LANGUAGE default language to use if not provided, it will be used to translate messages or select a TTS model
  FORCE_LANGUAGE: 'en-GB',

  // IMPORT_USERS_FILENAME path to the users.json file
  IMPORT_USERS_FILENAME: `${getConfigPath()}/users.json`,
  // ADMIN_USER default admin username

  ADMIN_USER: `admin`,
  // ADMIN_PASSWORD default admin password
  ADMIN_PASSWORD: `admin`,

  // ASYNCAPI_PUBLIC_URL public URL path to mqtt over websocket
  ASYNCAPI_PUBLIC_URL: '/mqtt',
  // OPENAPI_PUBLIC_URL default path to the open api endpoint
  OPENAPI_PUBLIC_URL: `/`,

  // MODULES_IMPORT_PATH path to the modules.json file
  MODULES_IMPORT_PATH: `${getConfigPath()}/modules.json`,

  // WAKE_WORDS wake words for the avatar
  WAKE_WORDS: 'Hello,Hi,Good morning,Ciao',

  // CHROMA_URL Url to chroma DB
  CHROMA_URL: 'http://chromadb:8000',

  // DEFAULT_MODEL_PATH Minio based path to the default avatar glb model
  DEFAULT_MODEL_PATH: 'default/avatars/default/654cc759f1a79ed2ebab0207.glb',
  // DEFAULT_BACKGROUND_PATH Minio based path to the default background for the kiosk
  DEFAULT_BACKGROUND_PATH:
    'default/backgrounds/default/milad-fakurian-nY14Fs8pxT8-unsplash.jpg',

  // TRANSLATION_SERVICE Provider name to translate messages
  TRANSLATION_SERVICE: 'openai',
  // STT_SERVICE Service for Speech to Text. Provided are openai, google, whisper, azure. Each need it's own setup.
  STT_SERVICE: 'openai',
  // STT_GOOGLE_IMPROVED_RECOGNITION List of short words that need better recognition when using GOOGLE as STT
  STT_GOOGLE_IMPROVED_RECOGNITION: 'si,no,ok,fatto,sì,yes,done,continue,wait',

  // STT_AZURE_KEY Azure subscription key
  STT_AZURE_KEY: '',
  // STT_AZURE_REGION Azure region
  STT_AZURE_REGION: '',

  // TTS_SERVICE Service for Text to Speech
  TTS_SERVICE: 'openai',

  // GOOGLE_TTS_MODEL_TYPE Preferred Google TTS model type (such as Neural, Wavenet or Standard). See https://cloud.google.com/text-to-speech/docs/voices
  GOOGLE_TTS_MODEL_TYPE: 'Neural',

  // TTS_AZURE_KEY Azure subscription key
  TTS_AZURE_KEY: '',
  // TTS_AZURE_REGION Azure region
  TTS_AZURE_REGION: '',

  // ELEVENIO_APIKEY Elevenio API key
  ELEVENIO_APIKEY: '',
  // ELEVENIO_VOICEIDS Elevenio voice id, separated by comma
  ELEVENIO_VOICEIDS: '',
  // ELEVENIO_MODELS Elevenio models
  ELEVENIO_MODELS: 'eleven_multilingual_v2',

  // LLM_SERVICE default LLM service to use (supported: openai, groq, ollama)
  LLM_SERVICE: 'openai',

  // LLM_SERVICE_CHAT LLM service to use for textual chat in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_CHAT: 'openai/gpt-4o',
  // LLM_SERVICE_TOOLS LLM service to use for tools matching  in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_TOOLS: 'openai/gpt-4o',
  // LLM_SERVICE_SENTIMENT LLM service to use for sentiment analysis  in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_SENTIMENT: 'openai/gpt-4o-mini',
  // LLM_SERVICE_TASKS LLM service to use for task management in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_TASKS: 'openai/gpt-4o-mini',
  // LLM_SERVICE_INTENT LLM service to use for intent detection in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_INTENT: 'openai/gpt-4o',
  // LLM_SERVICE_TRANSLATION LLM service to use for translation and rephrasing in format provider/model. If not provided will use LLM_SERVICE
  LLM_SERVICE_TRANSLATION: 'openai/gpt-4o-mini',

  // LLM_PRINT_PROMPT Print prompts to console for debug purposes
  LLM_PRINT_PROMPT: '0',
  // LLM_PRINT_RESPONSE Print LLM response to console for debug purposes
  LLM_PRINT_RESPONSE: '0',
  // LLM_EMBEDDINGS_SERVICE Embedding service to use
  LLM_EMBEDDINGS_SERVICE: 'openai',
  // LLM_EMBEDDINGS_BINARY_QUANTIZATION Enable binary quantization for embeddings
  LLM_EMBEDDINGS_BINARY_QUANTIZATION: '0',
  // OPENAI_API_KEY OpenAI api key
  OPENAI_API_KEY: '',
  // OPENAI_EMBEDDINGS_MODEL OpenAi Embedding model
  OPENAI_EMBEDDINGS_MODEL: 'text-embedding-3-small',
  // OPENAI_CHAT_MODELS Supported chat models from OpenAI. Leave empty to allow all available.
  OPENAI_CHAT_MODELS:
    'gpt-4o,gpt-4o-mini,gpt-4,gpt-4-turbo,gpt-3.5-turbo,gpt-3.5-turbo-16k,o1-preview,o1-mini',

  // OPENAI_MODEL Default OpenAI model used as fallback
  OPENAI_MODEL: 'gpt-4o',

  // OPENAI_TTS_MODEL OpenAI TTS model, one of tts-1 or tts-1-hd
  OPENAI_TTS_MODEL: 'tts-1',
  // OPENAI_TTS_VOICE_F Openai female TTS voice model
  OPENAI_TTS_VOICE_F: 'shimmer',
  // OPENAI_TTS_VOICE_M Openai male TTS voice model
  OPENAI_TTS_VOICE_M: 'onyx',

  // LITELLM_URL LiteLLM endpoint URL
  LITELLM_URL: 'http://litellm',

  // OLLAMA_URL Url to Ollama
  OLLAMA_URL: 'http://ollama:11434',
  // OLLAMA_MODEL Default Ollama model used as fallback
  OLLAMA_MODEL: 'sermas-llama3',
  // OLLAMA_CHAT_MODELS Supported chat models from Ollama. Leave empty to allow all available.
  OLLAMA_CHAT_MODELS: 'sermas-llama3:*,mistral:*',
  // OLLAMA_EMBEDDINGS_MODEL Default embedding model
  OLLAMA_EMBEDDINGS_MODEL: 'nomic-embed-text',

  // GROQ_API_KEY Groq api key
  GROQ_API_KEY: '',
  // GROQ_MODEL Default Groq model used as fallback
  GROQ_MODEL: 'mixtral-8x7b-32768',
  // GROQ_CHAT_MODELS Supported chat models from Groq. Leave empty to allow all available.
  GROQ_CHAT_MODELS:
    'gemma-7b-it,gemma2-9b-it,llama2-70b-4096,llama3-70b-8192,llama3-8b-8192,mixtral-8x7b-32768,llama3-groq-8b-8192-tool-use-preview,llama3-groq-70b-8192-tool-use-preview',

  // MISTRAL_API_KEY Mistral api key
  MISTRAL_API_KEY: '',
  // MISTRAL_EMBEDDINGS_MODEL OpenAi Embedding model
  MISTRAL_EMBEDDINGS_MODEL: 'mistral-embed',
  // OPENAI_CHAT_MODELS Supported chat models from OpenAI. Leave empty to allow all available.
  MISTRAL_CHAT_MODELS:
    'open-mistral-nemo,open-mistral-7b,open-mixtral-8x7b,open-mixtral-8x22b,mistral-large-latest',
  // OPENAI_MODEL Default OpenAI model used as fallback
  MISTRAL_MODEL: 'open-mistral-nemo',

  // ANTROPHIC_API_KEY Antrophic api key
  ANTROPHIC_API_KEY: '',
  // ANTROPHIC_MODEL Default Antrophic model used as fallback
  ANTROPHIC_MODEL: 'claude-3-haiku-20240307',
  // ANTROPHIC_MODELS Supported chat models from Antrophic. Leave empty to allow all available.
  ANTROPHIC_CHAT_MODELS:
    'claude-3-opus-20240229,claude-3-sonnet-20240229,claude-3-haiku-20240307',

  // DATASET_ENABLED Enable data logging
  DATASET_ENABLED: '0',
  // DATASET_BUCKET Data logger bucket name
  DATASET_BUCKET: 'sermas-dataset',

  // SSML_GENERATE Enable empathic LLM-generated SSML for TTS
  SSML_GENERATE: '0',
  // SSML_GENERATE Log generated SSML content
  SSML_PRINT: '0',

  // AZURE_KEY Azure subscription key (used as fallback to more specific ones)
  AZURE_KEY: '',
  // AZURE_REGION Azure region (used as fallback to more specific ones)
  AZURE_REGION: '',
};

export type SermasApiConfig = typeof SermasDefaultConfig;
