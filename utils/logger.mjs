import { Logger } from '@aws-lambda-powertools/logger';

export const logger = new Logger({
  serviceName: 'social-media-campaign-builder',
  logLevel: process.env.LOG_LEVEL || 'ERROR'
});
