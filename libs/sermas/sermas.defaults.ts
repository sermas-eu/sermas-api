import { getConfigPath } from './sermas.utils.js';

export const SermasDefaultConfig = {
  // AUTH_PROVIDER local (default): the API issues its own tokens (single instance, no user management; clients and the admin from env, a signing key kept across restarts); keycloak: a Keycloak realm the API administers
  AUTH_PROVIDER: 'local',
  // AUTH_LOCAL_CLIENTS with AUTH_PROVIDER=local, extra service clients as name:secret, comma separated (system clients if listed in AUTH_KEYCLOAK_SYSTEM_CLIENT_ID)
  AUTH_LOCAL_CLIENTS: '',
  // AUTH_LOCAL_TOKEN_TTL_SEC with AUTH_PROVIDER=local, access token lifetime in seconds (12h, as the Keycloak realm: the kiosk does not refresh its app token)
  AUTH_LOCAL_TOKEN_TTL_SEC: 43200,
  // AUTH_LOCAL_REFRESH_TTL_SEC with AUTH_PROVIDER=local, refresh token lifetime in seconds
  AUTH_LOCAL_REFRESH_TTL_SEC: 43200,
  // AUTH_LOCAL_SIGNING_KEY with AUTH_PROVIDER=local, the token signing key as a PEM private key (newlines may be escaped as \\n). Empty: a key generated once and kept in AUTH_LOCAL_SIGNING_KEY_FILE
  AUTH_LOCAL_SIGNING_KEY: '',
  // AUTH_LOCAL_SIGNING_KEY_FILE with AUTH_PROVIDER=local and no AUTH_LOCAL_SIGNING_KEY, where the generated key is kept so tokens survive a restart. Empty: sermas-auth-local-key.pem in the OS temp directory
  AUTH_LOCAL_SIGNING_KEY_FILE: '',
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
  // AUTH_KEYCLOAK_FRONTEND_URL set the keycloack realm frontend URL
  AUTH_KEYCLOAK_FRONTEND_URL: '',
  // AUTH_KEYCLOAK_ISSUERS Accepted token issuers, comma separated. Empty means the realm URL under AUTH_KEYCLOAK_FRONTEND_URL, or AUTH_KEYCLOAK_URL
  AUTH_KEYCLOAK_ISSUERS: '',
  // AUTH_KEYCLOAK_SKIP_HEALTHCHECK Skip /health endpoint checks on startup
  AUTH_KEYCLOAK_SKIP_HEALTHCHECK: '0',
  // AUTH_KEYCLOAK_ADMIN_URL set the keycloack admin URL. Required from keycloak v26.x
  AUTH_KEYCLOAK_ADMIN_URL: 'http://172.17.0.1:8080/keycloak-admin',
  // AUTH_KEYCLOAK_REALM set the keycloack realm
  AUTH_KEYCLOAK_REALM: 'sermas-local',
  // AUTH_KEYCLOAK_CLIENT_ID set the keycloack client ID used for administrative purposes
  AUTH_KEYCLOAK_CLIENT_ID: 'platform',
  // KEYCLOAK_WAIT_SEC how long the API waits at start for Keycloak to answer
  KEYCLOAK_WAIT_SEC: 180,
  // AUTH_KEYCLOAK_SECRET set the keycloack client password used for administrative purposes
  AUTH_KEYCLOAK_SECRET: 'platform',
  // SHOW_KEYCLOAK_LOGS show verbose logging related to keycloak authentication for API endpoints
  SHOW_KEYCLOAK_LOGS: '0',
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
  // AUTH_KEYCLOAK_KIOSK_CLIENT_ID the kiosk's client: it may only mint app tokens
  // (POST /platform/token) for AUTH_KEYCLOAK_KIOSK_APP_CLIENTS, nothing else
  AUTH_KEYCLOAK_KIOSK_CLIENT_ID: 'kiosk',
  // AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET its secret; empty: the client is not created
  AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET: '',
  // AUTH_KEYCLOAK_KIOSK_APP_CLIENTS the app clients the kiosk may mint tokens for
  AUTH_KEYCLOAK_KIOSK_APP_CLIENTS: 'avatar,robot',

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
  SPEECHBRAIN_URL: 'http://speechbrain:5011',

  // FORCE_LANGUAGE default language to use if not provided, it will be used to translate messages or select a TTS model
  FORCE_LANGUAGE: 'en-GB',

  // IMPORT_USERS_FILENAME path to the users.json file
  IMPORT_USERS_FILENAME: `${getConfigPath()}/users.json`,
  // ADMIN_USER default admin username

  ADMIN_USER: `admin`,
  // ADMIN_PASSWORD default admin password (with AUTH_PROVIDER=local a default value disables the admin login)
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
  DEFAULT_MODEL_PATH: '',
  // DEFAULT_BACKGROUND_PATH Minio based path to the default background for the kiosk
  DEFAULT_BACKGROUND_PATH: '',

  // TRANSLATION_SERVICE Provider name to translate messages
  TRANSLATION_SERVICE: 'openai',
  // STT_SERVICE Service for Speech to Text: google, azure, whisper or http. Each needs its own setup.
  STT_SERVICE: 'whisper',
  // WHISPER_URL URL of a whisper ASR web service, used when STT_SERVICE=whisper
  WHISPER_URL: '',
  // STT_HTTP_URL Base URL of a generic HTTP speech service (POST /v1/transcribe), used when STT_SERVICE=http
  STT_HTTP_URL: '',
  // STT_GOOGLE_IMPROVED_RECOGNITION List of short words that need better recognition when using GOOGLE as STT
  STT_GOOGLE_IMPROVED_RECOGNITION: 'si,no,ok,fatto,sì,yes,done,continue,wait',

  // STT_AZURE_KEY Azure subscription key
  STT_AZURE_KEY: '',
  // STT_AZURE_REGION Azure region
  STT_AZURE_REGION: '',

  // TTS_SERVICE Service for Text to Speech: google, azure, openai (any OpenAI-compatible /v1/audio/speech, such as a local Kokoro) or http (a generic HTTP speech service). An avatar may override it.
  TTS_SERVICE: 'google',

  // GOOGLE_TTS_MODEL_TYPE Preferred Google TTS model type (such as Journey, Neural, Wavenet or Standard). See https://cloud.google.com/text-to-speech/docs/voices
  GOOGLE_TTS_MODEL_TYPE: 'Journey',

  // TTS_OPENAI_BASEURL Base URL of the OpenAI-compatible speech API, used when TTS_SERVICE=openai. Empty means api.openai.com
  TTS_OPENAI_BASEURL: '',
  // TTS_OPENAI_API_KEY API key for TTS_OPENAI_BASEURL
  TTS_OPENAI_API_KEY: '',
  // TTS_OPENAI_MODEL Speech model name
  TTS_OPENAI_MODEL: 'tts-1',
  // TTS_OPENAI_VOICE Default voice
  TTS_OPENAI_VOICE: 'alloy',
  // TTS_OPENAI_VOICES Voices per language and gender, as `<lang>[-<gender>]=<voice>` separated by commas (it-F=if_sara,it-M=im_nicola,en=af_heart). An avatar's tts.model overrides them
  TTS_OPENAI_VOICES: '',
  // TTS_HTTP_URL Base URL of a generic HTTP speech service (POST /v1/synthesize, answering WAV), used when TTS_SERVICE=http
  TTS_HTTP_URL: '',
  // TTS_HTTP_LANGUAGES Languages the TTS_HTTP_URL service speaks, comma-separated two-letter codes. Any other language fails
  TTS_HTTP_LANGUAGES: 'it,en',
  // TTS_HTTP_VOICE Default voice id; empty means the service default
  TTS_HTTP_VOICE: '',
  // TTS_HTTP_VOICES Voices per language and gender, as for TTS_OPENAI_VOICES. An avatar's tts.model overrides them
  TTS_HTTP_VOICES: '',
  // TTS_AZURE_KEY Azure subscription key
  TTS_AZURE_KEY: '',
  // TTS_AZURE_REGION Azure region
  TTS_AZURE_REGION: '',

  // LLM_SERVICE LLM service to use. Only `openai` is supported: any OpenAI-compatible
  // endpoint (OpenAI, LiteLLM, vLLM, ...) selected with OPENAI_BASEURL
  LLM_SERVICE: 'openai',

  // LLM_SERVICE_CHAT LLM service to use for textual chat in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_CHAT: 'openai/gpt-4o',
  // LLM_SERVICE_TOOLS LLM service to use for tools matching  in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_TOOLS: 'openai/gpt-4o',
  // LLM_SERVICE_SENTIMENT LLM service to use for sentiment analysis  in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_SENTIMENT: 'openai/gpt-4o-mini',
  // LLM_SERVICE_TASKS LLM service to use for task management in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_TASKS: 'openai/gpt-4o-mini',
  // LLM_SERVICE_INTENT LLM service to use for intent detection in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_INTENT: 'openai/gpt-4o',
  // LLM_SERVICE_TRANSLATION LLM service to use for translation and rephrasing in format provider/model. If not provided will use LLM_SERVICE
  // LLM_SERVICE_TRANSLATION: 'openai/gpt-4o-mini',

  // LLM_PRINT_PROMPT Print prompts to console for debug purposes
  LLM_PRINT_PROMPT: '0',
  // LLM_PRINT_RESPONSE Print LLM response to console for debug purposes
  LLM_PRINT_RESPONSE: '0',
  // LLM_EMBEDDINGS_SERVICE Embedding service to use
  LLM_EMBEDDINGS_SERVICE: 'openai',
  // LLM_EMBEDDINGS_BINARY_QUANTIZATION Enable binary quantization for embeddings
  LLM_EMBEDDINGS_BINARY_QUANTIZATION: '0',

  // LLM_TEMPERATURE determines how "creative" the model is. Min is 0
  LLM_TEMPERATURE: 0.3,

  // LLM_TOP_P only the most probable tokens which cumulative probability reaches top_p are used for next token sampling
  LLM_TOP_P: 0.3,

  // LLM_REASONING_EFFORT reasoning_effort sent to reasoning models (none, minimal, low, medium, high). Empty leaves the model default. Thinking delays the first spoken word: `none` cut it from ~17s to ~1s on a local reasoning model
  LLM_REASONING_EFFORT: '',
  // LLM_EXPLAIN Ask the chat model to explain its filter, intent and tool decisions, for debugging. The explanations are logged and delay the answer
  LLM_EXPLAIN: '0',

  // LLM_DISABLE_SUMMARY, when equals to '1', summarization is not used and the full conversation history is passed to the LLM instead
  LLM_DISABLE_SUMMARY: '0',

  // OPENAI_BASEURL Base URL of the OpenAI-compatible endpoint, e.g. http://litellm:4000/v1. Empty uses api.openai.com
  OPENAI_BASEURL: '',
  // OPENAI_API_KEY API key for OPENAI_BASEURL
  OPENAI_API_KEY: '',
  // OPENAI_EMBEDDINGS_BASEURL Base URL for embeddings, when they come from a different endpoint. Empty uses OPENAI_BASEURL
  OPENAI_EMBEDDINGS_BASEURL: '',
  // OPENAI_EMBEDDINGS_API_KEY API key for OPENAI_EMBEDDINGS_BASEURL. Empty uses OPENAI_API_KEY
  OPENAI_EMBEDDINGS_API_KEY: '',
  // OPENAI_EMBEDDINGS_MODEL OpenAi Embedding model
  OPENAI_EMBEDDINGS_MODEL: 'text-embedding-3-small',
  // OPENAI_CHAT_MODELS Supported chat models from OpenAI. Leave empty to allow all available.
  OPENAI_CHAT_MODELS: '',

  // OPENAI_MODEL Default OpenAI model used as fallback
  OPENAI_MODEL: 'gpt-4o',

  // DATASET_ENABLED Enable data logging
  DATASET_ENABLED: '0',
  // DATASET_BUCKET Data logger bucket name
  DATASET_BUCKET: 'sermas-dataset',

  // SSML_GENERATE Enable empathic LLM-generated SSML for TTS
  SSML_GENERATE: '0',
  // SSML_PRINT Log generated SSML content
  SSML_PRINT: '0',

  // AZURE_KEY Azure subscription key (used as fallback to more specific ones)
  AZURE_KEY: '',
  // AZURE_REGION Azure region (used as fallback to more specific ones)
  AZURE_REGION: '',

  // CLEAR_CACHE_ON_START Clear LLM cache at startup
  CLEAR_CACHE_ON_START: '1',
  // LLM_CACHE_ENABLED Enable or disable LLM caching features
  LLM_CACHE_ENABLED: '1',

  // SPEAKER_VERIFICATION enables speaker verifiaction by comparing audio embeddings
  SPEAKER_VERIFICATION: '1',
  // SPEAKER_RESET_AFTER_DROPS dropped voice turns in a row that reset the session's voice signature; 0 never resets it
  SPEAKER_RESET_AFTER_DROPS: 2,
  // STT_MIN_DURATION_MS voice clips shorter than this are dropped before STT (no-speech)
  STT_MIN_DURATION_MS: 250,
  // STT_MIN_RMS_DBFS voice clips quieter than this RMS level (dBFS) are dropped before STT (no-speech)
  STT_MIN_RMS_DBFS: -55,
  // DIALOGUE_KNOWLEDGE_RESULTS document chunks (paragraphs) given to the chat for each message
  DIALOGUE_KNOWLEDGE_RESULTS: 8,
  // DIALOGUE_NOISY_THRESHOLD dropped voice turns in a row that make the avatar suggest the keyboard; 0 disables it
  DIALOGUE_NOISY_THRESHOLD: 3,
  // DIALOGUE_NOISY_WINDOW_SEC the window, in seconds, in which those dropped turns are counted
  DIALOGUE_NOISY_WINDOW_SEC: 60,
  // DIALOGUE_NOISY_COOLDOWN_SEC minimum seconds between two keyboard suggestions in a session; a second one also needs an answered turn in between
  DIALOGUE_NOISY_COOLDOWN_SEC: 120,
  // MIN_EMBEDDINGS_NUMBER set the minimum number of audio samples to use for creating speaker embedding
  MIN_EMBEDDINGS_NUMBER: '3',
  // SPEECH_SIMILARITY_THRESHOLD value used for comparing embedding, same speaker if above threshold
  SPEECH_SIMILARITY_THRESHOLD: '0.25',

  // SPEECH_VERIFY_TIMEOUT_MSEC timeout for speaker verification request
  SPEECH_VERIFY_TIMEOUT_MSEC: 1000,

  // SENTIMENT_ANALYSIS enable or disable sentiment analysis over text and audio input
  SENTIMENT_ANALYSIS: '0',

  // ENABLE_EMOTION_RECOGNITION Enables the emotion recognition tracker, for research purposes
  ENABLE_EMOTION_RECOGNITION: '0',

  // SESSION_EXPIRATION_SEC session expiration time in seconds
  SESSION_EXPIRATION_SEC: 5 * 60, // 5 min
};

export type SermasApiConfig = typeof SermasDefaultConfig;
