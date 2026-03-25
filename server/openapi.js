function ruleSchema() {
  return {
    type: 'object',
    required: ['name', 'hostname', 'backendUrl', 'entryPoints', 'tls'],
    properties: {
      id: { type: 'string', example: '5b6ca558-4bba-46d3-9a5e-0f55e478d0c3' },
      fileName: { type: 'string', example: 'app.yaml' },
      name: { type: 'string', example: 'app' },
      routerName: { type: 'string', example: 'app-router' },
      serviceName: { type: 'string', example: 'app-service' },
      hostname: { type: 'string', example: 'app.example.com' },
      backendUrl: {
        type: 'array',
        items: { type: 'string', example: 'http://app:8080' }
      },
      entryPoints: {
        type: 'array',
        items: { type: 'string', example: 'websecure' }
      },
      tls: { type: 'boolean', example: true },
      middlewares: {
        type: 'array',
        items: { type: 'string', example: 'chain-no-auth@file' }
      },
      yamlContent: { type: 'string' },
      isValid: { type: 'boolean', example: true },
      validationErrors: {
        type: 'array',
        items: { type: 'string' }
      },
      lastModified: { type: 'string', format: 'date-time' },
      priority: { type: 'integer', example: 10 },
      certResolver: { type: 'string', example: 'letsencrypt' },
      tlsOptions: { type: 'string', example: 'modern@file' },
      passHostHeader: { type: 'boolean', example: true },
      stickySession: { type: 'boolean', example: false },
      healthCheckPath: { type: 'string', example: '/healthz' },
      healthCheckInterval: { type: 'string', example: '10s' },
      serversTransport: { type: 'string', example: 'default@file' },
      serversTransportInsecureSkipVerify: { type: 'boolean', example: false },
      previousName: { type: 'string', example: 'old-app' }
    }
  };
}

function rulePayloadSchema() {
  const schema = ruleSchema();
  delete schema.properties.id;
  delete schema.properties.fileName;
  delete schema.properties.yamlContent;
  delete schema.properties.isValid;
  delete schema.properties.validationErrors;
  delete schema.properties.lastModified;
  return schema;
}

export function createOpenApiSpec(serverUrl = 'http://localhost:3001') {
  const rulePayload = rulePayloadSchema();
  const rule = ruleSchema();

  return {
    openapi: '3.1.0',
    info: {
      title: 'Traefik Rules Manager API',
      version: '1.0.0',
      description: [
        'Interactive API documentation for Traefik Rules Manager.',
        '',
        'Auth model:',
        '- Human admin routes use the built-in login and an HttpOnly session cookie.',
        '- Automation routes use `Authorization: Bearer <api-key>`.',
        '',
        'To test admin routes here, call `POST /api/auth/login` first. The browser will keep the session cookie for subsequent requests.'
      ].join('\n')
    },
    servers: [
      { url: serverUrl }
    ],
    tags: [
      { name: 'Health', description: 'Public service readiness and health checks' },
      { name: 'Auth', description: 'Admin session login/logout/session inspection' },
      { name: 'Rules', description: 'Admin UI rule management endpoints' },
      { name: 'Automation', description: 'Bearer-authenticated automation endpoints' },
      { name: 'API Keys', description: 'Admin API key management endpoints' }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'trm_session',
          description: 'Acquire this cookie by calling POST /api/auth/login from the docs UI.'
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key'
        }
      },
      schemas: {
        Rule: rule,
        RulePayload: rulePayload,
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            configPath: { type: 'string', example: '/config/dynamic' }
          }
        },
        ReadyResponse: {
          type: 'object',
          properties: {
            ready: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        AuthSession: {
          type: 'object',
          properties: {
            authEnabled: { type: 'boolean', example: true },
            authenticated: { type: 'boolean', example: true },
            username: { type: 'string', example: 'admin' }
          }
        },
        LoginPayload: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', format: 'password', example: 'change-me' }
          }
        },
        ApiKeyRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'fd48b4c7-e356-48bf-81a2-d2bb4db8245b' },
            name: { type: 'string', example: 'GitHub Actions deploy' },
            prefix: { type: 'string', example: 'trm_fd48b4c7' },
            createdAt: { type: 'string', format: 'date-time' },
            createdBy: { type: 'string', example: 'admin' },
            lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
            revokedAt: { type: ['string', 'null'], format: 'date-time' },
            revokedBy: { type: ['string', 'null'] },
            expiresAt: { type: ['string', 'null'], format: 'date-time' }
          }
        },
        CreateApiKeyPayload: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'GitHub Actions deploy' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        CreatedApiKeyResponse: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', example: 'trm_fd48b4c7_very-secret-value' },
            record: { $ref: '#/components/schemas/ApiKeyRecord' }
          }
        },
        ValidationPayload: {
          oneOf: [
            {
              type: 'object',
              properties: {
                yamlContent: {
                  type: 'string',
                  example: 'http:\n  routers:\n    app:\n      rule: Host(`app.example.com`)'
                }
              }
            },
            { $ref: '#/components/schemas/RulePayload' }
          ]
        },
        ValidationResponse: {
          type: 'object',
          properties: {
            valid: { type: 'boolean', example: true },
            errors: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Authentication required' }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required or invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        NotFound: {
          description: 'Requested resource was not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Liveness check',
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
                }
              }
            }
          }
        }
      },
      '/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness check',
          responses: {
            200: {
              description: 'Initial discovery has completed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadyResponse' }
                }
              }
            }
          }
        }
      },
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Frontend-facing health check',
          responses: {
            200: {
              description: 'Backend can access the configured dynamic path',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
                }
              }
            }
          }
        }
      },
      '/api/auth/session': {
        get: {
          tags: ['Auth'],
          summary: 'Inspect current admin session',
          responses: {
            200: {
              description: 'Admin session is active',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthSession' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Create admin session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginPayload' }
              }
            }
          },
          responses: {
            200: {
              description: 'Session cookie set successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthSession' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Clear admin session',
          responses: {
            204: {
              description: 'Session cleared'
            }
          }
        }
      },
      '/api/rules': {
        get: {
          tags: ['Rules'],
          summary: 'List rules for the admin UI',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'All rules',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Rule' }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        },
        post: {
          tags: ['Rules'],
          summary: 'Create a rule from the admin UI',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RulePayload' }
              }
            }
          },
          responses: {
            201: {
              description: 'Rule created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/rules/{id}': {
        get: {
          tags: ['Rules'],
          summary: 'Fetch a single rule',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Rule payload',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        },
        put: {
          tags: ['Rules'],
          summary: 'Update a rule',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RulePayload' }
              }
            }
          },
          responses: {
            200: {
              description: 'Updated rule',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        },
        delete: {
          tags: ['Rules'],
          summary: 'Delete a rule',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { description: 'Deleted successfully' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/rules/{id}/yaml': {
        get: {
          tags: ['Rules'],
          summary: 'Fetch the generated YAML for a rule',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'YAML document',
              content: {
                'text/yaml': {
                  schema: { type: 'string' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/rules/validate': {
        post: {
          tags: ['Rules'],
          summary: 'Validate either YAML or a rule payload',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationPayload' }
              }
            }
          },
          responses: {
            200: {
              description: 'Validation result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidationResponse' }
                }
              }
            },
            400: {
              description: 'Validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidationResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/middlewares': {
        get: {
          tags: ['Rules'],
          summary: 'List middleware names referenced by known rules',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Middleware names',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/resync': {
        post: {
          tags: ['Rules'],
          summary: 'Resync metadata from disk',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Resync completed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      count: { type: 'integer', example: 12 }
                    }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/admin/api-keys': {
        get: {
          tags: ['API Keys'],
          summary: 'List API keys without plaintext secrets',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'All stored API keys',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ApiKeyRecord' }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        },
        post: {
          tags: ['API Keys'],
          summary: 'Create a new API key and return its plaintext once',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateApiKeyPayload' }
              }
            }
          },
          responses: {
            201: {
              description: 'API key created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreatedApiKeyResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/admin/api-keys/{id}/revoke': {
        post: {
          tags: ['API Keys'],
          summary: 'Revoke an API key',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Revoked key metadata',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiKeyRecord' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/automation/rules': {
        get: {
          tags: ['Automation'],
          summary: 'List rules via bearer-authenticated automation API',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All rules',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Rule' }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        },
        post: {
          tags: ['Automation'],
          summary: 'Create a rule via bearer-authenticated automation API',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RulePayload' }
              }
            }
          },
          responses: {
            201: {
              description: 'Rule created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },
      '/api/automation/rules/{id}': {
        get: {
          tags: ['Automation'],
          summary: 'Fetch a rule via automation API',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Rule payload',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        },
        put: {
          tags: ['Automation'],
          summary: 'Update a rule via automation API',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RulePayload' }
              }
            }
          },
          responses: {
            200: {
              description: 'Updated rule',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Rule' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        },
        delete: {
          tags: ['Automation'],
          summary: 'Delete a rule via automation API',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { description: 'Deleted successfully' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        }
      }
    }
  };
}

export function renderSwaggerHtml(specUrl = '/api-docs/openapi.json') {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TRM API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f8fafc; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true
      });
    </script>
  </body>
</html>`;
}
