import {IncomingMessage, ServerResponse} from "http";
import {NextFunction, Request, Response} from "express";

/**
 * Configuration options for Server-Sent Events (SSE) middleware.
 */
type SSEConfig = {
	/**
	 * Optional callback function to be executed when the SSE connection is closed.
	 * This can be used to perform cleanup or other actions when a client disconnects.
	 */
	onClose?: () => void;

	/**
	 * Interval in milliseconds at which heartbeats should be sent to keep the SSE connection alive.
	 * Heartbeats are sent as comments, and can be useful to prevent timeouts on some proxies or clients.
	 * Default value is 15000 milliseconds (15 seconds).
	 */
	heartbeatIntervalMs?: number;

	/**
	 * Optional callback function to be executed at each heartbeat interval.
	 * This can be used to perform periodic tasks, such as checking for new data to send to clients.
	 */
	heartbeatCallback?: () => void;

	/**
	 * Name of the event type to be sent to the client.
	 * If not provided, the client will listen for messages without a specific event type.
	 */
	event?: string;

	/**
	 * The reconnection time in milliseconds that will be sent to the client.
	 * This specifies how long the browser should wait before attempting to reconnect to the source of server-sent events.
	 * If not specified, the browser will use its default value.
	 */
	retry?: number;

	/**
	 * Identifier for the last event sent. This can be used by the client to let the server know
	 * where to start with the next message in case of connection issues.
	 */
	id?: string;

	/**
	 * The maximum number of events that should be buffered before being sent to the client.
	 * If the number of events exceeds this size, the buffer will be flushed and sent to the client.
	 * Default value is 1024 events.
	 */
	bufferSize?: number;

	/**
	 * Minimum interval in milliseconds that should elapse between sending events to the client.
	 * This is used for throttling the rate at which events are sent to the client.
	 * Default value is 0, indicating no throttling.
	 */
	throttleMs?: number;

	/**
	 * The maximum number of events per second that the server should send to a single client.
	 * This can be used to implement rate limiting.
	 * Default value is 50 events per second.
	 */
	maxRequestsPerSecond?: number;
};

/**
 * An extension of the standard server response object with additional methods for handling
 * Server-Sent Events (SSE). This is used within the SSE middleware to allow for the sending
 * of events, comments, and managing client subscriptions.
 */
type SSEResponse = ServerResponse &
	Response & {
		/**
		 * Sends an SSE event to the client with the specified data and optional configuration options.
		 *
		 * @param data - The data to be sent as the event's payload. Can be of any type.
		 * @param options - Optional configuration options for the event, such as event type, retry interval, or custom ID.
		 */
		sseSend: (data: unknown, options?: SSEOptions) => void;

		/**
		 * Sends an SSE comment to the client. This can be useful for sending control messages, debugging, or keeping
		 * the connection alive. Comments are ignored by the client and will not trigger event listeners.
		 *
		 * @param comment - The comment text to be sent to the client.
		 */
		sseComment: (comment: string) => void;

		/**
		 * Sends an acknowledgement for an SSE event with the specified event ID. This can be used to
		 * let the client know that an event has been processed successfully.
		 *
		 * @param eventId - The unique identifier of the event to acknowledge.
		 */
		sseAcknowledge: (eventId: string) => void;

		/**
		 * Subscribes the client to a specific type of event. After subscribing, the client will only receive
		 * events of the specified type.
		 *
		 * @param event - The event type to subscribe to.
		 */
		subscribeToEvent: (event: string) => void;

		/**
		 * Unsubscribes the client from a specific type of event. After unsubscribing, the client will no longer
		 * receive events of the specified type.
		 *
		 * @param event - The event type to unsubscribe from.
		 */
		unsubscribeFromEvent: (event: string) => void;
	};

/**
 * Configuration options for sending an SSE event to the client.
 */
type SSEOptions = {
	/**
	 * Specifies the type of the event. This can be used by the client to listen for specific types
	 * of events. If not specified, the client's generic event listener will be used.
	 */
	event?: string;

	/**
	 * Specifies the reconnection time in milliseconds. If the connection is lost, the client will
	 * attempt to reconnect to the server after the specified amount of time.
	 */
	retry?: number;

	/**
	 * Specifies a custom ID for the event. This can be used by the client to keep track of the last
	 * event received, so it can request events it might have missed if the connection is lost.
	 */
	id?: string;

	/**
	 * Specifies the unique identifier for the event. This can be useful for scenarios where you
	 * want to acknowledge that an event has been processed successfully.
	 */
	eventId?: string;
};

/**
 * Type definition for the SSE middleware function.
 */
type UniversalSSEMiddleware = (
	/**
	 * The incoming HTTP request. This can be either an `IncomingMessage` (from Node.js HTTP module)
	 * or an Express `Request` object.
	 */
	request: IncomingMessage | Request,
	/**
	 * The server response, extended with SSE-specific methods to facilitate sending server-sent
	 * events to the client.
	 */
	response: SSEResponse,
	/**
	 * The next middleware function in the Express application’s request-response cycle. This can
	 * also be an error handler if it accepts an error as its first argument.
	 */
	next: NextFunction | ((err?: any) => void),
	/**
	 * Configuration options for customizing the behavior of the SSE middleware.
	 */
	config: SSEConfig
) => void;

/**
 * Represents the subscription information for a client connected via SSE (Server-Sent Events).
 * This type is used to keep track of the types of events a client has subscribed to.
 */
type ClientSubscription = {
	/**
	 * A set of strings representing the types of events the client has subscribed to.
	 * Each string corresponds to an event type.
	 */
	eventTypes: Set<string>;
};

/**
 * Represents the acknowledgement status of a specific SSE (Server-Sent Events) event.
 * This type is used to keep track of whether a particular event has been acknowledged by the client.
 */
type EventAcknowledgement = {
	/**
	 * A string that uniquely identifies the SSE event.
	 */
	eventId: string;

	/**
	 * A boolean indicating whether the event has been acknowledged by the client.
	 * True if the event has been acknowledged, false otherwise.
	 */
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
