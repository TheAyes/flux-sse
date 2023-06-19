import {IncomingMessage, ServerResponse} from "http";
import {NextFunction, Request, Response} from "express";

/**
 * Configuration options for SSE middleware.
 */
type SSEConfig = {
	onClose?: () => void;
	heartbeatIntervalMs?: number;
	heartbeatCallback?: () => void;
	event?: string;
	retry?: number;
	id?: string;
	bufferSize?: number;
	throttleMs?: number;
	maxRequestsPerSecond?: number;
};

/**
 * Extended response type with SSE-specific methods.
 */
type SSEResponse = ServerResponse &
	Response & {
		sseSend: (data: unknown, options?: SSEOptions) => void;
		sseComment: (comment: string) => void;
		sseAcknowledge: (eventId: string) => void;
		subscribeToEvent: (event: string) => void;
		unsubscribeFromEvent: (event: string) => void;
	};

/**
 * Options for sending SSE data.
 */
type SSEOptions = {
	event?: string;
	retry?: number;
	id?: string;
	eventId?: string;
};

/**
 * Type definition for the SSE middleware function.
 */
type UniversalSSEMiddleware = (
	request: IncomingMessage | Request,
	response: SSEResponse,
	next: NextFunction | ((err?: any) => void),
	config: SSEConfig
) => void;

/**
 * Represents the subscribed event types for a client.
 */
type ClientSubscription = {
	eventTypes: Set<string>;
};

/**
 * Represents an acknowledged SSE event.
 */
type EventAcknowledgement = {
	eventId: string;
	acknowledged: boolean;
};

/**
 * SSE middleware function to enable server-sent events.
 *
 * @param {IncomingMessage | Request} request - The incoming request object.
 * @param {SSEResponse} response - The response object with SSE-specific methods.
 * @param {NextFunction | ((err?: any) => void)} next - The next function or error handler.
 * @param {SSEConfig} config - The configuration options for SSE middleware.
 */
const useSSE: UniversalSSEMiddleware = (
	request: IncomingMessage | Request,
	response: SSEResponse,
	next: NextFunction | ((err?: any) => void),
	config: SSEConfig = {
		heartbeatIntervalMs: 15000,
		bufferSize: 1024,
		throttleMs: 0,
		maxRequestsPerSecond: 50,
	}
) => {
	// Unique client ID
	const clientId = (Math.random() * 10000).toString();
	// Set of client connections
	const clientConnections = new Set<string>();
	// Event buffer for storing SSE events
	const eventBuffer: string[] = [];
	// Map of client subscriptions
	const clientSubscriptions = new Map<string, ClientSubscription>();
	// Map of event acknowledgements
	const eventAcknowledgements = new Map<string, EventAcknowledgement>();
	// Last request time for rate limiting
	let lastRequestTime: number | null = null;
	// Counter for tracking requests
	let requestCounter = 0;

	/**
	 * Checks if throttling should be applied based on the configured throttle interval and last request time.
	 *
	 * @returns {boolean} - True if throttling should be applied, false otherwise.
	 */
	const shouldThrottle = (): boolean => {
		if (!config.throttleMs || !lastRequestTime) {
			return false;
		}
		const elapsedTime = Date.now() - lastRequestTime;
		return elapsedTime < config.throttleMs;
	};

	/**
	 * Checks if rate limiting should be applied based on the configured maximum requests per second.
	 *
	 * @returns {boolean} - True if rate limiting should be applied, false otherwise.
	 */
	const shouldRateLimit = (): boolean => {
		if (!config.maxRequestsPerSecond) {
			return false;
		}
		return requestCounter >= config.maxRequestsPerSecond;
	};

	/**
	 * Resets the request counter and updates the last request time.
	 */
	const resetRequestCounter = (): void => {
		requestCounter = 0;
		lastRequestTime = Date.now();
	};

	/**
	 * Sends an SSE event with the specified data and options.
	 *
	 * @param {unknown} data - The data to send as SSE.
	 * @param {SSEOptions} [options] - The options for the SSE event.
	 */
	const sendEvent = (data: unknown, options?: SSEOptions): void => {
		if (shouldThrottle() || shouldRateLimit()) {
			return;
		}

		const eventData = JSON.stringify(data);
		const { event, retry, id, eventId } = options || {};

		if (!event || isClientSubscribedToEvent(clientId, event)) {
			if (event) eventBuffer.push(`event: ${event}`);
			if (id) eventBuffer.push(`id: ${id}`);
			eventBuffer.push(`data: ${eventData}`);
			if (retry) eventBuffer.push(`retry: ${retry}`);
			if (eventId) {
				eventBuffer.push(`eventId: ${eventId}`);
				acknowledgeEvent(eventId);
			}

			response.write(`${eventBuffer.join("\n")}\n\n`);
			eventBuffer.length = 0;

			requestCounter++;
			if (shouldRateLimit()) {
				setTimeout(resetRequestCounter, 1000); // Reset the request counter after 1 second
			}
		}
	};

	/**
	 * Sends an SSE comment.
	 *
	 * @param {string} comment - The comment to send as SSE.
	 */
	const sendComment = (comment: string): void => {
		response.write(`: ${comment}\n\n`);
	};

	/**
	 * Acknowledges an SSE event with the specified event ID.
	 *
	 * @param {string} eventId - The event ID to acknowledge.
	 */
	const acknowledgeEvent = (eventId: string): void => {
		const acknowledgement = eventAcknowledgements.get(eventId);
		if (acknowledgement) acknowledgement.acknowledged = true;
	};

	/**
	 * Subscribes the client to the specified event type.
	 *
	 * @param {string} eventType - The event type to subscribe to.
	 */
	const subscribeToEvent = (eventType: string): void => {
		let subscription = clientSubscriptions.get(clientId);
		if (!subscription) {
			subscription = { eventTypes: new Set<string>() };
			clientSubscriptions.set(clientId, subscription);
		}
		subscription.eventTypes.add(eventType);
	};

	/**
	 * Unsubscribes the client from the specified event type.
	 *
	 * @param {string} eventType - The event type to unsubscribe from.
	 */
	const unsubscribeFromEvent = (eventType: string): void => {
		const subscription = clientSubscriptions.get(clientId);
		if (subscription) {
			subscription.eventTypes.delete(eventType);
			if (subscription.eventTypes.size === 0) {
				clientSubscriptions.delete(clientId);
			}
		}
	};

	/**
	 * Checks if the client is subscribed to the specified event type.
	 *
	 * @param {string} clientId - The client ID.
	 * @param {string} eventType - The event type to check.
	 * @returns {boolean} - True if the client is subscribed, false otherwise.
	 */
	const isClientSubscribedToEvent = (clientId: string, eventType: string): boolean => {
		const subscription = clientSubscriptions.get(clientId);
		return subscription?.eventTypes.has(eventType) ?? false;
	};

	// Assign SSE-specific methods to the response object
	response.sseSend = sendEvent;
	response.sseComment = sendComment;
	response.sseAcknowledge = acknowledgeEvent;
	response.subscribeToEvent = subscribeToEvent;
	response.unsubscribeFromEvent = unsubscribeFromEvent;

	// Set SSE headers
	response.setHeader("Content-Type", "text/event-stream");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Connection", "keep-alive");
	if (config.retry) response.setHeader("Retry", config.retry.toString());
	if (config.id) response.sseComment(`id: ${config.id}`);

	response.flushHeaders();

	// Heartbeat interval for keeping the connection alive
	const heartbeat = setInterval(() => {
		response.write(":heartbeat\n\n");
		if (config.heartbeatCallback) config.heartbeatCallback();
	}, config.heartbeatIntervalMs || 10000);

	// Handle request closure
	request.on("close", () => {
		clearInterval(heartbeat);
		if (config.onClose) config.onClose();

		if (clientConnections.has(clientId)) {
			clientConnections.delete(clientId);
			response.sseComment("Reconnecting...");
		}
	});

	// Add client to connections set
	clientConnections.add(clientId);

	// Override sseSend to flush event buffer if it exceeds the buffer size
	response.sseSend = ((sseSend) => (data: unknown, options?: SSEOptions) => {
		if (config.bufferSize && eventBuffer.length >= config.bufferSize) {
			response.write(`${eventBuffer.join("\n")}\n\n`);
			eventBuffer.length = 0;
		}
		sseSend(data, options);
	})(response.sseSend);

	next();
};

export { useSSE };
