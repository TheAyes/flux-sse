# Flux SSE 😎

[![npm](https://img.shields.io/npm/v/flux-sse)](https://www.npmjs.com/package/flux-sse) [![npm bundle size](https://img.shields.io/bundlephobia/min/flux-sse)](https://www.npmjs.com/package/flux-sse) [![GitHub](https://img.shields.io/github/license/TheAyes/flux-sse)]()

A middleware function that brings real-time updates to your server-client communication using server-sent events (SSE). 🌐📡

## Installation

To use this middleware, install it via npm:

```bash
npm install flux-sse
```

## Usage

Import the `useSSE` function from the module and add it as middleware to your Express application. Here's an example to get you started:

```javascript
import express from "express";
import {useSSE} from "flux-sse";

const app = express();

// Add Flux SSE to specific routes
app.get("/sse-events", useSSE, (req, res) => {
	// Handle SSE events for this route
});

app.listen(3000, () => {
	console.log("Server is up and running on port 3000 🚀");
});
```

## Configuration Options 🛠️

The `useSSE` middleware function accepts a configuration object with the following options:

| Option                 | Type         | Description                                                                                                                           |
|------------------------|--------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `onClose`              | `() => void` | A callback function to be executed when the SSE connection is closed.                                                                 |
| `heartbeatIntervalMs`  | `number`     | The interval (in milliseconds) at which a heartbeat event should be sent to keep the connection alive. Default: `10000` (10 seconds). |
| `heartbeatCallback`    | `() => void` | A callback function to be executed each time a heartbeat event is sent.                                                               |
| `event`                | `string`     | The default event type for SSE events.                                                                                                |
| `retry`                | `number`     | The time (in milliseconds) that the client should wait before reconnecting if the connection is lost.                                 |
| `id`                   | `string`     | The ID to include in SSE comments.                                                                                                    |
| `bufferSize`           | `number`     | The maximum number of events to store in the event buffer before flushing.                                                            |
| `throttleMs`           | `number`     | The minimum time (in milliseconds) between consecutive SSE events sent to the same client.                                            |
| `maxRequestsPerSecond` | `number`     | The maximum number of SSE requests allowed per second from a single client.                                                           |

## Extended Response Type 🚀

The `SSEResponse` type extends the `ServerResponse` and `Response` types from the `http` and `express` modules, respectively. It includes additional methods for
sending SSE events and managing subscriptions.

### SSE Methods

The `SSEResponse` object provides the following SSE-specific methods:

#### `sseSend(data: unknown, options?: SSEOptions): void` ✉️

Sends an SSE event with the specified `data` and `options`. The `data` can be any JavaScript object or value. The `options` parameter is an object that can
contain the following properties:

- `event` (optional): The event type for the SSE event.
- `retry` (optional): The time (in milliseconds) that the client should wait before retrying the connection if an error occurs.
- `id` (optional): The

ID for the SSE event.

- `eventId` (optional): The ID of the acknowledged event (to be used for acknowledging the event).

#### `sseComment(comment: string): void` 💬

Sends an SSE comment with the specified `comment` string. SSE comments are non-event messages that can be used for various purposes.

#### `sseAcknowledge(eventId: string): void` ✅

Acknowledges an SSE event with the specified `eventId`. This is useful for notifying the client that a particular event has been processed or received.

#### `subscribeToEvent(event: string): void` 🔔

Subscribes the client to the specified `event` type. Once subscribed, the client will receive SSE events of the subscribed type.

#### `unsubscribeFromEvent(event: string): void` 🔕

Unsubscribes the client from the specified `event` type. The client will no longer receive SSE events of the unsubscribed type.

## Example 🌟

Here's an example of how to use Flux SSE in an Express application:

```javascript
import express from "express";
import {useSSE} from "flux-sse";

const app = express();

app.use(useSSE);

app.get("/events", (req, res) => {
	// Send SSE events to the client
	res.sseSend({message: "Hello, world! 🌍"});
});

app.listen(3000, () => {
	console.log("Server is up and running on port 3000 🚀");
});
```

In the example above, the server sends an SSE event with the message "Hello, world! 🌍" to the client when the client requests the `/events` route.

Feel free to customize the middleware configuration and SSE event handling according to your needs.

## License 📄

This project is licensed under the [MIT License](LICENSE).

🚀 Happy real-time communication with SSE! 🎉