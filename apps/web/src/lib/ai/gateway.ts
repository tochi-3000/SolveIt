/**
 * SolvAm AI Gateway Dispatcher
 * Selects and instantiates the active Vision & Tool-Calling provider.
 * Defaults to Meta Muse Spark 1.3 for hackathon compliance.
 */

import { IMathVisionProvider } from './types';
import { MetaMuseProvider } from './providers/metaMuseProvider';

export function getAIProvider(providerName?: string): IMathVisionProvider {
  switch (providerName?.toLowerCase()) {
    case 'meta':
    case 'muse':
    default:
      return new MetaMuseProvider();
  }
}
