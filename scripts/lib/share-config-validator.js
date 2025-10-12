const ALLOWED_FORMATS = new Set(['text', 'markdown', 'json']);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateString(value, path, errors, { allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`);
    return;
  }
  if (!allowEmpty && value.trim().length === 0) {
    errors.push(`${path} must not be empty`);
  }
}

function validateBoolean(value, path, errors) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean`);
  }
}

function validateNumber(value, path, errors, { min, allowFloat = true }) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'number') {
    errors.push(`${path} must be a number`);
    return;
  }
  if (!allowFloat && !Number.isInteger(value)) {
    errors.push(`${path} must be an integer`);
    return;
  }
  if (min !== undefined && value < min) {
    errors.push(`${path} must be >= ${min}`);
  }
}

function validatePostEntry(entry, path, errors, summary) {
  if (typeof entry === 'string') {
    if (entry.trim().length === 0) {
      errors.push(`${path} must not be empty`);
    } else {
      summary.posts += 1;
    }
    return;
  }

  if (!isObject(entry)) {
    errors.push(`${path} must be a string or object`);
    return;
  }

  validateString(entry.url ?? entry.href ?? entry.target, `${path}.url`, errors);
  if (!errors.some((message) => message.startsWith(`${path}.url`))) {
    summary.posts += 1;
  }

  validateNumber(entry.retry, `${path}.retry`, errors, { min: 0, allowFloat: false });
  validateNumber(entry.retryDelay ?? entry.retryDelayMs, `${path}.retryDelay`, errors, {
    min: 0,
    allowFloat: false,
  });
  validateNumber(entry.retryBackoff, `${path}.retryBackoff`, errors, { min: 1 });
  validateNumber(entry.retryMaxDelay ?? entry.retryMaxDelayMs, `${path}.retryMaxDelay`, errors, {
    min: 0,
    allowFloat: false,
  });
  validateNumber(entry.retryJitter ?? entry.retryJitterMs, `${path}.retryJitter`, errors, {
    min: 0,
    allowFloat: false,
  });

  validateBoolean(entry['ensure-ok'] ?? entry.ensureOk, `${path}.ensure-ok`, errors);
  validateBoolean(entry['respect-retry-after'] ?? entry.respectRetryAfter, `${path}.respect-retry-after`, errors);
}

function validateProjectsApi(projectsApi, path, errors) {
  if (!isObject(projectsApi)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateString(projectsApi.baseUrl, `${path}.baseUrl`, errors);
  validateString(projectsApi.token, `${path}.token`, errors);
  validateString(projectsApi.tenant, `${path}.tenant`, errors);
  validateNumber(projectsApi.timeoutMs ?? projectsApi.timeout, `${path}.timeout`, errors, {
    min: 1,
    allowFloat: false,
  });
  validateBoolean(projectsApi.fetchMetrics, `${path}.fetchMetrics`, errors);
}

function validateShareConfigObject(config, path, errors, summary) {
  if (!isObject(config)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateString(config.url, `${path}.url`, errors);
  if (typeof config.url === 'string' && config.url.trim()) {
    summary.urls += 1;
  }
  validateString(config.title, `${path}.title`, errors);
  validateString(config.notes, `${path}.notes`, errors);
  validateString(config.out, `${path}.out`, errors);
  validateString(config['audit-log'] ?? config.auditLog, `${path}.audit-log`, errors);
  validateString(config.format, `${path}.format`, errors);
  if (typeof config.format === 'string' && !ALLOWED_FORMATS.has(config.format.toLowerCase())) {
    errors.push(`${path}.format must be one of text | markdown | json`);
  }

  validateNumber(config.count, `${path}.count`, errors, { min: 0, allowFloat: false });
  validateNumber(config.retry, `${path}.retry`, errors, { min: 0, allowFloat: false });
  validateNumber(config.retryDelay ?? config['retry-delay'], `${path}.retryDelay`, errors, {
    min: 0,
    allowFloat: false,
  });
  validateNumber(config.retryBackoff ?? config['retry-backoff'], `${path}.retryBackoff`, errors, { min: 1 });
  validateNumber(config.retryMaxDelay ?? config['retry-max-delay'], `${path}.retryMaxDelay`, errors, {
    min: 0,
    allowFloat: false,
  });
  validateNumber(config.retryJitter ?? config['retry-jitter'], `${path}.retryJitter`, errors, {
    min: 0,
    allowFloat: false,
  });
  validateBoolean(config['ensure-ok'] ?? config.ensureOk, `${path}.ensure-ok`, errors);
  validateBoolean(config['respect-retry-after'] ?? config.respectRetryAfter, `${path}.respect-retry-after`, errors);
  validateBoolean(config['fetch-metrics'] ?? config.fetchMetrics, `${path}.fetch-metrics`, errors);

  validateString(config.template ?? config.defaultTemplate ?? config['default-template'], `${path}.template`, errors);

  const post = config.post;
  if (post !== undefined) {
    const entries = Array.isArray(post) ? post : [post];
    entries.forEach((entry, index) => {
      validatePostEntry(entry, `${path}.post[${index}]`, errors, summary);
    });
  }

  if (config.projectsApi) {
    validateProjectsApi(config.projectsApi, `${path}.projectsApi`, errors);
  }

  if (config.templates !== undefined) {
    if (!isObject(config.templates)) {
      errors.push(`${path}.templates must be an object whose keys are template names`);
    } else {
      Object.entries(config.templates).forEach(([name, templateConfig]) => {
        validateShareConfigObject(templateConfig, `${path}.templates.${name}`, errors, summary);
        summary.templates += 1;
      });
    }
  }
}

function validateShareConfig(config) {
  const errors = [];
  const summary = {
    templates: 0,
    posts: 0,
    urls: 0,
  };

  validateShareConfigObject(config, 'config', errors, summary);

  return { errors, summary };
}

module.exports = {
  validateShareConfig,
};
