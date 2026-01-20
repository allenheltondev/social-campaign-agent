export const PLATFORM_CONSTRAINTS = {
  twitter: {
    maxCharacters: 280,
    maxHashtags: 10,
    maxMentions: 10
  },
  linkedin: {
    maxCharacters: 3000,
    maxHashtags: 30,
    maxMentions: 50
  },
  instagram: {
    maxCharacters: 2200,
    maxHashtags: 30,
    maxMentions: 20
  },
  facebook: {
    maxCharacters: 63206,
    maxHashtags: 30,
    maxMentions: 50
  }
};

export const validatePostContent = (platform, content) => {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  if (!constraints) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const errors = [];

  if (content.text && content.text.length > constraints.maxCharacters) {
    errors.push({
      field: 'text',
      message: `Text exceeds maximum length of ${constraints.maxCharacters} characters for ${platform}`,
      actual: content.text.length,
      max: constraints.maxCharacters
    });
  }

  if (content.hashtags && content.hashtags.length > constraints.maxHashtags) {
    errors.push({
      field: 'hashtags',
      message: `Number of hashtags exceeds maximum of ${constraints.maxHashtags} for ${platform}`,
      actual: content.hashtags.length,
      max: constraints.maxHashtags
    });
  }

  if (content.mentions && content.mentions.length > constraints.maxMentions) {
    errors.push({
      field: 'mentions',
      message: `Number of mentions exceeds maximum of ${constraints.maxMentions} for ${platform}`,
      actual: content.mentions.length,
      max: constraints.maxMentions
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
