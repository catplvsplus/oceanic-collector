# Oceanic Collector
A collection of oceanic.js collectors

## Installation
```bash
npm install oceanic-collector
```

## Usage
### InteractionCollector
```ts
import { InteractionCollector } from 'oceanic-collector';

const collector = new InteractionCollector({
    client,                                      // Your oceanic.js client instance (required)
    time: 60000,                                 // Collect interactions for 60 seconds
    idle: 30000,                                 // End the collector if it becomes idle for 30 seconds
    max: 10,                                     // Collect a maximum of 10 interactions
    maxUsers: 5,                                 // Collect interactions from a maximum of 5 users
    types: [InteractionTypes.MESSAGE_COMPONENT], // Only collect a specific type of interaction
    filter: i => i.user.id === '1234567890',     // Only collect interactions from a specific user
    message: '1234567890',                       // Only collect interactions from a specific message
    channel: '1234567890',                       // Only collect interactions from a specific channel
    guild: '1234567890',                         // Only collect interactions from a specific guild
});

collector.on('collect', interaction => {});      // Handle collected interactions
collector.on('end', (collected, reason) => {});  // Handle the end of the collection

collector.stop();                                // Stop the collector
```

### MessageCollector
```ts
import { MessageCollector } from 'oceanic-collector';

const collector = new MessageCollector({
    client,                                        // Your oceanic.js client instance (required)
    time: 60000,                                   // Collect messages for 60 seconds
    idle: 30000,                                   // End the collector if it becomes idle for 30 seconds
    max: 10,                                       // Collect a maximum of 10 messages
    filter: msg => msg.author.id === '1234567890', // Only collect messages from a specific user
    channel: '1234567890',                         // Only collect messages from a specific channel
    guild: '1234567890',                           // Only collect messages from a specific guild
});

collector.on('collect', message => {});            // Handle collected messages
collector.on('end', (collected, reason) => {});    // Handle the end of the collection

collector.stop();                                  // Stop the collector
```

### ReactionCollector
```ts
import { ReactionCollector } from 'oceanic-collector';

const collector = new ReactionCollector({
    client,                                               // Your oceanic.js client instance (required)
    time: 60000,                                          // Collect reactions for 60 seconds
    idle: 30000,                                          // End the collector if it becomes idle for 30 seconds
    max: 10,                                              // Collect a maximum of 10 reactions
    maxEmojis: 5,                                         // Collect a maximum of 5 different emojis
    maxUsers: 3,                                          // Collect reactions from a maximum of 3 users
    filter: (reaction, user) => user.id === '1234567890', // Only collect reactions from a specific user
    message: '1234567890',                                // Only collect reactions from a specific message
    channel: '1234567890',                                // Only collect reactions from a specific channel
    guild: '1234567890',                                  // Only collect reactions from a specific guild
});

collector.on('collect', reaction => {});                  // Handle collected reactions
collector.on('end', (collected, reason) => {});           // Handle the end of the collection

collector.stop();                                         // Stop the collector
```