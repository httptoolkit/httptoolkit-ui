/*
 * We use this schema to filter loaded OpenAPI specs for only valid & relevant properties.
 * This is based on https://raw.githubusercontent.com/handrews/OpenAPI-Specification/oas3-schema/schemas/v3.0/schema.yaml,
 * but with a few changes:
 *
 * - non-essential extension fields (everything except x-logo) made invalid
 * - oneOf changed to anyOf in all cases (relaxing constraints)
 * - All any/all/oneOf either reordered where possible,  so they never match an
 *   additionalProperties: false schema before the correct match (as this breaks
 *   with ajv removeAdditional filtering)
 * - additionalProperties removed for schemas in an anyOf that couldn't be reordered
 *
 * All in all this makes the schema stricter about x-*, but more lax about everything
 * else. Updates will need similar treatment, but a diff should make it easy enough.
*/

export const openApiSchema = {
  "type": "object",
  "required": [
    "openapi",
    "info",
    "paths"
  ],
  "properties": {
    "openapi": {
      "type": "string",
      "pattern": "^3\\.0\\.\\d(-.+)?$"
    },
    "info": {
      "$ref": "#/definitions/Info"
    },
    "externalDocs": {
      "$ref": "#/definitions/ExternalDocumentation"
    },
    "servers": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/Server"
      }
    },
    "security": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/SecurityRequirement"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/Tag"
      },
      "uniqueItems": true
    },
    "paths": {
      "$ref": "#/definitions/Paths"
    },
    "components": {
      "$ref": "#/definitions/Components"
    }
  },
  "additionalProperties": false,
  "definitions": {
    "Reference": {
      "type": "object",
      "required": [
        "$ref"
      ],
      "patternProperties": {
        "^\\$ref$": {
          "type": "string",
          "format": "uri-reference"
        }
      }
    },
    "Info": {
      "type": "object",
      "required": [
        "title",
        "version"
      ],
      "properties": {
        "title": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "termsOfService": {
          "type": "string",
          "format": "uri-reference"
        },
        "contact": {
          "$ref": "#/definitions/Contact"
        },
        "license": {
          "$ref": "#/definitions/License"
        },
        "version": {
          "type": "string"
        },
        "x-logo": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string"
            }
          }
        },
        "x-httptoolkit-builtin-api": {
          "type": "boolean",
          "default": false
        },
        "x-httptoolkit-short-name": {
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "Contact": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "url": {
          "type": "string",
          "format": "uri-reference"
        },
        "email": {
          "type": "string",
          "format": "email"
        }
      },
      "additionalProperties": false
    },
    "License": {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "url": {
          "type": "string",
          "format": "uri-reference"
        }
      },
      "additionalProperties": false
    },
    "Server": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "variables": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/ServerVariable"
          }
        }
      },
      "additionalProperties": false
    },
    "ServerVariable": {
      "type": "object",
      "required": [
        "default"
      ],
      "properties": {
        "enum": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "default": {
          "type": "string"
        },
        "description": {
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "Components": {
      "type": "object",
      "properties": {
        "schemas": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Schema"
                }
              ]
            }
          }
        },
        "responses": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Response"
                }
              ]
            }
          }
        },
        "parameters": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Parameter"
                }
              ]
            }
          }
        },
        "examples": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Example"
                }
              ]
            }
          }
        },
        "requestBodies": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/RequestBody"
                }
              ]
            }
          }
        },
        "headers": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Header"
                }
              ]
            }
          }
        },
        "securitySchemes": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/SecurityScheme"
                }
              ]
            }
          }
        },
        "links": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Link"
                }
              ]
            }
          }
        },
        "callbacks": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9\\.\\-_]+$": {
              "anyOf": [
                {
                  "$ref": "#/definitions/Reference"
                },
                {
                  "$ref": "#/definitions/Callback"
                }
              ]
            }
          }
        }
      },
      "additionalProperties": false
    },
    "Schema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "multipleOf": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "maximum": {
          "type": "number"
        },
        "exclusiveMaximum": {
          "type": "boolean",
          "default": false
        },
        "minimum": {
          "type": "number"
        },
        "exclusiveMinimum": {
          "type": "boolean",
          "default": false
        },
        "maxLength": {
          "type": "integer",
          "minimum": 0
        },
        "minLength": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "pattern": {
          "type": "string",
          "format": "regex"
        },
        "maxItems": {
          "type": "integer",
          "minimum": 0
        },
        "minItems": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "uniqueItems": {
          "type": "boolean",
          "default": false
        },
        "maxProperties": {
          "type": "integer",
          "minimum": 0
        },
        "minProperties": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "required": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "enum": {
          "type": "array",
          "items": {},
          "minItems": 1,
          "uniqueItems": false
        },
        "type": {
          "type": "string",
          "enum": [
            "array",
            "boolean",
            "integer",
            "number",
            "object",
            "string"
          ]
        },
        "not": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "allOf": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Schema"
              }
            ]
          }
        },
        "oneOf": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Schema"
              }
            ]
          }
        },
        "anyOf": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Schema"
              }
            ]
          }
        },
        "items": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "properties": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Schema"
              }
            ]
          }
        },
        "additionalProperties": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            },
            {
              "type": "boolean"
            }
          ],
          "default": true
        },
        "description": {
          "type": "string"
        },
        "format": {
          "type": "string"
        },
        "default": {},
        "nullable": {
          "type": "boolean",
          "default": false
        },
        "discriminator": {
          "$ref": "#/definitions/Discriminator"
        },
        "readOnly": {
          "type": "boolean",
          "default": false
        },
        "writeOnly": {
          "type": "boolean",
          "default": false
        },
        "example": {},
        "externalDocs": {
          "$ref": "#/definitions/ExternalDocumentation"
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "xml": {
          "$ref": "#/definitions/XML"
        }
      },
      "additionalProperties": false
    },
    "Discriminator": {
      "type": "object",
      "required": [
        "propertyName"
      ],
      "properties": {
        "propertyName": {
          "type": "string"
        },
        "mapping": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    },
    "XML": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "namespace": {
          "type": "string",
          "format": "uri"
        },
        "prefix": {
          "type": "string"
        },
        "attribute": {
          "type": "boolean",
          "default": false
        },
        "wrapped": {
          "type": "boolean",
          "default": false
        }
      },
      "additionalProperties": false
    },
    "Response": {
      "type": "object",
      "required": [
        "description"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "headers": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Header"
              }
            ]
          }
        },
        "content": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/MediaType"
          }
        },
        "links": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Link"
              }
            ]
          }
        }
      },
      "additionalProperties": false
    },
    "MediaType": {
      "anyOf": [
        {
          "$ref": "#/definitions/MediaTypeWithExample"
        },
        {
          "$ref": "#/definitions/MediaTypeWithExamples"
        }
      ]
    },
    "MediaTypeWithExample": {
      "type": "object",
      "properties": {
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {},
        "encoding": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/Encoding"
          }
        }
      }
    },
    "MediaTypeWithExamples": {
      "type": "object",
      "required": [
        "examples"
      ],
      "properties": {
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        },
        "encoding": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/Encoding"
          }
        }
      }
    },
    "Example": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "value": {},
        "externalValue": {
          "type": "string",
          "format": "uri-reference"
        }
      },
      "additionalProperties": false
    },
    "Header": {
      "anyOf": [
        {
          "$ref": "#/definitions/HeaderWithSchema"
        },
        {
          "$ref": "#/definitions/HeaderWithContent"
        }
      ]
    },
    "HeaderWithSchema": {
      "anyOf": [
        {
          "$ref": "#/definitions/HeaderWithSchemaWithExample"
        },
        {
          "$ref": "#/definitions/HeaderWithSchemaWithExamples"
        }
      ]
    },
    "HeaderWithSchemaWithExample": {
      "type": "object",
      "required": [
        "schema"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {}
      },
    },
    "HeaderWithSchemaWithExamples": {
      "type": "object",
      "required": [
        "schema",
        "examples"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        }
      },
    },
    "HeaderWithContent": {
      "type": "object",
      "required": [
        "content"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "content": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/MediaType"
          },
          "minProperties": 1,
          "maxProperties": 1
        }
      },
    },
    "Paths": {
      "type": "object",
      "patternProperties": {
        "^\\/": {
          "$ref": "#/definitions/PathItem"
        }
      },
      "additionalProperties": false
    },
    "PathItem": {
      "type": "object",
      "properties": {
        "$ref": {
          "type": "string"
        },
        "summary": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "get": {
          "$ref": "#/definitions/Operation"
        },
        "put": {
          "$ref": "#/definitions/Operation"
        },
        "post": {
          "$ref": "#/definitions/Operation"
        },
        "delete": {
          "$ref": "#/definitions/Operation"
        },
        "options": {
          "$ref": "#/definitions/Operation"
        },
        "head": {
          "$ref": "#/definitions/Operation"
        },
        "patch": {
          "$ref": "#/definitions/Operation"
        },
        "trace": {
          "$ref": "#/definitions/Operation"
        },
        "servers": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/Server"
          }
        },
        "parameters": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Parameter"
              }
            ]
          },
          "uniqueItems": true
        }
      },
      "additionalProperties": false
    },
    "Operation": {
      "type": "object",
      "required": [
        "responses"
      ],
      "properties": {
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "summary": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "externalDocs": {
          "$ref": "#/definitions/ExternalDocumentation"
        },
        "operationId": {
          "type": "string"
        },
        "parameters": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Parameter"
              }
            ]
          },
          "uniqueItems": true
        },
        "requestBody": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/RequestBody"
            }
          ]
        },
        "responses": {
          "$ref": "#/definitions/Responses"
        },
        "callbacks": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Callback"
              }
            ]
          }
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "security": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SecurityRequirement"
          }
        },
        "servers": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/Server"
          }
        }
      },
      "additionalProperties": false
    },
    "Responses": {
      "type": "object",
      "properties": {
        "default": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Response"
            }
          ]
        }
      },
      "patternProperties": {
        "^[1-5](?:\\d{2}|XX)$": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Response"
            }
          ]
        }
      },
      "minProperties": 1,
      "additionalProperties": false
    },
    "SecurityRequirement": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "Tag": {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "externalDocs": {
          "$ref": "#/definitions/ExternalDocumentation"
        }
      },
      "additionalProperties": false
    },
    "ExternalDocumentation": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "url": {
          "type": "string",
          "format": "uri-reference"
        }
      },
      "additionalProperties": false
    },
    "Parameter": {
      "anyOf": [
        {
          "$ref": "#/definitions/ParameterWithSchema"
        },
        {
          "$ref": "#/definitions/ParameterWithContent"
        }
      ]
    },
    "ParameterWithSchema": {
      "anyOf": [
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExample"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExamples"
        }
      ]
    },
    "ParameterWithSchemaWithExample": {
      "anyOf": [
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExampleInPath"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExampleInQuery"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExampleInHeader"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExampleInCookie"
        }
      ]
    },
    "ParameterWithSchemaWithExampleInPath": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema",
        "required"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "path"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "enum": [
            true
          ]
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "matrix",
            "label",
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {}
      },
    },
    "ParameterWithSchemaWithExampleInQuery": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "query"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "form",
            "spaceDelimited",
            "pipeDelimited",
            "deepObject"
          ],
          "default": "form"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {}
      },
    },
    "ParameterWithSchemaWithExampleInHeader": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "header"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {}
      },
    },
    "ParameterWithSchemaWithExampleInCookie": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "cookie"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "form"
          ],
          "default": "form"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "example": {}
      },
    },
    "ParameterWithSchemaWithExamples": {
      "anyOf": [
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExamplesInPath"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExamplesInQuery"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExamplesInHeader"
        },
        {
          "$ref": "#/definitions/ParameterWithSchemaWithExamplesInCookie"
        }
      ]
    },
    "ParameterWithSchemaWithExamplesInPath": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema",
        "required",
        "examples"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "path"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "enum": [
            true
          ]
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "matrix",
            "label",
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        }
      },
    },
    "ParameterWithSchemaWithExamplesInQuery": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema",
        "examples"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "query"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "form",
            "spaceDelimited",
            "pipeDelimited",
            "deepObject"
          ],
          "default": "form"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        }
      },
    },
    "ParameterWithSchemaWithExamplesInHeader": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema",
        "examples"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "header"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "simple"
          ],
          "default": "simple"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        }
      },
    },
    "ParameterWithSchemaWithExamplesInCookie": {
      "type": "object",
      "required": [
        "name",
        "in",
        "schema",
        "examples"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "cookie"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "style": {
          "type": "string",
          "enum": [
            "form"
          ],
          "default": "form"
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/Reference"
            },
            {
              "$ref": "#/definitions/Schema"
            }
          ]
        },
        "examples": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "$ref": "#/definitions/Reference"
              },
              {
                "$ref": "#/definitions/Example"
              }
            ]
          }
        }
      },
    },
    "ParameterWithContent": {
      "anyOf": [
        {
          "$ref": "#/definitions/ParameterWithContentInPath"
        },
        {
          "$ref": "#/definitions/ParameterWithContentNotInPath"
        }
      ]
    },
    "ParameterWithContentInPath": {
      "type": "object",
      "required": [
        "name",
        "in",
        "content"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "path"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "enum": [
            true
          ]
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "content": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/MediaType"
          },
          "minProperties": 1,
          "maxProperties": 1
        }
      },
    },
    "ParameterWithContentNotInPath": {
      "type": "object",
      "required": [
        "name",
        "in",
        "content"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "query",
            "header",
            "cookie"
          ]
        },
        "description": {
          "type": "string"
        },
        "required": {
          "type": "boolean",
          "default": false
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        },
        "allowEmptyValue": {
          "type": "boolean",
          "default": false
        },
        "content": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/MediaType"
          },
          "minProperties": 1,
          "maxProperties": 1
        }
      },
    },
    "RequestBody": {
      "type": "object",
      "required": [
        "content"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "content": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/MediaType"
          }
        },
        "required": {
          "type": "boolean",
          "default": false
        }
      },
      "additionalProperties": false
    },
    "SecurityScheme": {
      "anyOf": [
        {
          "$ref": "#/definitions/APIKeySecurityScheme"
        },
        {
          "$ref": "#/definitions/HTTPSecurityScheme"
        },
        {
          "$ref": "#/definitions/OAuth2SecurityScheme"
        },
        {
          "$ref": "#/definitions/OpenIdConnectSecurityScheme"
        }
      ]
    },
    "APIKeySecurityScheme": {
      "type": "object",
      "required": [
        "type",
        "name",
        "in"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "apiKey"
          ]
        },
        "name": {
          "type": "string"
        },
        "in": {
          "type": "string",
          "enum": [
            "header",
            "query",
            "cookie"
          ]
        },
        "description": {
          "type": "string"
        }
      },
    },
    "HTTPSecurityScheme": {
      "anyOf": [
        {
          "$ref": "#/definitions/NonBearerHTTPSecurityScheme"
        },
        {
          "$ref": "#/definitions/BearerHTTPSecurityScheme"
        }
      ]
    },
    "NonBearerHTTPSecurityScheme": {
      "type": "object",
      "required": [
        "scheme",
        "type"
      ],
      "properties": {
        "scheme": {
          "type": "string",
          "not": {
            "enum": [
              "bearer"
            ]
          }
        },
        "description": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "http"
          ]
        }
      },
    },
    "BearerHTTPSecurityScheme": {
      "type": "object",
      "required": [
        "type",
        "scheme"
      ],
      "properties": {
        "scheme": {
          "type": "string",
          "enum": [
            "bearer"
          ]
        },
        "bearerFormat": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "http"
          ]
        },
        "description": {
          "type": "string"
        }
      },
    },
    "OAuth2SecurityScheme": {
      "type": "object",
      "required": [
        "type",
        "flows"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "oauth2"
          ]
        },
        "flows": {
          "$ref": "#/definitions/OAuthFlows"
        },
        "description": {
          "type": "string"
        }
      },
    },
    "OpenIdConnectSecurityScheme": {
      "type": "object",
      "required": [
        "type",
        "openIdConnectUrl"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "openIdConnect"
          ]
        },
        "openIdConnectUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "description": {
          "type": "string"
        }
      },
    },
    "OAuthFlows": {
      "type": "object",
      "properties": {
        "implicit": {
          "$ref": "#/definitions/ImplicitOAuthFlow"
        },
        "password": {
          "$ref": "#/definitions/PasswordOAuthFlow"
        },
        "clientCredentials": {
          "$ref": "#/definitions/ClientCredentialsFlow"
        },
        "authorizationCode": {
          "$ref": "#/definitions/AuthorizationCodeOAuthFlow"
        }
      },
      "additionalProperties": false
    },
    "ImplicitOAuthFlow": {
      "type": "object",
      "required": [
        "authorizationUrl",
        "scopes"
      ],
      "properties": {
        "authorizationUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "refreshUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "scopes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "PasswordOAuthFlow": {
      "type": "object",
      "required": [
        "tokenUrl"
      ],
      "properties": {
        "tokenUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "refreshUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "scopes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "ClientCredentialsFlow": {
      "type": "object",
      "required": [
        "tokenUrl"
      ],
      "properties": {
        "tokenUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "refreshUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "scopes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "AuthorizationCodeOAuthFlow": {
      "type": "object",
      "required": [
        "authorizationUrl",
        "tokenUrl"
      ],
      "properties": {
        "authorizationUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "tokenUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "refreshUrl": {
          "type": "string",
          "format": "uri-reference"
        },
        "scopes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "Link": {
      "anyOf": [
        {
          "$ref": "#/definitions/LinkWithOperationRef"
        },
        {
          "$ref": "#/definitions/LinkWithOperationId"
        }
      ]
    },
    "LinkWithOperationRef": {
      "type": "object",
      "properties": {
        "operationRef": {
          "type": "string",
          "format": "uri-reference"
        },
        "parameters": {
          "type": "object",
          "additionalProperties": {}
        },
        "requestBody": {},
        "description": {
          "type": "string"
        },
        "server": {
          "$ref": "#/definitions/Server"
        }
      },
    },
    "LinkWithOperationId": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string"
        },
        "parameters": {
          "type": "object",
          "additionalProperties": {}
        },
        "requestBody": {},
        "description": {
          "type": "string"
        },
        "server": {
          "$ref": "#/definitions/Server"
        }
      },
    },
    "Callback": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/PathItem"
      }
    },
    "Encoding": {
      "type": "object",
      "properties": {
        "contentType": {
          "type": "string"
        },
        "headers": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/Header"
          }
        },
        "style": {
          "type": "string",
          "enum": [
            "form",
            "spaceDelimited",
            "pipeDelimited",
            "deepObject"
          ]
        },
        "explode": {
          "type": "boolean"
        },
        "allowReserved": {
          "type": "boolean",
          "default": false
        }
      },
      "additionalProperties": false
    }
  }
};