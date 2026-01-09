import { Logger } from '@aws-lambda-powertools/logger';

const SERVICE_NAMES = {
  ASSETS: 'asset-management',
  CAMPAIGNS: 'campaign-management',
  PERSONAS: 'persona-management',
  BRANDS: 'brand-management',
  AGENTS: 'agent-orchestration',
  AUTH: 'authentication',
  UTILS: 'utilities'
};

const createLogger = (serviceName) => {
  return new Logger({
    serviceName,
    logLevel: process.env.LOG_LEVEL || 'ERROR'
  });
};

export const assetLogger = createLogger(SERVICE_NAMES.ASSETS);
export const campaignLogger = createLogger(SERVICE_NAMES.CAMPAIGNS);
export const personaLogger = createLogger(SERVICE_NAMES.PERSONAS);
export const brandLogger = createLogger(SERVICE_NAMES.BRANDS);
export const agentLogger = createLogger(SERVICE_NAMES.AGENTS);
export const authLogger = createLogger(SERVICE_NAMES.AUTH);
export const utilLogger = createLogger(SERVICE_NAMES.UTILS);

export { SERVICE_NAMES };
