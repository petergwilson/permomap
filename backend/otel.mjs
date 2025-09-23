/*
 * OpenTelemetry initialization for Permomap Server
 * This file must be imported before any other modules to ensure proper instrumentation
 */

import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {OTLPLogExporter} from '@opentelemetry/exporter-logs-otlp-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {PgInstrumentation} from '@opentelemetry/instrumentation-pg';
import {PeriodicExportingMetricReader} from '@opentelemetry/sdk-metrics';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from "@opentelemetry/resources";
import {getNodeAutoInstrumentations} from "@opentelemetry/auto-instrumentations-node";

// Configure the resource with service information
const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'permomap-server',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'permomap',
});

// Configure OTLP exporters
const traceExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
});

const metricExporter = new OTLPMetricExporter({
    url: 'http://localhost:4318/v1/metrics',
});

const logExporter = new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
});

// Configure metric reader
const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 5000, // Export metrics every 5 seconds
});

// Configure log processor
// Initialize the SDK with auto-instrumentations
const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    logRecordProcessors: [logExporter],
    instrumentations: [
        new HttpInstrumentation({
            // Configure HTTP instrumentation
            requestHook: (span, request) => {
                span.setAttributes({
                    'http.request.body.size': request.headers['content-length'],
                });
            },
        }),
        new ExpressInstrumentation({
            // Configure Express instrumentation
            requestHook: (span, info) => {
                span.setAttributes({
                    'express.route': info.route,
                });
            },
        }),
        new PgInstrumentation({
            // Configure PostgreSQL instrumentation
            enhancedDatabaseReporting: true,
        }),
        ...getNodeAutoInstrumentations()
    ],
});

// Gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('OpenTelemetry tracing terminated'))
        .catch((error) => console.log('Error terminating tracing', error))
        .finally(() => process.exit(0));
});

// Start the SDK
sdk.start();
console.log('OpenTelemetry tracing started... 🚀');

export default sdk;
