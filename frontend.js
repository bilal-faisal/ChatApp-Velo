import { sendMessage, getChatMessages, listenForMessages } from 'backend/chatapp.jsw';
import { subscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';

let initialLoadComplete = false; // Track initial load state
let messageList = []; // Local state to track all messages
let lastMessageTimestamp = 0; // Track the last message timestamp to prevent duplicates

$w.onReady(async () => {
    const chatID = "sampleChatID4";
    const senderID = currentUser.id;

    // Load previous messages only on the first load
    if (!initialLoadComplete) {
        await loadPreviousMessages(chatID);
        initialLoadComplete = true;
    }

    // Subscribe to real-time updates
    const channel = { name: `chatMessages_${chatID}` };
    subscribe(channel, (message) => {
        const { payload } = message;
        const { sender, message: messageText, timestamp } = payload;

        // Check if the message is new by comparing timestamps
        if (sender && messageText && timestamp > lastMessageTimestamp) {
            // Update the last message timestamp to the latest one
            lastMessageTimestamp = timestamp;

            // Add new message to the message list
            messageList.push({ sender, messageText });
            renderMessages(); // Render all messages in the textbox
        } else {
            console.warn("Duplicate or incomplete message data:", payload);
        }
    });

    // Handle sending a message
    $w("#sendButton").onClick(async () => {
        const messageText = $w("#messageInput").value;
        if (messageText) {
            try {
                await sendMessage(chatID, senderID, messageText);
                console.log("Message sent successfully!");
                $w("#messageInput").value = ""; // Clear the input after sending
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }
    });
});

async function loadPreviousMessages(chatID) {
    try {
        const messages = await getChatMessages(chatID);
        messages.forEach((message) => {
            messageList.push({ sender: message.sender, messageText: message.message });
            lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp); // Set the latest timestamp
        });
        renderMessages(); // Render all previous messages
    } catch (error) {
        console.error("Error loading previous messages:", error);
    }
}

function renderMessages() {
    // Combine all messages into a single text
    const allMessagesText = messageList.map(({ sender, messageText }) => {
        return `${sender.substring(0, 10)}: ${messageText}`;
    }).join('\n');

    // Display all messages in the textbox
    $w("#textBoxChat").value = allMessagesText;
}