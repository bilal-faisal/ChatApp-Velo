import { sendMessage, getChatMessages, startListeningForMessages } from 'backend/chatapp.jsw';
import { subscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';

let initialLoadComplete = false;
let messageList = [];
let lastMessageTimestamp = 0;

$w.onReady(async () => {
    const chatID = "myDynamicChatID";
    const senderID = currentUser.id;

    // Start listening for messages in the backend for the current chatID
    await startListeningForMessages(chatID);

    if (!initialLoadComplete) {
        await loadPreviousMessages(chatID);
        initialLoadComplete = true;
    }

    // Subscribe to real-time updates for this chat ID
    const channel = { name: `chatMessages_${chatID}` };

    subscribe(channel, (message) => {
        const { payload } = message;
        const { sender, message: messageText, timestamp } = payload;

        if (sender && messageText && timestamp > lastMessageTimestamp) {
            lastMessageTimestamp = timestamp;

            // Ensure timestamp is included in messageList
            messageList.push({ sender, messageText, timestamp });
            renderMessages();
        } else {
            console.warn("Duplicate or incomplete message data:", payload);
        }
    });

    $w("#sendButton").onClick(async () => {
        const messageText = $w("#messageInput").value;
        if (messageText) {
            try {
                await sendMessage(chatID, senderID, messageText);
                console.log("Message sent successfully!");
                $w("#messageInput").value = "";
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
            // Ensure that timestamp is included for each message
            messageList.push({ sender: message.sender, messageText: message.message, timestamp: message.timestamp });
            lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp);
        });
        renderMessages();
    } catch (error) {
        console.error("Error loading previous messages:", error);
    }
}

function renderMessages() {
    // Combine all messages into a single text with sender, message, and formatted time
    const allMessagesText = messageList.map(({ sender, messageText, timestamp }) => {
        // Ensure the timestamp is a valid number before formatting
        const messageTime = timestamp && !isNaN(timestamp) ?
            new Date(parseInt(timestamp)).toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
            }) :
            "Unknown Time";

        return `${sender.substring(0, 10)} (${messageTime}): ${messageText}`;
    }).join('\n');

    // Display all messages in the textbox
    $w("#textBoxChat").value = allMessagesText;
}