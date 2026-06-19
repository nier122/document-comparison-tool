function parseCredentialsJson(value) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(
      'GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON must contain valid service-account JSON.',
    );
    error.code = 'GOOGLE_OCR_INVALID_CREDENTIALS';
    error.status = 500;
    throw error;
  }
}

function getGoogleDocumentAiConfig(environment = process.env) {
  return {
    projectId:
      environment.GOOGLE_DOCUMENT_AI_PROJECT_ID ??
      environment.GOOGLE_CLOUD_PROJECT,
    location: environment.GOOGLE_DOCUMENT_AI_LOCATION ?? 'us',
    processorId: environment.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
    processorVersion: environment.GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION,
    credentials: parseCredentialsJson(
      environment.GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON,
    ),
    keyFilename: environment.GOOGLE_APPLICATION_CREDENTIALS,
    apiKey: environment.GOOGLE_DOCUMENT_AI_API_KEY,
    useAdc: environment.GOOGLE_DOCUMENT_AI_USE_ADC === 'true',
  };
}

module.exports = { getGoogleDocumentAiConfig };
