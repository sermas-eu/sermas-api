import {
  OpenAPIObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Document, Operation } from 'openapi-client-axios';

export interface PlatformModuleSwaggerOperation {
  operation: Operation;
  method: string;
  path: string;
}

export class OpenApiUtils {
  replaceSchemas(spec: OpenAPIObject, replacements: Record<string, string>) {
    function replaceReferences(obj: any) {
      if (obj && typeof obj === 'object') {
        if (obj.$ref && obj.$ref.startsWith('#/components/schemas/')) {
          const schemaName = obj.$ref.replace('#/components/schemas/', '');
          if (schemaName in replacements) {
            obj.$ref = `#/components/schemas/${replacements[schemaName]}`;
          }
        }

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            replaceReferences(obj[key]);
          }
        }
      }
    }

    for (const key in spec.components.schemas) {
      if (spec.components.schemas.hasOwnProperty(key)) {
        if (key in replacements) {
          spec.components.schemas[replacements[key]] =
            spec.components.schemas[key];
          delete spec.components.schemas[key];
        }
      }
    }

    replaceReferences(spec.components.schemas);
    return spec;
  }

  replaceReferencesInOperation(
    operation: any,
    referenceMap: Record<string, string>,
  ): any {
    const operationCopy = JSON.parse(JSON.stringify(operation)); // Deep copy to avoid modifying the original object

    // Replace references in request body content
    this.replaceReferencesInContent(
      operationCopy.requestBody?.content,
      referenceMap,
    );

    // Replace references in responses
    this.replaceReferencesInResponses(operationCopy.responses, referenceMap);

    // Replace references in parameters
    const parameters = operationCopy.parameters;
    if (parameters) {
      parameters.forEach((parameter: any) => {
        this.replaceReferencesInContent(parameter.content, referenceMap);
      });
    }

    return operationCopy;
  }

  private replaceReferencesInContent(
    content: any,
    referenceMap: Record<string, string>,
  ) {
    if (content) {
      for (const contentType in content) {
        if (content.hasOwnProperty(contentType)) {
          const mediaType = content[contentType];
          const ref = mediaType.schema?.$ref || mediaType.schema?.items?.$ref;
          if (ref) {
            const refParts = ref.split('/');
            const originalName = refParts[refParts.length - 1];

            // Check if there is a substitution name in the map
            const substitutionName = referenceMap[originalName];
            if (substitutionName) {
              if (mediaType.schema?.$ref) {
                mediaType.schema.$ref = mediaType.schema.$ref.replace(
                  originalName,
                  substitutionName,
                );
              }
              if (mediaType.schema?.items?.$ref) {
                mediaType.schema.items.$ref =
                  mediaType.schema.items.$ref.replace(
                    originalName,
                    substitutionName,
                  );
              }
            }
          }
        }
      }
    }
  }

  private replaceReferencesInResponses(
    responses: any,
    referenceMap: Record<string, string>,
  ) {
    if (responses) {
      for (const statusCode in responses) {
        if (responses.hasOwnProperty(statusCode)) {
          const response = responses[statusCode];
          this.replaceReferencesInContent(response.content, referenceMap);
        }
      }
    }
  }

  getSchemaDefinitions(
    doc: Document,
  ): Record<string, SchemaObject | ReferenceObject> {
    const schemaDefinitions: string[] = [];

    if (doc && doc.components && doc.components.schemas) {
      const schemas = doc.components.schemas;

      for (const schemaName in schemas) {
        if (schemas.hasOwnProperty(schemaName)) {
          schemaDefinitions.push(schemaName);
        }
      }
    }

    // Traverse paths to find schema references in the endpoints
    if (doc && doc.paths) {
      const paths = doc.paths;

      for (const path in paths) {
        if (paths.hasOwnProperty(path)) {
          const pathObject = paths[path];

          for (const method in pathObject) {
            if (pathObject.hasOwnProperty(method)) {
              const operation = pathObject[method];

              // Check for request and response schemas
              this.extractSchemaReferences(
                operation.requestBody?.content,
                schemaDefinitions,
              );
              this.extractSchemaReferences(
                operation.responses,
                schemaDefinitions,
              );

              // Check for parameters schemas
              const parameters = operation.parameters;
              if (parameters) {
                parameters.forEach((parameter: any) => {
                  this.extractSchemaReferences(
                    parameter.content,
                    schemaDefinitions,
                  );
                });
              }
            }
          }
        }
      }
    }

    const schemas = Array.from(new Set(schemaDefinitions));
    const res = {};

    schemas.forEach((schemaName) => {
      res[schemaName] = doc.components.schemas[schemaName];
    });

    return res;
  }

  private extractSchemaReferences(content: any, schemaDefinitions) {
    if (content) {
      for (const contentType in content) {
        if (content.hasOwnProperty(contentType)) {
          const mediaType = content[contentType];
          if (mediaType.schema && mediaType.schema.$ref) {
            const refParts = mediaType.schema.$ref.split('/');
            const schemaName = refParts[refParts.length - 1];
            schemaDefinitions.push(schemaName);
          }
        }
      }
    }
    return schemaDefinitions;
  }

  getOperationById(
    swagger: Document,
    operationId: string,
  ): PlatformModuleSwaggerOperation | null {
    for (const path in swagger.paths) {
      const methods = swagger.paths[path];
      for (const method in methods) {
        const operation = methods[method];
        if (operation.operationId === operationId) {
          return {
            method,
            path,
            operation,
          };
        }
      }
    }
    return undefined; // Operation with the specified ID not found
  }
}
