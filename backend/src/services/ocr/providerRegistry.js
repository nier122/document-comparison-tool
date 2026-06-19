const { GoogleDocumentAiOcrService } = require('./providers/GoogleDocumentAiOcrService');

function createOcrProviderRegistry({
  providers = [
    new GoogleDocumentAiOcrService(),
  ],
} = {}) {
  const providersByName = new Map(
    providers.map((provider) => [provider.provider, provider]),
  );

  return {
    getProvider(providerName) {
      return providersByName.get(providerName);
    },

    listProviders() {
      return [...providersByName.values()].map((provider) => provider.getStatus());
    },
  };
}

module.exports = { createOcrProviderRegistry };
