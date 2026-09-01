import { EnvironmentAdapter } from './environmentAdapter';
import dotEnvAdapter from './dotEnvAdapter';
import springBootAdapter from './springBootAdapter';
import dockerComposeAdapter from './dockerComposeAdapter';

const adapters: EnvironmentAdapter[] = [
  dotEnvAdapter,
  springBootAdapter,
  dockerComposeAdapter,
];

export function getEnvironmentAdapter(adapterId: string): EnvironmentAdapter {
  const adapter = adapters.find((candidate) => candidate.id === adapterId);
  if (!adapter)
    throw new Error(`Unsupported environment adapter: ${adapterId}`);
  return adapter;
}

export default adapters;
